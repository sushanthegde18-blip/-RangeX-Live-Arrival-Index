import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  RangeXApiError,
  type AvlTreeSnapshot,
  type BackendRuntimeMode,
  type BackendStreamEvent,
  type ConnectionHealth,
  type IntervalRange,
  type PackageRegistrationRequest,
  type PackageRegistrationResult,
  type WarehouseAnalytics,
} from '../contracts/api'
import type { AvlVisualizerMutationCue } from '../contracts/avl'
import { VISUAL_FIXTURE_STORYBOARD } from '../fixtures/visualFixtures'
import { rangexApi } from '../services/rangexApi'
import { subscribeToBackendEvents } from '../services/rangexEvents'
import {
  RangeXContext,
  type ActivePackageAnimation,
  type RangeXContextValue,
  type TelemetryLogEntry,
} from './useRangeX'

function buildMutationCue(result: PackageRegistrationResult): AvlVisualizerMutationCue {
  return {
    eventId: result.eventId ?? `evt-${result.packageId}-${Date.now()}`,
    packageId: result.packageId,
    mutationType: result.mutationType,
    targetInterval: result.targetInterval,
    searchPath: result.searchPath,
    highlightedNodeIds: result.highlightedNodeIds,
    rotation: result.rotation,
    timestamp: result.timestamp,
  }
}

export function RangeXProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BackendRuntimeMode>('live')
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>('connecting')
  const [streamStatusMessage, setStreamStatusMessage] = useState<string>(
    'Initializing connection to Member 2 C++ backend...',
  )

  const [intervals, setIntervals] = useState<IntervalRange[]>([])
  const [previousIntervals, setPreviousIntervals] = useState<IntervalRange[]>([])
  const [avlSnapshot, setAvlSnapshot] = useState<AvlTreeSnapshot | null>(null)
  const [analytics, setAnalytics] = useState<WarehouseAnalytics | null>(null)
  const [lastArrival, setLastArrival] = useState<PackageRegistrationResult | null>(null)
  const [lastMutationCue, setLastMutationCue] = useState<AvlVisualizerMutationCue | null>(null)
  const [activeAnimation, setActiveAnimation] = useState<ActivePackageAnimation | null>(null)
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(null)

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [eventLogs, setEventLogs] = useState<TelemetryLogEntry[]>([])

  const [fixtureStepIndex, setFixtureStepIndex] = useState<number>(0)
  const modeRef = useRef<BackendRuntimeMode>(mode)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const appendLog = useCallback((entry: Omit<TelemetryLogEntry, 'id'>) => {
    setEventLogs((prev) => [
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ...prev.slice(0, 29),
    ])
  }, [])

  const applyConfirmedArrival = useCallback(
    (result: PackageRegistrationResult, source: 'BACKEND' | 'STREAM' | 'FIXTURE') => {
      const eventId = result.eventId ?? `arr-${result.packageId}-${Date.now()}`
      setPreviousIntervals(result.previousIntervals)
      setIntervals(result.intervals)
      if (result.avlSnapshot !== undefined) {
        setAvlSnapshot(result.avlSnapshot)
      }
      if (result.analytics !== undefined && result.analytics !== null) {
        setAnalytics(result.analytics)
      }
      setLastArrival(result)
      const cue = buildMutationCue({ ...result, eventId })
      setLastMutationCue(cue)
      setSelectedIntervalId(
        result.targetInterval.id ?? `${result.targetInterval.start}-${result.targetInterval.end}`,
      )
      setActiveAnimation({
        eventId,
        packageId: result.packageId,
        mutationType: result.mutationType,
        targetInterval: result.targetInterval,
        rotation: result.rotation,
        startedAt: Date.now(),
        isFixture: Boolean(result.isFixture),
      })

      const rotSummary =
        result.rotation && result.rotation.type !== 'NONE'
          ? ` | AVL Rotation: ${result.rotation.type}`
          : ' | No AVL rotation'

      appendLog({
        timestamp: result.timestamp,
        source,
        message: `PKG #${result.packageId} -> ${result.mutationType} [${result.targetInterval.start},${result.targetInterval.end}]${rotSummary}`,
      })
    },
    [appendLog],
  )

  const syncLiveBackend = useCallback(async () => {
    const [intervalsRes, avlRes, analyticsRes] = await Promise.allSettled([
      rangexApi.fetchIntervals(),
      rangexApi.fetchAvlSnapshot(),
      rangexApi.fetchAnalytics(),
    ])

    if (modeRef.current !== 'live') return

    const errors: string[] = []

    if (intervalsRes.status === 'fulfilled') {
      setIntervals(intervalsRes.value.intervals)
    } else {
      errors.push(
        intervalsRes.reason instanceof Error
          ? intervalsRes.reason.message
          : 'Failed to load intervals',
      )
    }

    if (avlRes.status === 'fulfilled') {
      setAvlSnapshot(avlRes.value)
    } else {
      errors.push(
        avlRes.reason instanceof Error
          ? avlRes.reason.message
          : 'Failed to load AVL tree snapshot',
      )
    }

    if (analyticsRes.status === 'fulfilled') {
      setAnalytics(analyticsRes.value)
    } else {
      errors.push(
        analyticsRes.reason instanceof Error
          ? analyticsRes.reason.message
          : 'Failed to load analytics',
      )
    }

    if (errors.length > 0) {
      setFetchError(errors[0])
      setConnectionHealth('offline')
      appendLog({
        timestamp: new Date().toISOString(),
        source: 'ERROR',
        message: 'Live backend poll failed',
        detail: errors[0],
      })
    } else {
      setFetchError(null)
      setConnectionHealth('connected')
      appendLog({
        timestamp: new Date().toISOString(),
        source: 'BACKEND',
        message: 'Synchronized intervals, AVL snapshot, and analytics from C++ backend',
      })
    }

    setIsInitialLoading(false)
  }, [appendLog])

  const refreshAllFromBackend = useCallback(async () => {
    if (modeRef.current !== 'live') return
    setIsInitialLoading(true)
    setFetchError(null)
    await syncLiveBackend()
  }, [syncLiveBackend])

  useEffect(() => {
    if (mode !== 'live') return

    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) {
        void syncLiveBackend()
      }
    })

    const unsubscribe = subscribeToBackendEvents({
      onStatusChange: (status, message) => {
        if (modeRef.current !== 'live') return
        setConnectionHealth(status)
        if (message) {
          setStreamStatusMessage(message)
        }
      },
      onEvent: (event: BackendStreamEvent) => {
        if (modeRef.current !== 'live') return
        if (event.type === 'PACKAGE_ARRIVED' && event.arrival) {
          applyConfirmedArrival(event.arrival, 'STREAM')
          return
        }
        if (event.type === 'INTERVALS_UPDATED' && event.intervals) {
          setIntervals((prev) => {
            setPreviousIntervals(prev)
            return event.intervals ?? prev
          })
          return
        }
        if (event.type === 'AVL_SNAPSHOT_UPDATED' && event.avlSnapshot) {
          setAvlSnapshot(event.avlSnapshot)
          return
        }
        if (event.type === 'ANALYTICS_UPDATED' && event.analytics) {
          setAnalytics(event.analytics)
        }
      },
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [mode, syncLiveBackend, applyConfirmedArrival])

  const submitPackageArrival = useCallback(
    async (request: PackageRegistrationRequest) => {
      if (mode === 'fixture') {
        setSubmitError(
          'Live submission is disabled inside Visual Fixture Mode. Switch to LIVE BACKEND to submit to Member 2 C++ API.',
        )
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await rangexApi.registerPackage(request)
        setConnectionHealth('connected')
        setFetchError(null)
        applyConfirmedArrival(result, 'BACKEND')

        if (!result.avlSnapshot || !result.analytics) {
          const [avlRes, analyticsRes] = await Promise.allSettled([
            !result.avlSnapshot
              ? rangexApi.fetchAvlSnapshot()
              : Promise.resolve(result.avlSnapshot),
            !result.analytics
              ? rangexApi.fetchAnalytics()
              : Promise.resolve(result.analytics),
          ])
          if (avlRes.status === 'fulfilled' && avlRes.value) {
            setAvlSnapshot(avlRes.value)
          }
          if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
            setAnalytics(analyticsRes.value)
          }
        }
      } catch (err) {
        const message =
          err instanceof RangeXApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Package registration failed.'
        setSubmitError(message)
        setConnectionHealth('offline')
        appendLog({
          timestamp: new Date().toISOString(),
          source: 'ERROR',
          message: `Rejected live submission for PKG #${request.packageId}`,
          detail: message,
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [mode, applyConfirmedArrival, appendLog],
  )

  const stepFixture = useCallback(
    (targetIndex: number) => {
      const clamped = Math.max(0, Math.min(VISUAL_FIXTURE_STORYBOARD.length - 1, targetIndex))
      const frame = VISUAL_FIXTURE_STORYBOARD[clamped]
      setFixtureStepIndex(clamped)
      setSubmitError(null)
      setFetchError(null)

      if (frame.arrivalResult) {
        setAvlSnapshot(frame.avlSnapshot)
        setAnalytics(frame.analytics)
        applyConfirmedArrival(frame.arrivalResult, 'FIXTURE')
      } else {
        setPreviousIntervals([])
        setIntervals(frame.intervals)
        setAvlSnapshot(frame.avlSnapshot)
        setAnalytics(frame.analytics)
        setLastArrival(null)
        setLastMutationCue(null)
        setActiveAnimation(null)
        setSelectedIntervalId(frame.intervals[0]?.id ?? null)
        appendLog({
          timestamp: new Date().toISOString(),
          source: 'FIXTURE',
          message: `Fixture loaded: ${frame.label}`,
        })
      }
    },
    [applyConfirmedArrival, appendLog],
  )

  const setMode = useCallback(
    (nextMode: BackendRuntimeMode) => {
      if (nextMode === mode) return
      setModeState(nextMode)
      setSubmitError(null)
      setFetchError(null)
      setActiveAnimation(null)

      if (nextMode === 'fixture') {
        setConnectionHealth('offline')
        setStreamStatusMessage('DEV FIXTURE PREVIEW ACTIVE — Static storyboard, not C++ backend')
        const baseline = VISUAL_FIXTURE_STORYBOARD[0]
        setFixtureStepIndex(0)
        setPreviousIntervals([])
        setIntervals(baseline.intervals)
        setAvlSnapshot(baseline.avlSnapshot)
        setAnalytics(baseline.analytics)
        setLastArrival(null)
        setLastMutationCue(null)
        setSelectedIntervalId(baseline.intervals[0]?.id ?? null)
        appendLog({
          timestamp: new Date().toISOString(),
          source: 'FIXTURE',
          message: 'Entered DEV FIXTURE PREVIEW mode (non-backend visual storyboard)',
        })
      } else {
        setIsInitialLoading(true)
        setIntervals([])
        setPreviousIntervals([])
        setAvlSnapshot(null)
        setAnalytics(null)
        setLastArrival(null)
        setLastMutationCue(null)
        setSelectedIntervalId(null)
        setConnectionHealth('connecting')
        setStreamStatusMessage('Connecting to Member 2 C++ backend...')
      }
    },
    [mode, appendLog],
  )

  const advanceFixture = useCallback(() => {
    const next = (fixtureStepIndex + 1) % VISUAL_FIXTURE_STORYBOARD.length
    stepFixture(next)
  }, [fixtureStepIndex, stepFixture])

  const resetFixture = useCallback(() => {
    stepFixture(0)
  }, [stepFixture])

  const clearActiveAnimation = useCallback((eventId: string) => {
    setActiveAnimation((curr) => (curr?.eventId === eventId ? null : curr))
  }, [])

  const currentFixtureFrame = VISUAL_FIXTURE_STORYBOARD[fixtureStepIndex]

  const value = useMemo<RangeXContextValue>(
    () => ({
      mode,
      setMode,
      connectionHealth,
      streamStatusMessage,
      intervals,
      previousIntervals,
      avlSnapshot,
      analytics,
      lastArrival,
      lastMutationCue,
      activeAnimation,
      clearActiveAnimation,
      selectedIntervalId,
      setSelectedIntervalId,
      highlightedNodeIds: lastMutationCue?.highlightedNodeIds ?? [],
      searchPath: lastMutationCue?.searchPath ?? [],
      activeRotation: lastMutationCue?.rotation ?? null,
      isInitialLoading,
      isSubmitting,
      fetchError,
      submitError,
      eventLogs,
      submitPackageArrival,
      refreshAllFromBackend,
      fixtureStepIndex,
      fixtureStepTotal: VISUAL_FIXTURE_STORYBOARD.length,
      fixtureLabel: currentFixtureFrame.label,
      fixtureDescription: currentFixtureFrame.description,
      stepFixture,
      advanceFixture,
      resetFixture,
    }),
    [
      mode,
      setMode,
      connectionHealth,
      streamStatusMessage,
      intervals,
      previousIntervals,
      avlSnapshot,
      analytics,
      lastArrival,
      lastMutationCue,
      activeAnimation,
      clearActiveAnimation,
      selectedIntervalId,
      isInitialLoading,
      isSubmitting,
      fetchError,
      submitError,
      eventLogs,
      submitPackageArrival,
      refreshAllFromBackend,
      fixtureStepIndex,
      currentFixtureFrame,
      stepFixture,
      advanceFixture,
      resetFixture,
    ],
  )

  return <RangeXContext.Provider value={value}>{children}</RangeXContext.Provider>
}
