/**
 * Canonical TypeScript API contracts for RANGEX Member 2 (C++ Backend).
 *
 * Notice: No AVL algorithms or fake backend insertion logic live in the frontend.
 * Every state transition in Live mode is driven exclusively by confirmed
 * backend responses or verified backend stream events.
 */

export type BackendRuntimeMode = 'live' | 'fixture'

export type IntervalMutationType = 'CREATED' | 'EXTENDED' | 'MERGED' | 'DUPLICATE'

export type AvlRotationType = 'NONE' | 'LL' | 'RR' | 'LR' | 'RL'

export interface IntervalRange {
  id?: string
  start: number
  end: number
  zone?: string
  packageCount?: number
  lastUpdatedAt?: string
}

export interface AvlRotationEvent {
  type: AvlRotationType
  pivotNodeId?: string | number | null
  affectedNodeIds?: Array<string | number>
  reason?: string
}

export interface AvlNodeSnapshot {
  id: string | number
  interval: IntervalRange
  height: number
  balanceFactor: number
  leftId?: string | number | null
  rightId?: string | number | null
  parentId?: string | number | null
  depth?: number
}

export interface AvlTreeSnapshot {
  rootId: string | number | null
  nodes: AvlNodeSnapshot[]
  height: number
  nodeCount: number
  revision?: number
  updatedAt?: string
}

export interface ThroughputSample {
  timestamp: string
  arrivals: number
  merges: number
}

export interface WarehouseAnalytics {
  totalPackages: number
  activeIntervals: number
  mergedCount: number
  extendedCount: number
  createdCount: number
  compressionRatio: number
  avlHeight: number
  rotationCount: number
  avgLookupMicros?: number | null
  minId?: number | null
  maxId?: number | null
  recentThroughput?: ThroughputSample[]
  updatedAt?: string
}

export interface PackageRegistrationRequest {
  packageId: number
  priority?: 'STANDARD' | 'EXPRESS' | 'COLD'
  label?: string
}

export interface PackageRegistrationResult {
  packageId: number
  mutationType: IntervalMutationType
  targetInterval: IntervalRange
  previousIntervals: IntervalRange[]
  intervals: IntervalRange[]
  mergedFrom?: IntervalRange[]
  searchPath: Array<string | number>
  highlightedNodeIds: Array<string | number>
  rotation: AvlRotationEvent | null
  avlSnapshot?: AvlTreeSnapshot | null
  analytics?: WarehouseAnalytics | null
  timestamp: string
  eventId?: string
  /** Strictly false for real backend responses; true only in opt-in UI visual fixture preview. */
  isFixture?: boolean
}

export interface IntervalsResponse {
  intervals: IntervalRange[]
  revision?: number
  updatedAt?: string
}

export type BackendEventType =
  | 'PACKAGE_ARRIVED'
  | 'INTERVALS_UPDATED'
  | 'AVL_SNAPSHOT_UPDATED'
  | 'ANALYTICS_UPDATED'
  | 'HEARTBEAT'

export interface BackendStreamEvent {
  type: BackendEventType
  timestamp: string
  eventId?: string
  arrival?: PackageRegistrationResult
  intervals?: IntervalRange[]
  avlSnapshot?: AvlTreeSnapshot
  analytics?: WarehouseAnalytics
}

export type ConnectionHealth = 'connecting' | 'connected' | 'offline' | 'error'

export class RangeXApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly endpoint: string
  readonly details?: unknown

  constructor(
    message: string,
    options: {
      status?: number | null
      code?: string
      endpoint: string
      details?: unknown
    },
  ) {
    super(message)
    this.name = 'RangeXApiError'
    this.status = options.status ?? null
    this.code = options.code ?? 'API_ERROR'
    this.endpoint = options.endpoint
    this.details = options.details
  }
}
