export type EventTransportPreference = 'auto' | 'sse' | 'ws'

export interface ApiEndpointsConfig {
  baseUrl: string
  eventsUrl: string
  transport: EventTransportPreference
  requestTimeoutMs: number
  routes: {
    registerPackage: string
    intervals: string
    gaps: string
    stats: string
    tree: string
    events: string
    simulate: string
    bulkArrivals: string
    reset: string
    health: string
  }
}

const rawBaseUrl = (import.meta.env.VITE_RANGEX_API_BASE_URL as string | undefined) || '/api'
const normalizedBase = rawBaseUrl.replace(/\/+$/, '')

const rawEventsUrl = (import.meta.env.VITE_RANGEX_EVENTS_URL as string | undefined) || '/ws'
const rawTransport = (import.meta.env.VITE_RANGEX_EVENT_TRANSPORT as string | undefined) || 'ws'

export const API_CONFIG: ApiEndpointsConfig = {
  baseUrl: normalizedBase,
  eventsUrl: rawEventsUrl,
  transport:
    rawTransport === 'sse' || rawTransport === 'ws' || rawTransport === 'auto'
      ? rawTransport
      : 'ws',
  requestTimeoutMs: 15000,
  routes: {
    registerPackage: '/packages',
    intervals: '/intervals',
    gaps: '/gaps',
    stats: '/stats',
    tree: '/tree',
    events: '/events',
    simulate: '/simulate',
    bulkArrivals: '/bulk-arrivals',
    reset: '/reset',
    health: '/health',
  },
}

export function buildApiUrl(route: string): string {
  const cleanRoute = route.startsWith('/') ? route : `/${route}`
  return `${API_CONFIG.baseUrl}${cleanRoute}`
}
