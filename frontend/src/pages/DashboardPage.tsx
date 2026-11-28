import {
  Activity,
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  CopyCheck,
  Dices,
  Eye,
  GitBranch,
  GitMerge,
  Layers,
  Loader2,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Terminal,
  Trash2,
  WifiOff,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from 'react'
import { runStaggerReveal, tweenNumericValue } from '../animations/gsapTransitions'
import { WebGLErrorBoundary } from '../components/common/WebGLErrorBoundary'
import { WarehouseFallback2D } from '../components/warehouse/WarehouseFallback2D'
import type { WarehouseCameraPreset } from '../components/warehouse/WarehouseFloorCanvas'
import type { ArrivalPattern, IntervalMutationType } from '../contracts/api'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'
import { API_CONFIG } from '../services/apiConfig'
import { useRangeX } from '../state/useRangeX'
import type { AppRoute } from './LandingPage'

const WarehouseFloorCanvas = lazy(() => import('../components/warehouse/WarehouseFloorCanvas'))

const PRESETS: Array<{ id: WarehouseCameraPreset; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'scanner', label: 'Scanner Gate' },
  { id: 'racks', label: 'Storage Racks' },
  { id: 'intake', label: 'Intake Dock' },
]

function AnimatedNumber({ value, reducedMotion }: { value: number | null | undefined; reducedMotion: boolean }) {
  const [display, setDisplay] = useState<number>(value ?? 0)
  const trackerRef = useRef({ val: value ?? 0 })

  useEffect(() => {
    if (value == null) return
    const tween = tweenNumericValue(trackerRef.current, value, setDisplay, reducedMotion)
    return () => {
      tween?.kill()
    }
  }, [value, reducedMotion])

  if (value == null) return <>—</>
  return <>{display.toLocaleString()}</>
}

function mutationBannerTitle(type: IntervalMutationType): string {
  switch (type) {
    case 'MERGED':
      return 'INTERVAL MERGE DETECTED'
    case 'EXTENDED':
      return 'INTERVAL BOUNDARY EXTENDED'
    case 'CREATED':
      return 'NEW INTERVAL ALLOCATED'
    case 'DUPLICATE':
      return 'DUPLICATE PACKAGE DETECTED'
  }
}

function mutationBadgeStyle(type: IntervalMutationType): string {
  switch (type) {
    case 'CREATED':
      return 'border-[#38E8FF]/50 bg-[#38E8FF]/15 text-[#38E8FF]'
    case 'EXTENDED':
      return 'border-[#2E7BFF]/55 bg-[#2E7BFF]/20 text-[#9BC4FF]'
    case 'MERGED':
      return 'border-cyan-300/65 bg-cyan-400/20 text-cyan-200'
    case 'DUPLICATE':
      return 'border-amber-400/55 bg-amber-500/15 text-amber-200'
  }
}

export function DashboardPage({
  graphics,
  onNavigate,
}: {
  graphics: GraphicsCapabilities
  onNavigate: (route: AppRoute) => void
}) {
  const {
    mode,
    connectionHealth,
    streamStatusMessage,
    intervals,
    previousIntervals,
    analytics,
    lastArrival,
    activeAnimation,
    clearActiveAnimation,
    selectedIntervalId,
    setSelectedIntervalId,
    isInitialLoading,
    isSubmitting,
    fetchError,
    submitError,
    eventLogs,
    submitPackageArrival,
    simulateBatch,
    resetBackendIndex,
    refreshAllFromBackend,
  } = useRangeX()

  const pageRef = useRef<HTMLDivElement | null>(null)
  const [packageIdInput, setPackageIdInput] = useState('')
  const [priority, setPriority] = useState<'STANDARD' | 'EXPRESS' | 'COLD'>('STANDARD')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [simCount, setSimCount] = useState(12)
  const [simPattern, setSimPattern] = useState<ArrivalPattern>('random')

  const [cameraPreset, setCameraPreset] = useState<WarehouseCameraPreset>('overview')
  const [presetTrigger, setPresetTrigger] = useState(0)
  const [interactiveZoom, setInteractiveZoom] = useState(false)

  useEffect(() => {
    return runStaggerReveal(pageRef.current, '.dash-reveal', graphics.prefersReducedMotion)
  }, [graphics.prefersReducedMotion])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    const trimmed = packageIdInput.trim()
    if (!trimmed) {
      setValidationError('Enter a numeric Package ID (0 to 1,000,000,000).')
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000_000) {
      setValidationError('Package ID must be an integer between 0 and 1,000,000,000.')
      return
    }
    await submitPackageArrival({ packageId: parsed, priority })
    setPackageIdInput('')
  }

  const handleGenerateRandomAndAdd = async () => {
    setValidationError(null)
    const randomId = Math.floor(Math.random() * 60) + 1
    setPackageIdInput(String(randomId))
    await submitPackageArrival({ packageId: randomId, priority })
  }

  const handleSeedDemoSequence = async () => {
    setValidationError(null)
    await resetBackendIndex()
    for (const id of [1, 3, 7, 2, 6]) {
      await submitPackageArrival({ packageId: id, priority: 'STANDARD' })
    }
  }

  const use3D = graphics.resolvedTier !== 'fallback'

  const fallbackView = (
    <WarehouseFallback2D
      intervals={intervals}
      selectedIntervalId={selectedIntervalId}
      activeAnimation={activeAnimation}
      onSelectInterval={(interval) =>
        setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
      }
      reason={
        graphics.webglSupported
          ? '2D Warehouse Schematic Active'
          : 'WebGL Unavailable — 2D Schematic Fallback'
      }
    />
  )

  const kpis = [
    {
      label: 'Total Unique Packages',
      value: analytics?.totalPackages ?? null,
      icon: PackageCheck,
      accent: 'text-[#38E8FF]',
    },
    {
      label: 'Total Intervals',
      value: analytics?.activeIntervals ?? null,
      icon: Layers,
      accent: 'text-[#2E7BFF]',
    },
    {
      label: 'Missing Package Count',
      value: analytics?.missingCount ?? null,
      icon: AlertCircle,
      accent: 'text-amber-300',
    },
    {
      label: 'AVL Tree Height',
      value: analytics?.avlHeight ?? null,
      icon: GitBranch,
      accent: 'text-[#38E8FF]',
    },
    {
      label: 'Latest Package Arrival',
      value: analytics?.latestPackageId ?? null,
      prefix: '#',
      icon: Activity,
      accent: 'text-cyan-200',
    },
    {
      label: 'Duplicate Arrivals',
      value: analytics?.duplicateCount ?? null,
      icon: CopyCheck,
      accent: 'text-amber-400',
    },
  ]

  const systemStatusText =
    mode === 'fixture'
      ? 'FIXTURE PREVIEW'
      : connectionHealth === 'connected'
        ? analytics?.systemStatus ?? 'OPTIMAL'
        : connectionHealth.toUpperCase()

  return (
    <div ref={pageRef} className="min-h-screen bg-[#05070B] pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="dash-reveal mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>01 // Live Operations Dashboard</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Live Arrival Command Deck.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="studio-panel flex items-center gap-2 rounded-full px-4 py-2 font-mono-tech text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionHealth === 'connected'
                    ? 'bg-[#38E8FF] shadow-[0_0_10px_#38E8FF]'
                    : 'bg-rose-400'
                }`}
              />
              <span className="text-[#8E9FB8]">STATUS:</span>
              <span className="font-semibold text-white">{systemStatusText}</span>
            </div>

            <button
              type="button"
              onClick={() => void handleSeedDemoSequence()}
              disabled={isSubmitting || mode === 'fixture'}
              className="font-mono-tech inline-flex items-center gap-1.5 rounded-full border border-[#38E8FF]/40 bg-[#38E8FF]/12 px-4 py-2 text-xs uppercase tracking-wider text-[#38E8FF] transition-colors hover:bg-[#38E8FF]/22 disabled:opacity-45"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Run 1,3,7,2,6 Demo</span>
            </button>

            <button
              type="button"
              onClick={() => void resetBackendIndex()}
              disabled={isSubmitting || mode === 'fixture'}
              className="font-mono-tech inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-wider text-[#C8D3E3] transition-colors hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-45"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Index</span>
            </button>
          </div>
        </div>

        <div className="dash-reveal mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="studio-panel rounded-2xl p-4 transition-colors hover:border-[#38E8FF]/45"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.14em] text-[#7F8EA6]">
                    {kpi.label}
                  </span>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${kpi.accent}`} />
                </div>
                <div className="font-display mt-2.5 text-2xl font-bold text-white sm:text-3xl">
                  {kpi.value != null && kpi.prefix ? kpi.prefix : ''}
                  <AnimatedNumber value={kpi.value} reducedMotion={graphics.prefersReducedMotion} />
                </div>
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {lastArrival && (
            <motion.div
              key={lastArrival.eventId ?? `${lastArrival.packageId}-${lastArrival.timestamp}`}
              initial={graphics.prefersReducedMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="studio-panel mb-6 rounded-2xl border-[#38E8FF]/35 p-5"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5 font-mono-tech text-xs">
                    <span className="rounded-md bg-[#38E8FF]/15 px-2.5 py-1 font-bold text-[#38E8FF]">
                      PACKAGE RECEIVED: {lastArrival.packageId}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${mutationBadgeStyle(
                        lastArrival.mutationType,
                      )}`}
                    >
                      {mutationBannerTitle(lastArrival.mutationType)}
                    </span>
                    {lastArrival.rotation && lastArrival.rotation.type !== 'NONE' && (
                      <span className="rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-0.5 text-[11px] text-amber-200">
                        AVL ROTATION: {lastArrival.rotation.type}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 font-mono-tech text-xs">
                    <span className="text-[#7F8EA6]">BEFORE:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(lastArrival.mergedFrom && lastArrival.mergedFrom.length > 0
                        ? lastArrival.mergedFrom
                        : previousIntervals
                      ).length === 0 ? (
                        <span className="text-[#64748B]">[]</span>
                      ) : (
                        (lastArrival.mergedFrom && lastArrival.mergedFrom.length > 0
                          ? lastArrival.mergedFrom
                          : previousIntervals
                        )
                          .slice(0, 8)
                          .map((iv) => (
                            <span
                              key={`b-${iv.start}-${iv.end}`}
                              className="rounded border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[#9BAAC0]"
                            >
                              [{iv.start},{iv.end}]
                            </span>
                          ))
                      )}
                    </div>

                    <ArrowRight className="h-4 w-4 text-[#38E8FF]" />

                    <span className="text-[#38E8FF]">AFTER:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {intervals.slice(0, 8).map((iv) => {
                        const isTarget =
                          iv.start === lastArrival.targetInterval.start &&
                          iv.end === lastArrival.targetInterval.end
                        return (
                          <span
                            key={`a-${iv.start}-${iv.end}`}
                            className={`rounded border px-2 py-0.5 font-semibold ${
                              isTarget
                                ? 'border-[#38E8FF] bg-[#38E8FF]/20 text-[#38E8FF]'
                                : 'border-white/12 bg-white/[0.04] text-white'
                            }`}
                          >
                            [{iv.start},{iv.end}]
                          </span>
                        )
                      })}
                      {intervals.length > 8 && (
                        <span className="text-[#7F8EA6]">+{intervals.length - 8} more</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('avl')}
                    className="font-mono-tech inline-flex items-center gap-1.5 rounded-full border border-[#2E7BFF]/50 bg-[#2E7BFF]/20 px-4 py-2 text-[11px] uppercase tracking-wider text-white hover:bg-[#2E7BFF]/35"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-[#38E8FF]" />
                    <span>Inspect in 3D AVL</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="dash-reveal grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="studio-panel relative overflow-hidden rounded-3xl lg:col-span-7 xl:col-span-8">
            <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#060910]/80 px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono-tech mr-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
                  <Camera className="h-3.5 w-3.5 text-[#38E8FF]" />
                  Cam
                </span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCameraPreset(preset.id)
                      setPresetTrigger((n) => n + 1)
                    }}
                    className={`font-mono-tech rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                      cameraPreset === preset.id
                        ? 'border border-[#38E8FF]/50 bg-[#38E8FF]/15 text-[#38E8FF]'
                        : 'border border-white/10 bg-white/[0.03] text-[#9BAAC0] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {use3D && (
                  <button
                    type="button"
                    onClick={() => setInteractiveZoom((z) => !z)}
                    className={`font-mono-tech inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                      interactiveZoom
                        ? 'border-[#2E7BFF]/60 bg-[#2E7BFF]/20 text-white'
                        : 'border-white/10 bg-white/[0.03] text-[#9BAAC0] hover:text-white'
                    }`}
                  >
                    {interactiveZoom ? (
                      <>
                        <ZoomIn className="h-3 w-3 text-[#38E8FF]" />
                        <span>Wheel Zoom On</span>
                      </>
                    ) : (
                      <>
                        <ZoomOut className="h-3 w-3" />
                        <span>Scroll Safe</span>
                      </>
                    )}
                  </button>
                )}

                <span className="font-mono-tech rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#9BAAC0]">
                  {intervals.length} BAYS ACTIVE
                </span>
              </div>
            </div>

            <div className="h-[440px] w-full sm:h-[520px] lg:h-[600px]">
              {use3D ? (
                <WebGLErrorBoundary fallback={fallbackView}>
                  <Suspense fallback={fallbackView}>
                    <WarehouseFloorCanvas
                      graphics={graphics}
                      intervals={intervals}
                      selectedIntervalId={selectedIntervalId}
                      activeAnimation={activeAnimation}
                      cameraPreset={cameraPreset}
                      presetTrigger={presetTrigger}
                      interactiveZoom={interactiveZoom}
                      onSelectInterval={(interval) =>
                        setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
                      }
                      onAnimationComplete={clearActiveAnimation}
                    />
                  </Suspense>
                </WebGLErrorBoundary>
              ) : (
                fallbackView
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#060910]/90 px-4 py-2.5">
              <div className="font-mono-tech flex items-center gap-2 text-[11px] text-[#9BAAC0]">
                <Eye className="h-3.5 w-3.5 text-[#38E8FF]" />
                {activeAnimation ? (
                  <span className="text-[#38E8FF]">
                    ROUTING: PKG #{activeAnimation.packageId} → [
                    {activeAnimation.targetInterval.start}, {activeAnimation.targetInterval.end}] (
                    {activeAnimation.mutationType})
                  </span>
                ) : (
                  <span>Drag to orbit warehouse · Click any storage rack to inspect interval</span>
                )}
              </div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                RENDER: {graphics.resolvedTier.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <div className="studio-panel rounded-3xl p-6">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#38E8FF]">
                    02 // Package Arrival System
                  </div>
                  <h2 className="font-display mt-1 text-2xl font-bold text-white">
                    Dispatch Package
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshAllFromBackend()}
                  disabled={mode === 'fixture' || isInitialLoading}
                  title="Sync state from C++ engine"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#C8D3E3] hover:border-[#38E8FF]/50 hover:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${isInitialLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    id="rangex-package-id"
                    type="number"
                    min={0}
                    max={1000000000}
                    step={1}
                    placeholder="Package ID (e.g. 4)"
                    value={packageIdInput}
                    onChange={(e) => setPackageIdInput(e.target.value)}
                    className="font-mono-tech w-full rounded-xl border border-white/15 bg-[#070A10] px-4 py-3 text-sm text-white placeholder-[#526077] focus:border-[#38E8FF] focus:outline-none"
                  />
                  <select
                    aria-label="Package priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'STANDARD' | 'EXPRESS' | 'COLD')}
                    className="font-mono-tech rounded-xl border border-white/15 bg-[#070A10] px-3 py-3 text-xs text-[#C8D3E3] focus:border-[#38E8FF] focus:outline-none"
                  >
                    <option value="STANDARD">STD</option>
                    <option value="EXPRESS">EXP</option>
                    <option value="COLD">CLD</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#38E8FF]/55 bg-gradient-to-r from-[#2E7BFF] to-[#1D5AE0] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_0_25px_-6px_rgba(46,123,255,0.75)] transition-all hover:brightness-110 disabled:opacity-55"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PackagePlus className="h-4 w-4" />
                    )}
                    <span>Add Package</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleGenerateRandomAndAdd()}
                    disabled={isSubmitting}
                    className="font-mono-tech flex items-center justify-center gap-2 rounded-xl border border-[#38E8FF]/35 bg-[#0E1828] px-3 py-3 text-[11px] uppercase tracking-wider text-[#38E8FF] transition-colors hover:bg-[#132238] disabled:opacity-55"
                  >
                    <Dices className="h-4 w-4" />
                    <span>Random ID</span>
                  </button>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>{validationError}</span>
                  </div>
                )}

                {(submitError || fetchError || (mode === 'live' && connectionHealth === 'offline')) && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 p-3 text-xs text-rose-200">
                    <div className="mb-1 flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-rose-300">
                      <WifiOff className="h-3.5 w-3.5" />
                      <span>C++ Backend Offline</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-200/90">
                      {submitError ||
                        fetchError ||
                        `Start rangex_backend.exe on port 8080 (${API_CONFIG.baseUrl}).`}
                    </p>
                  </div>
                )}
              </form>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="font-mono-tech mb-2.5 text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                  Simulate Multiple Arrivals
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Simulation count"
                    value={simCount}
                    onChange={(e) => setSimCount(Number(e.target.value))}
                    className="font-mono-tech rounded-xl border border-white/12 bg-[#070A10] px-3 py-2 text-xs text-[#C8D3E3]"
                  >
                    <option value={5}>5 Packages</option>
                    <option value={12}>12 Packages</option>
                    <option value={30}>30 Packages</option>
                    <option value={100}>100 Packages</option>
                  </select>
                  <select
                    aria-label="Simulation pattern"
                    value={simPattern}
                    onChange={(e) => setSimPattern(e.target.value as ArrivalPattern)}
                    className="font-mono-tech rounded-xl border border-white/12 bg-[#070A10] px-3 py-2 text-xs text-[#C8D3E3]"
                  >
                    <option value="random">Random</option>
                    <option value="sequential">Sequential</option>
                    <option value="spaced">Widely Spaced</option>
                    <option value="duplicate-heavy">Duplicate-Heavy</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting || mode === 'fixture'}
                  onClick={() =>
                    void simulateBatch({
                      count: simCount,
                      pattern: simPattern,
                      minId: 1,
                      maxId: Math.max(80, simCount * 4),
                    })
                  }
                  className="font-mono-tech mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs uppercase tracking-wider text-white transition-colors hover:border-[#38E8FF]/50 hover:bg-[#38E8FF]/10 disabled:opacity-45"
                >
                  <GitMerge className="h-3.5 w-3.5 text-[#38E8FF]" />
                  <span>Simulate Batch</span>
                </button>
              </div>
            </div>

            <div className="studio-panel flex flex-1 flex-col rounded-3xl p-5">
              <div className="mb-3 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-[#38E8FF]" />
                  Live Activity Feed
                </span>
                <span className="max-w-[160px] truncate" title={streamStatusMessage}>
                  {connectionHealth === 'connected' ? 'WS LIVE' : connectionHealth.toUpperCase()}
                </span>
              </div>

              <div className="max-h-60 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#05070B] p-3 font-mono-tech text-[11px]">
                {eventLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-8 text-center text-[#5E6D85]">
                    Awaiting real-time arrival events from C++ AVL engine...
                  </div>
                ) : (
                  eventLogs.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 leading-snug">
                      <span
                        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          entry.source === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-300'
                            : entry.source === 'FIXTURE'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-[#2E7BFF]/20 text-[#8EC2FF]'
                        }`}
                      >
                        {entry.source}
                      </span>
                      <span className="text-[#C8D3E3]">{entry.message}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono-tech text-[11px] text-[#7F8EA6]">
                <span>Active Intervals: {intervals.length}</span>
                <button
                  type="button"
                  onClick={() => onNavigate('intervals')}
                  className="inline-flex items-center gap-1 text-[#38E8FF] hover:underline"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Explore Gaps</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
