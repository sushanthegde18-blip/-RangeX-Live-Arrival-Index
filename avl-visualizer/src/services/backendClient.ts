import {
  AvlBackendEvent,
  ConnectionStatus,
  IntervalSummary,
  NormalizedTreeSnapshot,
  WarehouseAnalyticsSnapshot,
} from '../types/avlBackend';
import {
  validateAnalytics,
  validateAndNormalizeSnapshot,
  validateBackendEvent,
  validateIntervals,
} from './eventValidator';

export interface BackendEndpoints {
  apiUrl: string;
  wsUrl: string;
}

export interface BackendCallbacks {
  onStatusChange: (status: ConnectionStatus, detail?: string) => void;
  onEvent: (event: AvlBackendEvent) => void;
  onSnapshotSync: (
    snapshot: NormalizedTreeSnapshot,
    intervals: IntervalSummary[],
    analytics: WarehouseAnalyticsSnapshot,
  ) => void;
  onInvalidPayload: (reason: string, rawPreview: string) => void;
}

const DEFAULT_API_URL = import.meta.env.VITE_RANGEX_API_URL || 'http://localhost:8080';
const DEFAULT_WS_URL = import.meta.env.VITE_RANGEX_WS_URL || 'ws://localhost:8080/ws/avl';

export function getDefaultEndpoints(): BackendEndpoints {
  return {
    apiUrl: DEFAULT_API_URL,
    wsUrl: DEFAULT_WS_URL,
  };
}

/**
 * WebSocket + REST client for Member 2's C++ AVL backend gateway.
 * Strictly validates all incoming payloads and never synthesizes tree states.
 */
export class RangeXBackendClient {
  private endpoints: BackendEndpoints;
  private callbacks: BackendCallbacks;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  constructor(endpoints: BackendEndpoints, callbacks: BackendCallbacks) {
    this.endpoints = endpoints;
    this.callbacks = callbacks;
  }

  public updateEndpoints(endpoints: BackendEndpoints) {
    this.endpoints = endpoints;
  }

  public async connect(): Promise<void> {
    this.intentionallyClosed = false;
    this.clearReconnectTimer();
    this.callbacks.onStatusChange('connecting', `Connecting to ${this.endpoints.wsUrl}`);

    // Attempt initial HTTP snapshot sync in parallel (non-fatal if WS delivers SNAPSHOT_SYNC)
    void this.fetchInitialSnapshot();

    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      }
      const ws = new WebSocket(this.endpoints.wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.callbacks.onStatusChange('connected', `Live stream connected (${this.endpoints.wsUrl})`);
      };

      ws.onmessage = (msg) => {
        this.handleRawMessage(msg.data);
      };

      ws.onerror = () => {
        if (!this.intentionallyClosed) {
          this.callbacks.onStatusChange('error', 'WebSocket transport error');
        }
      };

      ws.onclose = () => {
        if (this.intentionallyClosed) {
          this.callbacks.onStatusChange('disconnected', 'Disconnected by user');
          return;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to open WebSocket connection';
      this.callbacks.onStatusChange('error', msg);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.onStatusChange('disconnected', 'Disconnected');
  }

  public async fetchInitialSnapshot(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoints.apiUrl}/api/tree/snapshot`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return false;
      const body: unknown = await res.json();
      if (typeof body !== 'object' || body === null) {
        this.callbacks.onInvalidPayload('Snapshot response is not an object', JSON.stringify(body).slice(0, 180));
        return false;
      }
      const record = body as Record<string, unknown>;
      const snapRes = validateAndNormalizeSnapshot(record.snapshot ?? record);
      if (!snapRes.ok) {
        this.callbacks.onInvalidPayload(snapRes.error, JSON.stringify(body).slice(0, 180));
        return false;
      }
      const intRes = record.intervals ? validateIntervals(record.intervals) : { ok: true as const, value: [] };
      if (!intRes.ok) {
        this.callbacks.onInvalidPayload(intRes.error, JSON.stringify(record.intervals).slice(0, 180));
        return false;
      }
      const anaRes = record.analytics
        ? validateAnalytics(record.analytics)
        : {
            ok: false as const,
            error: 'Missing analytics in snapshot response',
          };

      if (anaRes.ok) {
        this.callbacks.onSnapshotSync(snapRes.value, intRes.value, anaRes.value);
      }
      return true;
    } catch {
      return false;
    }
  }

  public async submitPackageArrival(packageId: number): Promise<{ accepted: boolean; error?: string }> {
    if (!Number.isInteger(packageId)) {
      return { accepted: false, error: 'Package ID must be an integer' };
    }

    // Prefer REST endpoint if available, or send command over open WebSocket
    try {
      const res = await fetch(`${this.endpoints.apiUrl}/api/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { accepted: false, error: `Backend rejected package (${res.status}): ${text}` };
      }

      // If backend returns a batch of events synchronously in REST response, process them cleanly
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload: unknown = await res.json();
        if (typeof payload === 'object' && payload !== null && Array.isArray((payload as { events?: unknown[] }).events)) {
          for (const rawEv of (payload as { events: unknown[] }).events) {
            this.processParsedEvent(rawEv);
          }
        }
      }
      return { accepted: true };
    } catch {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'INSERT_PACKAGE', packageId }));
        return { accepted: true };
      }
      return {
        accepted: false,
        error: 'Backend is unreachable. Connect to Member 2 backend or load a recorded backend trace.',
      };
    }
  }

  private handleRawMessage(rawData: unknown) {
    if (typeof rawData !== 'string') {
      this.callbacks.onInvalidPayload('Non-text WebSocket frame received', String(rawData));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      this.callbacks.onInvalidPayload('Malformed JSON from backend WebSocket', rawData.slice(0, 180));
      return;
    }

    // Support both single event object and { events: [...] } batch envelopes
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { events?: unknown[] }).events)) {
      for (const item of (parsed as { events: unknown[] }).events) {
        this.processParsedEvent(item);
      }
      return;
    }

    this.processParsedEvent(parsed);
  }

  private processParsedEvent(rawEvent: unknown) {
    const validated = validateBackendEvent(rawEvent);
    if (!validated.ok) {
      this.callbacks.onInvalidPayload(validated.error, JSON.stringify(rawEvent).slice(0, 220));
      return;
    }
    this.callbacks.onEvent(validated.value);
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    const delayMs = Math.min(12000, 1000 * Math.pow(1.6, Math.min(this.reconnectAttempts - 1, 5)));
    this.callbacks.onStatusChange(
      'reconnecting',
      `Connection lost. Reconnecting in ${(delayMs / 1000).toFixed(1)}s (attempt #${this.reconnectAttempts})`,
    );
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionallyClosed) {
        void this.connect();
      }
    }, delayMs);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
