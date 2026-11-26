export type EventTransportPreference = 'auto' | 'sse' | 'ws'

export interface ApiEndpointsConfig {
  baseUrl: string
  eventsUrl: string
  transport: EventTransportPreference
  requestTimeoutMs: number
  routes: {
    registerPackage: string
    intervals: string
    avlSnapshot: string
    analytics: string
    health: string
  }
}

const rawBaseUrl = (import.meta.env.VITE_RANGEX_API_BASE_URL as string | undefined) || '/api'
const normalizedBase = rawBaseUrl.replace(/\/+$/, '')

const rawEventsUrl =
  (import.meta.env.VITE_RANGEX_EVENTS_URL as string | undefined) || `${normalizedBase}/events`

const rawTransport = (import.meta.env.VITE_RANGEX_EVENT_TRANSPORT as string | undefined) || 'auto'

export const API_CONFIG: ApiEndpointsConfig = {
  baseUrl: normalizedBase,
  eventsUrl: rawEventsUrl,
  transport:
    rawTransport === 'sse' || rawTransport === 'ws' || rawTransport === 'auto'
      ? rawTransport
      : 'auto',
  requestTimeoutMs: 8000,
  routes: {
    registerPackage: '/packages/arrive',
    intervals: '/intervals',
    avlSnapshot: '/avl/snapshot',
    analytics: '/analytics',
    health: '/health',
  },
}

export function buildApiUrl(route: string): string {
  const cleanRoute = route.startsWith('/') ? route : `/${route}`
  return `${API_CONFIG.baseUrl}${cleanRoute}`
}
