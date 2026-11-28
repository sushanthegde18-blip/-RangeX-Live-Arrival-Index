export type BackendRuntimeMode = 'live' | 'fixture'

export type IntervalMutationType = 'CREATED' | 'EXTENDED' | 'MERGED' | 'DUPLICATE'

export type AvlRotationType = 'NONE' | 'LL' | 'RR' | 'LR' | 'RL'

export interface IntervalRange {
  id?: string
  nodeId?: string | number
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
  truncated?: boolean
  revision?: number
  updatedAt?: string
}

export interface RotationStepTrace {
  type: AvlRotationType
  pivotNodeId?: string | number | null
  pivotBalanceFactor?: number
  affectedNodeIds?: Array<string | number>
  reason?: string
  preRotationSnapshot?: AvlTreeSnapshot | null
  intermediateSnapshot?: AvlTreeSnapshot | null
  afterSnapshot?: AvlTreeSnapshot | null
}

export interface AvlOperationTrace {
  beforeSnapshot?: AvlTreeSnapshot | null
  preBalanceSnapshot?: AvlTreeSnapshot | null
  rotationSteps?: RotationStepTrace[]
  finalSnapshot?: AvlTreeSnapshot | null
  elapsedMicros?: number
}

export interface ThroughputSample {
  timestamp: string
  arrivals: number
  merges: number
}

export interface WarehouseAnalytics {
  totalPackages: number
  totalUniquePackages?: number
  activeIntervals: number
  totalIntervals?: number
  missingCount?: number
  duplicateCount?: number
  mergedCount: number
  extendedCount: number
  createdCount: number
  compressionRatio: number
  avlHeight: number
  rotationCount: number
  llRotations?: number
  rrRotations?: number
  lrRotations?: number
  rlRotations?: number
  avgLookupMicros?: number | null
  avgInsertMicros?: number | null
  minId?: number | null
  maxId?: number | null
  latestPackageId?: number | null
  systemStatus?: string
  recentThroughput?: ThroughputSample[]
  revision?: number
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
  trace?: AvlOperationTrace | null
  avlSnapshot?: AvlTreeSnapshot | null
  analytics?: WarehouseAnalytics | null
  timestamp: string
  eventId?: string
  isFixture?: boolean
}

export interface IntervalsResponse {
  intervals: IntervalRange[]
  totalCount?: number
  missingCount?: number
  minId?: number | null
  maxId?: number | null
  truncated?: boolean
  revision?: number
  updatedAt?: string
}

export interface MissingRangeItem {
  start: number
  end: number
  count: number
}

export interface GapsResponse {
  start: number
  end: number
  missingIntervals: MissingRangeItem[]
  totalMissingIntervals: number
  truncated: boolean
  missingCount: number
  presentCount: number
  updatedAt?: string
}

export interface ReplayEventRecord {
  seq: number
  eventId: string
  timestamp: string
  packageId: number
  mutationType: IntervalMutationType
  targetInterval: IntervalRange
  previousIntervals?: IntervalRange[]
  intervals: IntervalRange[]
  mergedFrom?: IntervalRange[]
  rotation?: AvlRotationEvent | null
  searchPath?: Array<string | number>
  avlSnapshot?: AvlTreeSnapshot | null
  analytics?: WarehouseAnalytics | null
}

export interface EventsHistoryResponse {
  events: ReplayEventRecord[]
  totalCount: number
  offset: number
}

export type ArrivalPattern = 'random' | 'sequential' | 'spaced' | 'duplicate-heavy'

export interface SimulateRequest {
  count: number
  pattern: ArrivalPattern
  minId?: number
  maxId?: number
}

export interface SimulateResponse {
  simulatedCount: number
  pattern: string
  uniqueAdded: number
  duplicates: number
  merges: number
  generatedIds: number[]
  latestArrival?: PackageRegistrationResult | null
  intervals: IntervalRange[]
  avlSnapshot: AvlTreeSnapshot
  analytics: WarehouseAnalytics
}

export interface BulkArrivalsRequest {
  packageIds?: number[]
  count?: number
  pattern?: ArrivalPattern
  minId?: number
  maxId?: number
  benchmarkOnly?: boolean
}

export interface BenchmarkResponse {
  mode: string
  benchmarkOnly: boolean
  count: number
  pattern: string
  uniqueIds?: number
  duplicateCount?: number
  activeIntervals?: number
  avlHeight?: number
  rotationCount?: number
  llRotations?: number
  rrRotations?: number
  lrRotations?: number
  rlRotations?: number
  insertTotalMs: number
  avgInsertMicros: number
  insertThroughputOpsSec?: number
  lookupQueries?: number
  lookupHits?: number
  lookupTotalMs?: number
  avgLookupMicros?: number
  compressionRatio?: number
  invariantsValid?: boolean
  intervals?: IntervalRange[]
  avlSnapshot?: AvlTreeSnapshot
  analytics?: WarehouseAnalytics
  timestamp?: string
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
