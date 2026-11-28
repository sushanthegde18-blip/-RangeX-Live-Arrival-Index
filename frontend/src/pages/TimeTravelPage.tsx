import {
  FastForward,
  History,
  Pause,
  Play,
  RefreshCw,
  Rewind,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'
import { useRangeX } from '../state/useRangeX'

export function TimeTravelPage({ graphics }: { graphics: GraphicsCapabilities }) {
  const {
    mode,
    eventsHistory,
    refreshEventsHistory,
    submitPackageArrival,
    resetBackendIndex,
    isSubmitting,
    analytics,
  } = useRangeX()

  const [cursor, setCursor] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (mode === 'live') {
      void refreshEventsHistory()
    }
  }, [mode, refreshEventsHistory])

  const clampedCursor =
    eventsHistory.length === 0 ? 0 : Math.min(cursor, eventsHistory.length - 1)

  useEffect(() => {
    if (!isPlaying || eventsHistory.length === 0) return
    const timer = window.setTimeout(() => {
      if (clampedCursor >= eventsHistory.length - 1) {
        setIsPlaying(false)
      } else {
        setCursor((c) => Math.min(eventsHistory.length - 1, c + 1))
      }
    }, graphics.prefersReducedMotion ? 1200 : 850)
    return () => window.clearTimeout(timer)
  }, [isPlaying, clampedCursor, eventsHistory.length, graphics.prefersReducedMotion])

  const loadSampleReplay = async () => {
    if (mode === 'fixture') return
    await resetBackendIndex()
    for (const id of [1, 3, 7, 2, 6]) {
      await submitPackageArrival({ packageId: id, priority: 'STANDARD' })
    }
    await refreshEventsHistory()
    setCursor(0)
    setIsPlaying(true)
  }

  const currentEvent = eventsHistory[clampedCursor] ?? null

  return (
    <div className="min-h-screen bg-[#05070B] pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>05 // Non-Destructive Time-Travel Replay</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Operation History Replay.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="studio-panel flex items-center gap-2 rounded-full px-4 py-2 font-mono-tech text-xs text-[#C8D3E3]">
              <ShieldCheck className="h-4 w-4 text-[#38E8FF]" />
              <span>Live Index Protected ({analytics?.totalPackages ?? 0} pkgs)</span>
            </div>

            <button
              type="button"
              disabled={isSubmitting || mode === 'fixture'}
              onClick={() => void loadSampleReplay()}
              className="font-mono-tech inline-flex items-center gap-1.5 rounded-full border border-[#38E8FF]/45 bg-[#38E8FF]/15 px-4 py-2 text-xs uppercase tracking-wider text-[#38E8FF] hover:bg-[#38E8FF]/25 disabled:opacity-45"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Seed 1→3→7→2→6 Replay</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshEventsHistory()}
              className="rounded-full border border-white/15 bg-white/[0.04] p-2 text-[#C8D3E3] hover:text-white"
              title="Refresh History"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {eventsHistory.length === 0 ? (
          <div className="studio-panel flex flex-col items-center justify-center rounded-3xl py-24 text-center">
            <History className="mb-3 h-9 w-9 text-[#5A6A84]" />
            <h2 className="font-display text-xl font-semibold text-white">No Arrival Events Recorded Yet</h2>
            <p className="mt-2 max-w-md text-xs text-[#8E9FB8]">
              Dispatch packages from the Dashboard or click &ldquo;Seed 1→3→7→2→6 Replay&rdquo; above to
              step backward and forward through historical interval consolidations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="studio-panel rounded-3xl p-6 lg:col-span-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                    Step {clampedCursor + 1} of {eventsHistory.length}
                  </div>
                  <div className="font-display mt-1 text-2xl font-bold text-white">
                    {currentEvent
                      ? `Arrival #${currentEvent.packageId} (${currentEvent.mutationType})`
                      : '—'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false)
                      setCursor(0)
                    }}
                    disabled={clampedCursor === 0}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:text-white disabled:opacity-35"
                    title="Jump to First Event"
                  >
                    <Rewind className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false)
                      setCursor((c) => Math.max(0, Math.min(c, eventsHistory.length - 1) - 1))
                    }}
                    disabled={clampedCursor === 0}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:text-white disabled:opacity-35"
                    title="Step Backward"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (clampedCursor >= eventsHistory.length - 1) {
                        setCursor(0)
                        setIsPlaying(true)
                      } else {
                        setIsPlaying((p) => !p)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#38E8FF]/55 bg-[#2E7BFF] px-4 py-2 font-mono-tech text-xs uppercase text-white hover:brightness-110"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{isPlaying ? 'Pause' : clampedCursor > 0 && clampedCursor < eventsHistory.length - 1 ? 'Resume' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false)
                      setCursor((c) => Math.min(eventsHistory.length - 1, c + 1))
                    }}
                    disabled={clampedCursor >= eventsHistory.length - 1}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:text-white disabled:opacity-35"
                    title="Step Forward"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false)
                      setCursor(eventsHistory.length - 1)
                    }}
                    disabled={clampedCursor >= eventsHistory.length - 1}
                    className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-[#C8D3E3] hover:text-white disabled:opacity-35"
                    title="Jump to Latest"
                  >
                    <FastForward className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <input
                  type="range"
                  aria-label="Replay timeline scrubber"
                  min={0}
                  max={Math.max(0, eventsHistory.length - 1)}
                  value={clampedCursor}
                  onChange={(e) => {
                    setIsPlaying(false)
                    setCursor(Number(e.target.value))
                  }}
                  className="w-full accent-[#38E8FF]"
                />
              </div>

              {currentEvent && (
                <div className="space-y-5">
                  <div>
                    <div className="font-mono-tech mb-2 text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                      Intervals State After #{currentEvent.packageId}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {currentEvent.intervals.map((iv) => {
                        const isTarget =
                          iv.start === currentEvent.targetInterval.start &&
                          iv.end === currentEvent.targetInterval.end
                        return (
                          <div
                            key={`${iv.start}-${iv.end}`}
                            className={`rounded-2xl border px-4 py-3 font-mono-tech ${
                              isTarget
                                ? 'border-[#38E8FF] bg-[#38E8FF]/15 text-[#38E8FF] shadow-[0_0_20px_-6px_rgba(56,232,255,0.55)]'
                                : 'border-white/12 bg-[#080C14] text-white'
                            }`}
                          >
                            <div className="text-lg font-bold">
                              [{iv.start}, {iv.end}]
                            </div>
                            <div className="text-[10px] text-[#8E9FB8]">
                              {iv.end - iv.start + 1} ID(s)
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {currentEvent.avlSnapshot && (
                    <div className="rounded-2xl border border-white/10 bg-[#05070B] p-4">
                      <div className="mb-3 flex items-center justify-between font-mono-tech text-[11px] text-[#8E9FB8]">
                        <span>Historical AVL Snapshot (H={currentEvent.avlSnapshot.height}, Nodes={currentEvent.avlSnapshot.nodeCount})</span>
                        <span>Rotation: {currentEvent.rotation?.type ?? 'NONE'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentEvent.avlSnapshot.nodes.map((node) => (
                          <div
                            key={String(node.id)}
                            className="rounded-xl border border-white/10 bg-[#0B101A] px-3 py-2 font-mono-tech text-xs"
                          >
                            <div className="text-[10px] text-[#7F8EA6]">
                              Node #{node.id} · H:{node.height} · BF:{node.balanceFactor}
                            </div>
                            <div className="font-semibold text-white">
                              [{node.interval.start}, {node.interval.end}]
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="studio-panel rounded-3xl p-5 lg:col-span-4">
              <div className="font-mono-tech mb-3 text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                Recorded Operation Sequence
              </div>
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {eventsHistory.map((ev, idx) => {
                  const active = idx === clampedCursor
                  return (
                    <button
                      key={ev.eventId}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false)
                        setCursor(idx)
                      }}
                      className={`w-full rounded-xl border p-3 text-left font-mono-tech text-xs transition-all ${
                        active
                          ? 'border-[#38E8FF] bg-[#38E8FF]/15 text-white'
                          : 'border-white/10 bg-[#070A10] text-[#9BAAC0] hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#38E8FF]">
                          #{ev.seq} · PKG {ev.packageId}
                        </span>
                        <span className="text-[10px] text-[#7F8EA6]">{ev.mutationType}</span>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-[#C8D3E3]">
                        {ev.intervals.map((i) => `[${i.start},${i.end}]`).join(' ')}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
