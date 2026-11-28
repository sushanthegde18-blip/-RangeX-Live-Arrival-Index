import {
  Camera,
  GitBranch,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SkipForward,
  Sparkles,
  StepBack,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Suspense, lazy, useEffect, useMemo, useState, type FormEvent } from 'react'
import { WebGLErrorBoundary } from '../components/common/WebGLErrorBoundary'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'
import { useRangeX } from '../state/useRangeX'
import { buildAvlOperationTimeline } from '../visualization/avlTimeline'
import type { AvlCameraPreset, AvlTimelineStage } from '../visualization/AvlTree3DCanvas'

const AvlTree3DCanvas = lazy(() => import('../visualization/AvlTree3DCanvas'))

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2]

function Avl2DFallback({
  stage,
  onSelectNode,
}: {
  stage: AvlTimelineStage | null
  onSelectNode?: (id: string | number) => void
}) {
  const snapshot = stage?.snapshot ?? null
  const nodesByDepth = useMemo(() => {
    if (!snapshot) return []
    const map = new Map<number, typeof snapshot.nodes>()
    for (const n of snapshot.nodes) {
      const d = n.depth ?? 0
      const list = map.get(d) ?? []
      list.push(n)
      map.set(d, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [snapshot])

  if (!snapshot || snapshot.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <GitBranch className="mb-3 h-8 w-8 text-[#55647B]" />
        <p className="font-display text-lg text-white">AVL Tree Empty</p>
        <p className="mt-1 text-xs text-[#8E9FB8]">Insert a package or trigger a rotation demo below.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto p-6">
      {nodesByDepth.map(([depth, nodes]) => (
        <div key={depth} className="flex flex-wrap items-center justify-center gap-3">
          {nodes.map((node) => {
            const isPivot = stage?.imbalancedNodeId != null && String(stage.imbalancedNodeId) === String(node.id)
            const isActive = (stage?.activeNodeIds ?? []).map(String).includes(String(node.id))
            return (
              <button
                key={String(node.id)}
                type="button"
                onClick={() => onSelectNode?.(node.id)}
                className={`min-w-[140px] rounded-xl border p-3 text-left font-mono-tech transition-all ${
                  isPivot
                    ? 'border-amber-400 bg-amber-500/20'
                    : isActive
                      ? 'border-[#38E8FF] bg-[#38E8FF]/15'
                      : 'border-white/15 bg-[#0A0F18]'
                }`}
              >
                <div className="flex justify-between text-[10px] text-[#7F8EA6]">
                  <span>#{node.id}</span>
                  <span>BF:{node.balanceFactor}</span>
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  [{node.interval.start}, {node.interval.end}]
                </div>
                <div className="mt-1 text-[10px] text-[#8E9FB8]">H:{node.height}</div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function AvlVisualizerPage({ graphics }: { graphics: GraphicsCapabilities }) {
  const {
    avlSnapshot,
    lastArrival,
    lastTrace,
    mode,
    isSubmitting,
    submitPackageArrival,
    resetBackendIndex,
    setSelectedIntervalId,
    clearActiveAnimation,
  } = useRangeX()

  const stages = useMemo(
    () => buildAvlOperationTimeline(avlSnapshot, lastArrival, lastTrace),
    [avlSnapshot, lastArrival, lastTrace],
  )

  const [playbackState, setPlaybackState] = useState<{
    eventId: string | null
    stageIndex: number
    isPlaying: boolean
  }>({
    eventId: lastArrival?.eventId ?? null,
    stageIndex: 0,
    isPlaying: false,
  })
  const [speed, setSpeed] = useState(1)
  const [cameraPreset, setCameraPreset] = useState<AvlCameraPreset>('front')
  const [presetTrigger, setPresetTrigger] = useState(0)
  const [zoomCommand, setZoomCommand] = useState<{ dir: 'in' | 'out'; seq: number }>({ dir: 'in', seq: 0 })
  const [interactiveZoom, setInteractiveZoom] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | number | null>(null)
  const [quickId, setQuickId] = useState('')

  const currentEventId = lastArrival?.eventId ?? null
  const stageIndex =
    playbackState.eventId === currentEventId
      ? Math.min(playbackState.stageIndex, Math.max(0, stages.length - 1))
      : 0
  const isPlaying =
    playbackState.eventId === currentEventId
      ? playbackState.isPlaying
      : stages.length > 1 && !graphics.prefersReducedMotion

  const setStageIndex = (updater: number | ((prev: number) => number)) => {
    setPlaybackState((prev) => {
      const baseIndex = prev.eventId === currentEventId ? prev.stageIndex : 0
      const nextIndex = typeof updater === 'function' ? updater(baseIndex) : updater
      return {
        eventId: currentEventId,
        stageIndex: nextIndex,
        isPlaying: prev.eventId === currentEventId ? prev.isPlaying : false,
      }
    })
  }

  const setIsPlaying = (updater: boolean | ((prev: boolean) => boolean)) => {
    setPlaybackState((prev) => {
      const baseIndex = prev.eventId === currentEventId ? prev.stageIndex : 0
      const basePlay =
        prev.eventId === currentEventId
          ? prev.isPlaying
          : stages.length > 1 && !graphics.prefersReducedMotion
      const nextPlay = typeof updater === 'function' ? updater(basePlay) : updater
      return { eventId: currentEventId, stageIndex: baseIndex, isPlaying: nextPlay }
    })
  }

  useEffect(() => {
    if (!isPlaying || stages.length <= 1) return
    const intervalMs = Math.max(320, Math.round(1350 / speed))
    const timer = window.setTimeout(() => {
      if (stageIndex >= stages.length - 1) {
        setPlaybackState({
          eventId: currentEventId,
          stageIndex,
          isPlaying: false,
        })
        if (currentEventId) {
          clearActiveAnimation(currentEventId)
        }
      } else {
        setPlaybackState({
          eventId: currentEventId,
          stageIndex: Math.min(stages.length - 1, stageIndex + 1),
          isPlaying: true,
        })
      }
    }, intervalMs)
    return () => window.clearTimeout(timer)
  }, [isPlaying, stageIndex, stages.length, speed, currentEventId, clearActiveAnimation])

  const activeStage = stages[Math.min(stageIndex, Math.max(0, stages.length - 1))] ?? null
  const use3D = graphics.resolvedTier !== 'fallback'

  const handleQuickInsert = async (e: FormEvent) => {
    e.preventDefault()
    const val = Number(quickId.trim())
    if (!Number.isInteger(val) || val < 0 || val > 1_000_000_000) return
    await submitPackageArrival({ packageId: val, priority: 'STANDARD' })
    setQuickId('')
  }

  const triggerRealRotation = async (kind: 'LL' | 'RR' | 'LR' | 'RL') => {
    if (mode === 'fixture') return
    await resetBackendIndex()
    const seq =
      kind === 'LL'
        ? [30, 20, 10]
        : kind === 'RR'
          ? [10, 20, 30]
          : kind === 'LR'
            ? [30, 10, 20]
            : [10, 30, 20]
    for (const id of seq) {
      await submitPackageArrival({ packageId: id, priority: 'STANDARD' })
    }
  }

  return (
    <div className="min-h-screen bg-[#05070B] pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>02 // Interactive 3D AVL Engine</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Self-Balancing AVL Tree Visualizer.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['LL', 'RR', 'LR', 'RL'] as const).map((rot) => (
              <button
                key={rot}
                type="button"
                disabled={isSubmitting || mode === 'fixture'}
                onClick={() => void triggerRealRotation(rot)}
                className="font-mono-tech inline-flex items-center gap-1.5 rounded-full border border-[#38E8FF]/35 bg-[#0C1524] px-3.5 py-2 text-[11px] uppercase tracking-wider text-[#38E8FF] transition-colors hover:border-[#38E8FF] hover:bg-[#38E8FF]/15 disabled:opacity-45"
                title={`Reset and insert real backend sequence triggering ${rot} rotation`}
              >
                <RotateCw className="h-3 w-3" />
                <span>Demo {rot}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="studio-panel relative overflow-hidden rounded-3xl lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#060910]/85 px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono-tech mr-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
                  <Camera className="h-3.5 w-3.5 text-[#38E8FF]" />
                  Angle
                </span>
                {(['front', 'isometric', 'top'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCameraPreset(preset)
                      setPresetTrigger((n) => n + 1)
                    }}
                    className={`font-mono-tech rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                      cameraPreset === preset
                        ? 'border border-[#38E8FF]/50 bg-[#38E8FF]/15 text-[#38E8FF]'
                        : 'border border-white/10 bg-white/[0.03] text-[#9BAAC0] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomCommand((z) => ({ dir: 'in', seq: z.seq + 1 }))}
                  className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomCommand((z) => ({ dir: 'out', seq: z.seq + 1 }))}
                  className="rounded-full border border-white/12 bg-white/[0.04] p-1.5 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setInteractiveZoom((v) => !v)}
                  className={`font-mono-tech rounded-full border px-2.5 py-1 text-[10px] uppercase ${
                    interactiveZoom
                      ? 'border-[#2E7BFF]/55 bg-[#2E7BFF]/20 text-white'
                      : 'border-white/10 text-[#7F8EA6]'
                  }`}
                >
                  {interactiveZoom ? 'Wheel Zoom' : 'Locked'}
                </button>
              </div>
            </div>

            <div className="h-[460px] w-full sm:h-[540px]">
              {use3D ? (
                <WebGLErrorBoundary fallback={<Avl2DFallback stage={activeStage} />}>
                  <Suspense fallback={<Avl2DFallback stage={activeStage} />}>
                    <AvlTree3DCanvas
                      graphics={graphics}
                      stage={activeStage}
                      speedMultiplier={speed}
                      selectedNodeId={selectedNodeId}
                      cameraPreset={cameraPreset}
                      presetTrigger={presetTrigger}
                      zoomCommand={zoomCommand}
                      interactiveZoom={interactiveZoom}
                      onNodeSelect={(nodeId, interval) => {
                        setSelectedNodeId(nodeId)
                        setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
                      }}
                    />
                  </Suspense>
                </WebGLErrorBoundary>
              ) : (
                <Avl2DFallback stage={activeStage} onSelectNode={setSelectedNodeId} />
              )}
            </div>

            <div className="border-t border-white/10 bg-[#060910]/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={stages.length <= 1 || stageIndex === 0}
                    onClick={() => {
                      setIsPlaying(false)
                      setStageIndex((i) => Math.max(0, i - 1))
                    }}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white disabled:opacity-35"
                    title="Previous Stage"
                  >
                    <StepBack className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={stages.length <= 1}
                    onClick={() => {
                      if (stageIndex >= stages.length - 1) {
                        setPlaybackState({ eventId: currentEventId, stageIndex: 0, isPlaying: true })
                      } else {
                        setIsPlaying((p) => !p)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#38E8FF]/55 bg-[#2E7BFF]/25 px-4 py-2 font-mono-tech text-xs uppercase tracking-wider text-white hover:bg-[#2E7BFF]/40 disabled:opacity-35"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5 text-[#38E8FF]" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 text-[#38E8FF]" />
                        <span>{stageIndex > 0 && stageIndex < stages.length - 1 ? 'Resume' : 'Play'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={stages.length <= 1 || stageIndex >= stages.length - 1}
                    onClick={() => {
                      setIsPlaying(false)
                      setStageIndex((i) => Math.min(stages.length - 1, i + 1))
                    }}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white disabled:opacity-35"
                    title="Step Forward"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={stages.length <= 1}
                    onClick={() => {
                      setPlaybackState({ eventId: currentEventId, stageIndex: 0, isPlaying: false })
                      setPresetTrigger((n) => n + 1)
                    }}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white disabled:opacity-35"
                    title="Reset Playback & Camera"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono-tech mr-1 text-[10px] uppercase tracking-wider text-[#7F8EA6]">
                    Speed
                  </span>
                  {SPEED_OPTIONS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpeed(sp)}
                      className={`font-mono-tech rounded-lg px-2 py-1 text-[11px] ${
                        speed === sp
                          ? 'border border-[#38E8FF]/55 bg-[#38E8FF]/15 text-[#38E8FF]'
                          : 'border border-white/10 text-[#9BAAC0] hover:text-white'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>

              {activeStage && (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#05070B] p-3">
                  <div className="flex items-center justify-between font-mono-tech text-xs">
                    <span className="font-semibold text-[#38E8FF]">{activeStage.title}</span>
                    <span className="text-[#7F8EA6]">
                      Stage {stageIndex + 1} / {Math.max(1, stages.length)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#C8D3E3]">{activeStage.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-4">
            <div className="studio-panel rounded-3xl p-5">
              <div className="font-mono-tech mb-2 text-[10px] uppercase tracking-[0.18em] text-[#38E8FF]">
                Insert Package into Live AVL
              </div>
              <form onSubmit={(e) => void handleQuickInsert(e)} className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={1000000000}
                  placeholder="Enter ID (e.g. 25)"
                  value={quickId}
                  onChange={(e) => setQuickId(e.target.value)}
                  className="font-mono-tech w-full rounded-xl border border-white/15 bg-[#070A10] px-3.5 py-2.5 text-sm text-white placeholder-[#526077] focus:border-[#38E8FF] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || mode === 'fixture'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#38E8FF]/55 bg-[#2E7BFF] px-4 py-2.5 font-mono-tech text-xs uppercase text-white hover:brightness-110 disabled:opacity-45"
                >
                  <Plus className="h-4 w-4" />
                  <span>Insert</span>
                </button>
              </form>
              <p className="mt-2 font-mono-tech text-[10px] text-[#7F8EA6]">
                Drag 3D viewport to rotate camera · Scroll to zoom · Click nodes to inspect.
              </p>
            </div>

            <div className="studio-panel flex-1 rounded-3xl p-5">
              <div className="mb-3 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#38E8FF]" />
                  Backend Execution Trace
                </span>
                <span>{avlSnapshot?.truncated ? 'Top 250 BFS' : 'Full Tree'}</span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {stages.map((st, idx) => {
                  const isCurrent = idx === stageIndex
                  const isPast = idx < stageIndex
                  return (
                    <button
                      key={`${st.kind}-${idx}`}
                      type="button"
                      onClick={() => {
                        setPlaybackState({ eventId: currentEventId, stageIndex: idx, isPlaying: false })
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        isCurrent
                          ? 'border-[#38E8FF]/65 bg-[#38E8FF]/12'
                          : isPast
                            ? 'border-[#2E7BFF]/30 bg-[#0C1424]/70'
                            : 'border-white/10 bg-[#070A10] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono-tech text-[11px]">
                        <span className={isCurrent ? 'font-bold text-[#38E8FF]' : 'text-white'}>
                          {st.title}
                        </span>
                        {st.rotationLabel && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-200">
                            {st.rotationLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8E9FB8]">{st.description}</p>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 font-mono-tech text-xs">
                <div className="rounded-xl border border-white/8 bg-[#070A10] p-2.5">
                  <div className="text-[9px] uppercase text-[#7F8EA6]">Height</div>
                  <div className="mt-0.5 font-bold text-white">
                    {activeStage?.snapshot.height ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-[#070A10] p-2.5">
                  <div className="text-[9px] uppercase text-[#7F8EA6]">Nodes</div>
                  <div className="mt-0.5 font-bold text-white">
                    {activeStage?.snapshot.nodeCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-[#070A10] p-2.5">
                  <div className="text-[9px] uppercase text-[#7F8EA6]">Root</div>
                  <div className="mt-0.5 font-bold text-[#38E8FF]">
                    {activeStage?.snapshot.rootId ? `#${activeStage.snapshot.rootId}` : '∅'}
                  </div>
                </div>
              </div>

              {activeStage?.snapshot.truncated && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 font-mono-tech text-[10px] text-amber-200">
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span>Large tree truncated to top 250 BFS nodes for smooth 3D rendering.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
