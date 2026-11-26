import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, GitMerge, Layers, PlusCircle, RefreshCw, Sparkles, WifiOff } from 'lucide-react'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'
import { useRangeX } from '../../state/useRangeX'

export function IntervalExplorerSection({ graphics }: { graphics: GraphicsCapabilities }) {
  const {
    mode,
    intervals,
    previousIntervals,
    lastArrival,
    selectedIntervalId,
    setSelectedIntervalId,
    isInitialLoading,
    fetchError,
    refreshAllFromBackend,
    setMode,
  } = useRangeX()

  const minBound = intervals.length > 0 ? Math.min(...intervals.map((i) => i.start)) : 0
  const maxBound = intervals.length > 0 ? Math.max(...intervals.map((i) => i.end)) : 10
  const domainSpan = Math.max(1, maxBound - minBound + 1)

  const reduced = graphics.prefersReducedMotion

  return (
    <section
      id="intervals"
      className="relative scroll-mt-24 border-t border-white/10 bg-[#05070B] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>04 // Interval Visualization</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Sorted Consolidated Ranges.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'fixture' && (
              <span className="font-mono-tech rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-wider text-amber-200">
                DEV FIXTURE PREVIEW DATA
              </span>
            )}
            <span className="font-mono-tech rounded-full border border-white/12 bg-[#0C1018] px-3.5 py-1.5 text-xs text-[#C8D3E3]">
              Active Ranges: <strong className="text-[#38E8FF]">{intervals.length}</strong>
            </span>
          </div>
        </div>

        {/* Transformation Diff Bar (shown after a confirmed insertion/merge/extension) */}
        {lastArrival && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="studio-panel mb-8 rounded-2xl p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 font-mono-tech text-xs">
                <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-[#7F8EA6]">
                  Before
                </span>
                {previousIntervals.length === 0 ? (
                  <span className="text-[#69778F]">[]</span>
                ) : (
                  previousIntervals.map((iv) => (
                    <span
                      key={`prev-${iv.start}-${iv.end}`}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[#9BAAC0]"
                    >
                      [{iv.start}, {iv.end}]
                    </span>
                  ))
                )}

                <ArrowRight className="mx-1 h-4 w-4 text-[#38E8FF]" />

                <span className="rounded-full border border-[#2E7BFF]/45 bg-[#2E7BFF]/20 px-2.5 py-1 text-[11px] text-white">
                  Insert #{lastArrival.packageId} · {lastArrival.mutationType}
                </span>

                <ArrowRight className="mx-1 h-4 w-4 text-[#38E8FF]" />

                <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-[#38E8FF]">
                  After
                </span>
                {intervals.map((iv) => {
                  const isTarget =
                    iv.start === lastArrival.targetInterval.start &&
                    iv.end === lastArrival.targetInterval.end
                  return (
                    <span
                      key={`after-${iv.start}-${iv.end}`}
                      className={`rounded-lg border px-2.5 py-1 font-semibold ${
                        isTarget
                          ? 'border-[#38E8FF]/60 bg-[#38E8FF]/15 text-[#38E8FF]'
                          : 'border-white/12 bg-white/[0.04] text-white'
                      }`}
                    >
                      [{iv.start}, {iv.end}]
                    </span>
                  )
                })}
              </div>

              <div className="font-mono-tech text-[11px] text-[#9BAAC0]">
                {lastArrival.mutationType === 'MERGED' && lastArrival.mergedFrom ? (
                  <span className="inline-flex items-center gap-1.5 text-[#38E8FF]">
                    <GitMerge className="h-3.5 w-3.5" />
                    Consolidated {lastArrival.mergedFrom.length} intervals
                  </span>
                ) : lastArrival.mutationType === 'CREATED' ? (
                  <span className="inline-flex items-center gap-1.5 text-[#38E8FF]">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Allocated new range node
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#9BC4FF]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Boundary extended cleanly
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Interval Card Grid & Proportional Timeline */}
        <div className="studio-panel rounded-3xl p-6 sm:p-8">
          {isInitialLoading && mode === 'live' ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RefreshCw className="mb-3 h-6 w-6 animate-spin text-[#38E8FF]" />
              <p className="font-mono-tech text-xs uppercase tracking-[0.2em] text-[#9BAAC0]">
                Fetching sorted intervals from C++ backend...
              </p>
            </div>
          ) : mode === 'live' && fetchError && intervals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-500/10 text-rose-300">
                <WifiOff className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                Interval Index Unavailable
              </h3>
              <p className="mt-2 max-w-lg text-sm text-[#92A1B8]">{fetchError}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void refreshAllFromBackend()}
                  className="font-mono-tech rounded-full border border-[#38E8FF]/45 bg-[#38E8FF]/15 px-5 py-2.5 text-xs uppercase tracking-wider text-[#38E8FF] hover:bg-[#38E8FF]/25"
                >
                  Retry Live API
                </button>
                <button
                  type="button"
                  onClick={() => setMode('fixture')}
                  className="font-mono-tech rounded-full border border-amber-400/35 bg-amber-500/10 px-5 py-2.5 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-500/20"
                >
                  Inspect Visual Fixture Sequence
                </button>
              </div>
            </div>
          ) : intervals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Layers className="mb-3 h-7 w-7 text-[#5A6A84]" />
              <p className="font-display text-lg text-white">Warehouse Index Empty</p>
              <p className="mt-1 text-sm text-[#7F8EA6]">
                Register a package ID in Section 03 to create the first interval node.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Animated Interval Pills */}
              <div className="flex flex-wrap items-stretch gap-4">
                <AnimatePresence mode="popLayout">
                  {intervals.map((interval, index) => {
                    const id = interval.id ?? `${interval.start}-${interval.end}`
                    const isSelected = selectedIntervalId === id
                    const isLatestTarget =
                      lastArrival &&
                      lastArrival.targetInterval.start === interval.start &&
                      lastArrival.targetInterval.end === interval.end
                    const spanWidth = interval.end - interval.start + 1

                    return (
                      <motion.button
                        key={id}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, scale: 0.9, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={reduced ? undefined : { opacity: 0, scale: 0.85 }}
                        transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                        type="button"
                        onClick={() => setSelectedIntervalId(id)}
                        className={`group relative min-w-[175px] flex-1 basis-[210px] rounded-2xl border p-5 text-left transition-colors ${
                          isSelected || isLatestTarget
                            ? 'border-[#38E8FF]/65 bg-gradient-to-br from-[#0F1E36] to-[#080D16] shadow-[0_0_32px_-12px_rgba(56,232,255,0.6)]'
                            : 'border-white/12 bg-[#080C13] hover:border-[#2E7BFF]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                          <span>RANGE #{index + 1}</span>
                          <span className="text-[#38E8FF]">{interval.zone ?? `BAY-${index + 1}`}</span>
                        </div>

                        <div className="font-display mt-3 text-3xl font-bold tracking-tight text-white">
                          [{interval.start}, {interval.end}]
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono-tech text-[11px] text-[#9BAAC0]">
                          <span>Span: {spanWidth} IDs</span>
                          <span>{interval.packageCount ?? spanWidth} pkgs</span>
                        </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Proportional Spatial Ruler */}
              <div className="border-t border-white/10 pt-6">
                <div className="mb-3 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                  <span>Contiguous ID Address Space</span>
                  <span>
                    Domain [{minBound} .. {maxBound}]
                  </span>
                </div>
                <div className="relative h-10 w-full overflow-hidden rounded-xl border border-white/10 bg-[#05070B] p-1.5">
                  {intervals.map((interval) => {
                    const id = interval.id ?? `${interval.start}-${interval.end}`
                    const leftPct = ((interval.start - minBound) / domainSpan) * 100
                    const widthPct = Math.max(
                      3,
                      ((interval.end - interval.start + 1) / domainSpan) * 100,
                    )
                    const isSelected = selectedIntervalId === id

                    return (
                      <motion.div
                        key={`bar-${id}`}
                        layout={!reduced}
                        onClick={() => setSelectedIntervalId(id)}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        className={`absolute top-1.5 bottom-1.5 cursor-pointer rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-[#38E8FF] bg-gradient-to-r from-[#2E7BFF]/75 to-[#38E8FF]/65'
                            : 'border-[#2E7BFF]/55 bg-[#2E7BFF]/35 hover:bg-[#2E7BFF]/55'
                        }`}
                        title={`[${interval.start}, ${interval.end}]`}
                      >
                        <span className="font-mono-tech flex h-full items-center justify-center truncate px-1.5 text-[10px] font-semibold text-white">
                          [{interval.start},{interval.end}]
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
