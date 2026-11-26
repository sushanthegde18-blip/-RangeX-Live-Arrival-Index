import {
  RangeXApiError,
  type AvlRotationEvent,
  type AvlTreeSnapshot,
  type IntervalMutationType,
  type IntervalRange,
  type IntervalsResponse,
  type PackageRegistrationRequest,
  type PackageRegistrationResult,
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
        'Backend returned non-JSON payload (expected Member 2 C++ JSON API response).',
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
    start,
    end,
    zone: typeof obj.zone === 'string' ? obj.zone : undefined,
    packageCount: typeof obj.packageCount === 'number' ? obj.packageCount : undefined,
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

/**
 * Centralized API layer for Member 2's C++ Backend.
 * Every method performs real network calls and surfaces true failures—
 * never returning fabricated success results.
 */
export const rangexApi = {
  async registerPackage(payload: PackageRegistrationRequest): Promise<PackageRegistrationResult> {
    const raw = await requestJson<Record<string, unknown>>(API_CONFIG.routes.registerPackage, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const endpoint = buildApiUrl(API_CONFIG.routes.registerPackage)
    try {
      const intervals = Array.isArray(raw.intervals) ? raw.intervals.map(normalizeInterval) : []
      const previousIntervals = Array.isArray(raw.previousIntervals)
        ? raw.previousIntervals.map(normalizeInterval)
        : []
      const targetInterval = normalizeInterval(raw.targetInterval)
      const mutationType = normalizeMutationType(raw.mutationType)

      return {
        packageId: Number(raw.packageId ?? payload.packageId),
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
        avlSnapshot: (raw.avlSnapshot as AvlTreeSnapshot | null | undefined) ?? null,
        analytics: (raw.analytics as WarehouseAnalytics | null | undefined) ?? null,
        timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
        eventId: typeof raw.eventId === 'string' ? raw.eventId : undefined,
        isFixture: false,
      }
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

  async fetchIntervals(): Promise<IntervalsResponse> {
    const raw = await requestJson<Record<string, unknown>>(API_CONFIG.routes.intervals)
    const intervals = Array.isArray(raw.intervals) ? raw.intervals.map(normalizeInterval) : []
    return {
      intervals,
      revision: typeof raw.revision === 'number' ? raw.revision : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    }
  },

  async fetchAvlSnapshot(): Promise<AvlTreeSnapshot> {
    return await requestJson<AvlTreeSnapshot>(API_CONFIG.routes.avlSnapshot)
  },

  async fetchAnalytics(): Promise<WarehouseAnalytics> {
    return await requestJson<WarehouseAnalytics>(API_CONFIG.routes.analytics)
  },

  async checkHealth(): Promise<{ status: string; version?: string }> {
    return await requestJson<{ status: string; version?: string }>(API_CONFIG.routes.health, undefined, 3000)
  },
}
