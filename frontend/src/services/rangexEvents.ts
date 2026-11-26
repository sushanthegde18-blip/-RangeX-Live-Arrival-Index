import type { BackendStreamEvent, ConnectionHealth } from '../contracts/api'
import { API_CONFIG } from './apiConfig'

export interface EventSubscriptionHandlers {
  onEvent: (event: BackendStreamEvent) => void
  onStatusChange: (status: ConnectionHealth, message?: string) => void
}

function resolveWebSocketUrl(rawUrl: string): string {
  if (rawUrl.startsWith('ws://') || rawUrl.startsWith('wss://')) {
    return rawUrl
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`
  return `${protocol}//${window.location.host}${path}`
}

/**
 * Subscribes to Member 2's live backend event stream (SSE or WebSocket).
 * Automatically cleans up listeners on unmount and never emits fabricated events.
 */
export function subscribeToBackendEvents(handlers: EventSubscriptionHandlers): () => void {
  let disposed = false
  let eventSource: EventSource | null = null
  let socket: WebSocket | null = null
  let reconnectTimer: number | null = null
  let attempts = 0

  const cleanupTransport = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (socket) {
      socket.close()
      socket = null
    }
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = (reason: string) => {
    if (disposed) return
    attempts += 1
    handlers.onStatusChange('offline', reason)
    const delayMs = Math.min(15000, 2000 * Math.pow(1.4, Math.min(attempts, 5)))
    reconnectTimer = window.setTimeout(() => {
      if (!disposed) {
        connect()
      }
    }, delayMs)
  }

  const parseAndDispatch = (rawData: string) => {
    try {
      const parsed = JSON.parse(rawData) as BackendStreamEvent
      if (parsed && typeof parsed.type === 'string') {
        handlers.onEvent(parsed)
      }
    } catch {
      // Ignore malformed non-JSON heartbeat frames
    }
  }

  const connect = () => {
    cleanupTransport()
    if (disposed) return

    handlers.onStatusChange('connecting', `Connecting to ${API_CONFIG.eventsUrl}`)

    const preferWs =
      API_CONFIG.transport === 'ws' ||
      (API_CONFIG.transport === 'auto' &&
        (API_CONFIG.eventsUrl.startsWith('ws://') || API_CONFIG.eventsUrl.startsWith('wss://')))

    if (preferWs) {
      try {
        const wsUrl = resolveWebSocketUrl(API_CONFIG.eventsUrl)
        socket = new WebSocket(wsUrl)
        socket.onopen = () => {
          if (disposed) return
          attempts = 0
          handlers.onStatusChange('connected', `WebSocket stream active (${wsUrl})`)
        }
        socket.onmessage = (msg) => {
          if (typeof msg.data === 'string') {
            parseAndDispatch(msg.data)
          }
        }
        socket.onerror = () => {
          if (disposed) return
          handlers.onStatusChange('error', 'WebSocket stream error')
        }
        socket.onclose = () => {
          scheduleReconnect('Backend event stream disconnected. Reconnecting...')
        }
      } catch (err) {
        scheduleReconnect(err instanceof Error ? err.message : 'WebSocket unavailable')
      }
      return
    }

    // Default SSE connection (HTTP/1.1 compatible for lightweight C++ servers like cpp-httplib / Crow)
    try {
      eventSource = new EventSource(API_CONFIG.eventsUrl)
      eventSource.onopen = () => {
        if (disposed) return
        attempts = 0
        handlers.onStatusChange('connected', `SSE stream active (${API_CONFIG.eventsUrl})`)
      }
      eventSource.onmessage = (msg) => {
        if (typeof msg.data === 'string') {
          parseAndDispatch(msg.data)
        }
      }
      eventSource.onerror = () => {
        if (disposed) return
        eventSource?.close()
        eventSource = null
        scheduleReconnect('EventSource offline — awaiting Member 2 C++ backend')
      }
    } catch (err) {
      scheduleReconnect(err instanceof Error ? err.message : 'SSE stream unavailable')
    }
  }

  connect()

  return () => {
    disposed = true
    cleanupTransport()
  }
}
