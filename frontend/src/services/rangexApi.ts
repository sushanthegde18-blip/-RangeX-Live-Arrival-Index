import {
  RangeXApiError,
  type AvlOperationTrace,
  type AvlRotationEvent,
  type AvlTreeSnapshot,
  type BenchmarkResponse,
  type BulkArrivalsRequest,
  type EventsHistoryResponse,
  type GapsResponse,
  type IntervalMutationType,
  type IntervalRange,
  type IntervalsResponse,
  type PackageRegistrationRequest,
  type PackageRegistrationResult,
  type SimulateRequest,
  type SimulateResponse,
  type WarehouseAnalytics,
} from '../contracts/api'
import { API_CONFIG, buildApiUrl } from './apiConfig'

async function requestJson<T>(
  route: string,
  init?: RequestInit,
  timeoutMs = API_CONFIG.requestTimeoutMs,
): Promise<T> {
  const endpoint = buildApiUrl(route)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })

    const contentType = response.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')

    if (!response.ok) {
      let errorPayload: unknown = undefined
      let errorMessage = `Backend responded with HTTP ${response.status}`
      if (isJson) {
        try {
          errorPayload = await response.json()
          if (
            typeof errorPayload === 'object' &&
            errorPayload !== null &&
            'message' in errorPayload &&
            typeof (errorPayload as { message: unknown }).message === 'string'
          ) {
            errorMessage = (errorPayload as { message: string }).message
          }
        } catch {
          // Ignore malformed error body
        }
      }

      throw new RangeXApiError(errorMessage, {
        status: response.status,
        code: `HTTP_${response.status}`,
        endpoint,
        details: errorPayload,
      })
    }

    if (!isJson) {
      throw new RangeXApiError(
        'Backend returned non-JSON payload (expected RangeX C++ JSON API response).',
        {
          status: response.status,
          code: 'INVALID_CONTENT_TYPE',
          endpoint,
        },
      )
    }

    return (await response.json()) as T
  } catch (err) {
    if (err instanceof RangeXApiError) {
      throw err
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new RangeXApiError(
        `Request to C++ backend timed out after ${timeoutMs}ms (${endpoint}).`,
        {
          code: 'TIMEOUT',
          endpoint,
        },
      )
    }

    throw new RangeXApiError(
      err instanceof Error
        ? `Unable to reach C++ backend at ${endpoint}: ${err.message}`
        : `Unable to reach C++ backend at ${endpoint}.`,
      {
        code: 'BACKEND_UNREACHABLE',
        endpoint,
        details: err,
      },
    )
  } finally {
    window.clearTimeout(timer)
  }
}

function normalizeInterval(raw: unknown): IntervalRange {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Malformed interval entry from backend')
  }
  const obj = raw as Record<string, unknown>
  const start = Number(obj.start)
  const end = Number(obj.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Interval missing numeric start/end bounds')
  }
  return {
    id: typeof obj.id === 'string' ? obj.id : `${start}-${end}`,
    nodeId:
      typeof obj.nodeId === 'string' || typeof obj.nodeId === 'number'
        ? obj.nodeId
        : undefined,
    start,
    end,
    zone: typeof obj.zone === 'string' ? obj.zone : undefined,
    packageCount: typeof obj.packageCount === 'number' ? obj.packageCount : end - start + 1,
    lastUpdatedAt: typeof obj.lastUpdatedAt === 'string' ? obj.lastUpdatedAt : undefined,
  }
}

function normalizeMutationType(value: unknown): IntervalMutationType {
  if (value === 'CREATED' || value === 'EXTENDED' || value === 'MERGED' || value === 'DUPLICATE') {
    return value
  }
  const upper = typeof value === 'string' ? value.toUpperCase() : ''
  if (upper === 'CREATED' || upper === 'EXTENDED' || upper === 'MERGED' || upper === 'DUPLICATE') {
    return upper
  }
  throw new Error(`Unexpected mutationType "${String(value)}" from backend`)
}

function normalizeRotation(raw: unknown): AvlRotationEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const type = typeof obj.type === 'string' ? obj.type.toUpperCase() : 'NONE'
  if (type === 'NONE') {
    return { type: 'NONE' }
  }
  if (type === 'LL' || type === 'RR' || type === 'LR' || type === 'RL') {
    return {
      type,
      pivotNodeId:
        typeof obj.pivotNodeId === 'string' || typeof obj.pivotNodeId === 'number'
          ? obj.pivotNodeId
          : null,
      affectedNodeIds: Array.isArray(obj.affectedNodeIds)
        ? obj.affectedNodeIds.filter(
            (x): x is string | number => typeof x === 'string' || typeof x === 'number',
          )
        : undefined,
      reason: typeof obj.reason === 'string' ? obj.reason : undefined,
    }
  }
  return null
}

export function normalizePackageResult(raw: Record<string, unknown>, fallbackPackageId = 0): PackageRegistrationResult {
  const intervals = Array.isArray(raw.intervals) ? raw.intervals.map(normalizeInterval) : []
  const previousIntervals = Array.isArray(raw.previousIntervals)
    ? raw.previousIntervals.map(normalizeInterval)
    : []
  const targetInterval = normalizeInterval(raw.targetInterval)
  const mutationType = normalizeMutationType(raw.mutationType)

  return {
    packageId: Number(raw.packageId ?? fallbackPackageId),
    mutationType,
    targetInterval,
    previousIntervals,
    intervals,
    mergedFrom: Array.isArray(raw.mergedFrom) ? raw.mergedFrom.map(normalizeInterval) : undefined,
    searchPath: Array.isArray(raw.searchPath)
      ? raw.searchPath.filter(
          (x): x is string | number => typeof x === 'string' || typeof x === 'number',
        )
      : [],
    highlightedNodeIds: Array.isArray(raw.highlightedNodeIds)
      ? raw.highlightedNodeIds.filter(
          (x): x is string | number => typeof x === 'string' || typeof x === 'number',
        )
      : [],
    rotation: normalizeRotation(raw.rotation),
    trace: (raw.trace as AvlOperationTrace | null | undefined) ?? null,
    avlSnapshot: (raw.avlSnapshot as AvlTreeSnapshot | null | undefined) ?? null,
    analytics: (raw.analytics as WarehouseAnalytics | null | undefined) ?? null,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    eventId: typeof raw.eventId === 'string' ? raw.eventId : undefined,
    isFixture: false,
  }
}

export const rangexApi = {
  async registerPackage(payload: PackageRegistrationRequest): Promise<PackageRegistrationResult> {
    const raw = await requestJson<Record<string, unknown>>(API_CONFIG.routes.registerPackage, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const endpoint = buildApiUrl(API_CONFIG.routes.registerPackage)
    try {
      return normalizePackageResult(raw, payload.packageId)
    } catch (parseError) {
      throw new RangeXApiError(
        parseError instanceof Error
          ? `Malformed backend insertion response: ${parseError.message}`
          : 'Malformed backend insertion response.',
        {
          code: 'INVALID_RESPONSE_SCHEMA',
          endpoint,
          details: raw,
        },
      )
    }
  },

  async fetchIntervals(limit?: number): Promise<IntervalsResponse> {
    const qs = limit ? `?limit=${limit}` : ''
    const raw = await requestJson<Record<string, unknown>>(`${API_CONFIG.routes.intervals}${qs}`)
    const intervals = Array.isArray(raw.intervals) ? raw.intervals.map(normalizeInterval) : []
    return {
      intervals,
      totalCount: typeof raw.totalCount === 'number' ? raw.totalCount : intervals.length,
      missingCount: typeof raw.missingCount === 'number' ? raw.missingCount : 0,
      minId: typeof raw.minId === 'number' ? raw.minId : null,
      maxId: typeof raw.maxId === 'number' ? raw.maxId : null,
      truncated: Boolean(raw.truncated),
      revision: typeof raw.revision === 'number' ? raw.revision : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    }
  },

  async fetchGaps(start: number, end: number, limit = 500): Promise<GapsResponse> {
    const route = `${API_CONFIG.routes.gaps}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=${limit}`
    return await requestJson<GapsResponse>(route)
  },

  async fetchAvlSnapshot(limit = 250): Promise<AvlTreeSnapshot> {
    return await requestJson<AvlTreeSnapshot>(`${API_CONFIG.routes.tree}?limit=${limit}`)
  },

  async fetchAnalytics(): Promise<WarehouseAnalytics> {
    return await requestJson<WarehouseAnalytics>(API_CONFIG.routes.stats)
  },

  async fetchEvents(offset = 0, limit = 250): Promise<EventsHistoryResponse> {
    return await requestJson<EventsHistoryResponse>(
      `${API_CONFIG.routes.events}?offset=${offset}&limit=${limit}`,
    )
  },

  async simulateArrivals(payload: SimulateRequest): Promise<SimulateResponse> {
    const raw = await requestJson<Record<string, unknown>>(API_CONFIG.routes.simulate, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return {
      simulatedCount: Number(raw.simulatedCount ?? payload.count),
      pattern: String(raw.pattern ?? payload.pattern),
      uniqueAdded: Number(raw.uniqueAdded ?? 0),
      duplicates: Number(raw.duplicates ?? 0),
      merges: Number(raw.merges ?? 0),
      generatedIds: Array.isArray(raw.generatedIds) ? (raw.generatedIds as number[]) : [],
      latestArrival:
        raw.latestArrival && typeof raw.latestArrival === 'object'
          ? normalizePackageResult(raw.latestArrival as Record<string, unknown>)
          : null,
      intervals: Array.isArray(raw.intervals) ? raw.intervals.map(normalizeInterval) : [],
      avlSnapshot: raw.avlSnapshot as AvlTreeSnapshot,
      analytics: raw.analytics as WarehouseAnalytics,
    }
  },

  async runBulkArrivals(payload: BulkArrivalsRequest): Promise<BenchmarkResponse> {
    return await requestJson<BenchmarkResponse>(
      API_CONFIG.routes.bulkArrivals,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      30000,
    )
  },

  async resetIndex(): Promise<{
    status: string
    intervals: IntervalRange[]
    avlSnapshot: AvlTreeSnapshot
    analytics: WarehouseAnalytics
  }> {
    return await requestJson(API_CONFIG.routes.reset, { method: 'POST' })
  },

  async checkHealth(): Promise<{ status: string; version?: string; totalPackages?: number }> {
    return await requestJson(API_CONFIG.routes.health, undefined, 3000)
  },
}
