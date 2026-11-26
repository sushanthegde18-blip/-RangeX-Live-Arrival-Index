import { createContext, useContext } from 'react'
import type {
  AvlRotationEvent,
  AvlTreeSnapshot,
  BackendRuntimeMode,
  ConnectionHealth,
  IntervalRange,
  PackageRegistrationRequest,
  PackageRegistrationResult,
  WarehouseAnalytics,
} from '../contracts/api'
import type { AvlVisualizerMutationCue } from '../contracts/avl'

export interface TelemetryLogEntry {
  id: string
  timestamp: string
  source: 'BACKEND' | 'STREAM' | 'FIXTURE' | 'ERROR'
  message: string
  detail?: string
}

export interface ActivePackageAnimation {
  eventId: string
  packageId: number
  mutationType: PackageRegistrationResult['mutationType']
  targetInterval: IntervalRange
  rotation: AvlRotationEvent | null
  startedAt: number
  isFixture: boolean
}

export interface RangeXContextValue {
  mode: BackendRuntimeMode
  setMode: (mode: BackendRuntimeMode) => void
  connectionHealth: ConnectionHealth
  streamStatusMessage: string
  intervals: IntervalRange[]
  previousIntervals: IntervalRange[]
  avlSnapshot: AvlTreeSnapshot | null
  analytics: WarehouseAnalytics | null
  lastArrival: PackageRegistrationResult | null
  lastMutationCue: AvlVisualizerMutationCue | null
  activeAnimation: ActivePackageAnimation | null
  clearActiveAnimation: (eventId: string) => void
  selectedIntervalId: string | null
  setSelectedIntervalId: (id: string | null) => void
  highlightedNodeIds: Array<string | number>
  searchPath: Array<string | number>
  activeRotation: AvlRotationEvent | null
  isInitialLoading: boolean
  isSubmitting: boolean
  fetchError: string | null
  submitError: string | null
  eventLogs: TelemetryLogEntry[]
  submitPackageArrival: (request: PackageRegistrationRequest) => Promise<void>
  refreshAllFromBackend: () => Promise<void>
  fixtureStepIndex: number
  fixtureStepTotal: number
  fixtureLabel: string
  fixtureDescription: string
  stepFixture: (targetIndex: number) => void
  advanceFixture: () => void
  resetFixture: () => void
}

export const RangeXContext = createContext<RangeXContextValue | null>(null)

export function useRangeX() {
  const ctx = useContext(RangeXContext)
  if (!ctx) {
    throw new Error('useRangeX must be used inside RangeXProvider')
  }
  return ctx
}
