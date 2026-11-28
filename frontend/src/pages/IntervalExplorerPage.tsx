import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  GitMerge,
  Layers,
  Loader2,
  PlusCircle,
  Search,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { GapsResponse, IntervalMutationType } from '../contracts/api'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'
import { rangexApi } from '../services/rangexApi'
import { useRangeX } from '../state/useRangeX'

export function IntervalExplorerPage({ graphics }: { graphics: GraphicsCapabilities }) {
  const {
    mode,
    intervals,
    previousIntervals,
    lastArrival,
    analytics,
    eventsHistory,
    selectedIntervalId,
    setSelectedIntervalId,
  } = useRangeX()

  const minBound = intervals.length > 0 ? Math.min(...intervals.map((i) => i.start)) : 1
  const maxBound = intervals.length > 0 ? Math.max(...intervals.map((i) => i.end)) : 100
  const domainSpan = Math.max(1, maxBound - minBound + 1)

  const [gapStartInput, setGapStartInput] = useState('1')
  const [gapEndInput, setGapEndInput] = useState('100')
  const [gapsResult, setGapsResult] = useState<GapsResponse | null>(null)
  const [gapsError, setGapsError] = useState<string | null>(null)
  const [isQueryingGaps, setIsQueryingGaps] = useState(false)

  const runGapQuery = useCallback(
    async (startVal: number, endVal: number) => {
      if (mode === 'fixture') {
        setGapsError('Custom backend gap calculation requires LIVE C++ backend mode.')
        return
      }
      setIsQueryingGaps(true)
      setGapsError(null)
      try {
        const res = await rangexApi.fetchGaps(startVal, endVal, 200)
        setGapsResult(res)
      } catch (err) {
        setGapsError(err instanceof Error ? err.message : 'Failed to calculate missing gaps')
      } finally {
        setIsQueryingGaps(false)
      }
    },
    [mode],
  )

  useEffect(() => {
    if (mode !== 'live') return
    const s = Number(gapStartInput)
    const e = Number(gapEndInput)
    if (Number.isInteger(s) && Number.isInteger(e) && s >= 0 && e >= s && e <= 1_000_000_000) {
      let cancelled = false
      Promise.resolve().then(() => {
        if (!cancelled) {
          void runGapQuery(s, e)
        }
      })
      return () => {
        cancelled = true
      }
    }
  }, [mode, intervals.length, analytics?.revision, gapStartInput, gapEndInput, runGapQuery])

  const handleGapSubmit = (e: FormEvent) => {
    e.preventDefault()
    setGapsError(null)
    const s = Number(gapStartInput.trim())
    const end = Number(gapEndInput.trim())
    if (!Number.isInteger(s) || !Number.isInteger(end) || s < 0 || end > 1_000_000_000 || s > end) {
      setGapsError('Enter integer bounds satisfying 0 <= start <= end <= 1,000,000,000.')
      return
    }
    void runGapQuery(s, end)
  }

  const classifiedOps = useMemo(() => {
    const map = new Map<IntervalMutationType, Array<{ packageId: number; range: string }>>()
    map.set('CREATED', [])
    map.set('EXTENDED', [])
    map.set('MERGED', [])
    for (let i = eventsHistory.length - 1; i >= 0; i--) {
      const ev = eventsHistory[i]
      if (ev.mutationType === 'DUPLICATE') continue
      const arr = map.get(ev.mutationType)
      if (arr && arr.length < 6) {
        arr.push({
          packageId: ev.packageId,
          range: `[${ev.targetInterval.start}, ${ev.targetInterval.end}]`,
        })
      }
    }
    return map
  }, [eventsHistory])

  const reduced = graphics.prefersReducedMotion

  return (
    <div className="min-h-screen bg-[#05070B] pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>03 // Interval Explorer &amp; Gap Intelligence</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Received Ranges &amp; Missing Gaps.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono-tech text-xs">
            <span className="rounded-full border border-white/12 bg-[#0C1018] px-3.5 py-1.5 text-[#C8D3E3]">
              Received Intervals: <strong className="text-[#38E8FF]">{intervals.length}</strong>
            </span>
            <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-3.5 py-1.5 text-amber-200">
              Active Span Missing: <strong>{analytics?.missingCount?.toLocaleString() ?? 0}</strong>
            </span>
          </div>
        </div>

        {lastArrival && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="studio-panel mb-8 rounded-3xl border-[#38E8FF]/30 p-6"
          >
            <div className="mb-3 flex items-center justify-between font-mono-tech text-[11px] uppercase tracking-[0.18em]">
              <span className="inline-flex items-center gap-2 text-[#38E8FF]">
                <GitMerge className="h-4 w-4" />
                {lastArrival.mutationType === 'MERGED'
                  ? 'Bridge Merge Visualization'
                  : `Latest Interval Transition (${lastArrival.mutationType})`}
              </span>
              <span className="text-[#7F8EA6]">PKG #{lastArrival.packageId}</span>
            </div>

            {lastArrival.mutationType === 'MERGED' && lastArrival.mergedFrom && lastArrival.mergedFrom.length >= 2 ? (
              <div className="flex flex-wrap items-center gap-3 font-mono-tech text-xs">
                <div className="rounded-xl border border-white/15 bg-[#0A101B] px-3.5 py-2 text-[#C8D3E3]">
                  [{lastArrival.mergedFrom[0].start}, {lastArrival.mergedFrom[0].end}]
                </div>
                <span className="text-[#38E8FF]">+</span>
                <div className="rounded-xl border border-[#38E8FF] bg-[#38E8FF]/20 px-3.5 py-2 font-bold text-[#38E8FF] shadow-[0_0_20px_-4px_rgba(56,232,255,0.65)]">
                  Bridge #{lastArrival.packageId}
                </div>
                <span className="text-[#38E8FF]">+</span>
                <div className="rounded-xl border border-white/15 bg-[#0A101B] px-3.5 py-2 text-[#C8D3E3]">
                  [{lastArrival.mergedFrom[1].start}, {lastArrival.mergedFrom[1].end}]
                </div>
                <ArrowRight className="h-4 w-4 text-[#38E8FF]" />
                <div className="rounded-xl border border-cyan-300/70 bg-gradient-to-r from-[#2E7BFF]/30 to-[#38E8FF]/25 px-4 py-2 font-bold text-white">
                  [{lastArrival.targetInterval.start}, {lastArrival.targetInterval.end}]
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 font-mono-tech text-xs">
                <span className="text-[#7F8EA6]">BEFORE:</span>
                {previousIntervals.slice(0, 6).map((iv) => (
                  <span key={`p-${iv.start}`} className="rounded border border-white/10 px-2 py-1 text-[#9BAAC0]">
                    [{iv.start},{iv.end}]
                  </span>
                ))}
                <ArrowRight className="h-4 w-4 text-[#38E8FF]" />
                <span className="rounded-lg border border-[#38E8FF]/55 bg-[#38E8FF]/15 px-3 py-1 font-semibold text-[#38E8FF]">
                  [{lastArrival.targetInterval.start}, {lastArrival.targetInterval.end}]
                </span>
              </div>
            )}
          </motion.div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-wider text-[#38E8FF]">
              <PlusCircle className="h-4 w-4" />
              <span>Newly Created ({analytics?.createdCount ?? 0})</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 font-mono-tech text-xs">
              {(classifiedOps.get('CREATED') ?? []).length === 0 ? (
                <span className="text-[#64748B]">No creations recorded yet</span>
              ) : (
                classifiedOps.get('CREATED')!.map((item, idx) => (
                  <span key={idx} className="rounded-lg border border-[#38E8FF]/35 bg-[#38E8FF]/10 px-2.5 py-1 text-[#C8D3E3]">
                    #{item.packageId} → {item.range}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-wider text-[#9BC4FF]">
              <Sparkles className="h-4 w-4 text-[#2E7BFF]" />
              <span>Extended Intervals ({analytics?.extendedCount ?? 0})</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 font-mono-tech text-xs">
              {(classifiedOps.get('EXTENDED') ?? []).length === 0 ? (
                <span className="text-[#64748B]">No extensions recorded yet</span>
              ) : (
                classifiedOps.get('EXTENDED')!.map((item, idx) => (
                  <span key={idx} className="rounded-lg border border-[#2E7BFF]/40 bg-[#2E7BFF]/15 px-2.5 py-1 text-[#C8D3E3]">
                    #{item.packageId} → {item.range}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 font-mono-tech text-xs uppercase tracking-wider text-cyan-200">
              <GitMerge className="h-4 w-4 text-cyan-300" />
              <span>Merged Intervals ({analytics?.mergedCount ?? 0})</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 font-mono-tech text-xs">
              {(classifiedOps.get('MERGED') ?? []).length === 0 ? (
                <span className="text-[#64748B]">No bridge merges recorded yet</span>
              ) : (
                classifiedOps.get('MERGED')!.map((item, idx) => (
                  <span key={idx} className="rounded-lg border border-cyan-300/45 bg-cyan-400/15 px-2.5 py-1 text-white">
                    #{item.packageId} ⇒ {item.range}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="studio-panel rounded-3xl p-6 lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Received Disjoint Intervals</h2>
              <span className="font-mono-tech text-xs text-[#7F8EA6]">Sorted Asc</span>
            </div>

            {intervals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="mb-3 h-7 w-7 text-[#5A6A84]" />
                <p className="text-sm text-[#9BAAC0]">No intervals indexed yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <AnimatePresence mode="popLayout">
                    {intervals.map((iv, idx) => {
                      const id = iv.id ?? `${iv.start}-${iv.end}`
                      const isSel = selectedIntervalId === id
                      const span = iv.end - iv.start + 1
                      return (
                        <motion.button
                          key={id}
                          layout={!reduced}
                          initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={reduced ? undefined : { opacity: 0, scale: 0.85 }}
                          type="button"
                          onClick={() => setSelectedIntervalId(id)}
                          className={`min-w-[160px] flex-1 basis-[175px] rounded-2xl border p-4 text-left transition-all ${
                            isSel
                              ? 'border-[#38E8FF] bg-[#0F1E36] shadow-[0_0_24px_-8px_rgba(56,232,255,0.55)]'
                              : 'border-white/12 bg-[#080C14] hover:border-[#2E7BFF]/55'
                          }`}
                        >
                          <div className="flex justify-between font-mono-tech text-[10px] text-[#7F8EA6]">
                            <span>#{idx + 1}</span>
                            <span className="text-[#38E8FF]">{iv.zone ?? `BAY-${idx + 1}`}</span>
                          </div>
                          <div className="font-display mt-2 text-2xl font-bold text-white">
                            [{iv.start}, {iv.end}]
                          </div>
                          <div className="mt-2 font-mono-tech text-[11px] text-[#8E9FB8]">
                            {span.toLocaleString()} package{span === 1 ? '' : 's'}
                          </div>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>

                <div className="border-t border-white/10 pt-5">
                  <div className="mb-2 flex justify-between font-mono-tech text-[10px] uppercase tracking-wider text-[#7F8EA6]">
                    <span>Contiguous Span Map</span>
                    <span>
                      [{minBound} .. {maxBound}]
                    </span>
                  </div>
                  <div className="relative h-10 w-full overflow-hidden rounded-xl border border-white/10 bg-[#05070B] p-1">
                    {intervals.slice(0, 120).map((iv) => {
                      const id = iv.id ?? `${iv.start}-${iv.end}`
                      const leftPct = ((iv.start - minBound) / domainSpan) * 100
                      const widthPct = Math.max(2.5, ((iv.end - iv.start + 1) / domainSpan) * 100)
                      return (
                        <div
                          key={`r-${id}`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          className="absolute top-1 bottom-1 rounded-md border border-[#38E8FF]/60 bg-[#2E7BFF]/45"
                          title={`[${iv.start}, ${iv.end}]`}
                        >
                          <span className="font-mono-tech flex h-full items-center justify-center truncate px-1 text-[9px] text-white">
                            [{iv.start},{iv.end}]
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="studio-panel rounded-3xl p-6 lg:col-span-5">
            <h2 className="font-display text-xl font-bold text-white">Missing Range Calculator</h2>
            <p className="mt-1 text-xs text-[#8E9FB8]">
              Queries <code className="text-[#38E8FF]">GET /api/gaps</code> using pruned O(log K + M) AVL traversal without allocating sparse arrays.
            </p>

            <form onSubmit={handleGapSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gap-start" className="font-mono-tech mb-1 block text-[10px] uppercase text-[#7F8EA6]">
                    Start ID
                  </label>
                  <input
                    id="gap-start"
                    type="number"
                    min={0}
                    max={1000000000}
                    value={gapStartInput}
                    onChange={(e) => setGapStartInput(e.target.value)}
                    className="font-mono-tech w-full rounded-xl border border-white/15 bg-[#070A10] px-3 py-2.5 text-sm text-white focus:border-[#38E8FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="gap-end" className="font-mono-tech mb-1 block text-[10px] uppercase text-[#7F8EA6]">
                    End ID
                  </label>
                  <input
                    id="gap-end"
                    type="number"
                    min={0}
                    max={1000000000}
                    value={gapEndInput}
                    onChange={(e) => setGapEndInput(e.target.value)}
                    className="font-mono-tech w-full rounded-xl border border-white/15 bg-[#070A10] px-3 py-2.5 text-sm text-white focus:border-[#38E8FF] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isQueryingGaps}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#38E8FF]/55 bg-[#2E7BFF] px-4 py-2.5 font-mono-tech text-xs uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-55"
                >
                  {isQueryingGaps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  <span>Compute Missing Ranges</span>
                </button>
                {intervals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setGapStartInput(String(minBound))
                      setGapEndInput(String(maxBound))
                    }}
                    className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 font-mono-tech text-[11px] text-[#C8D3E3] hover:text-white"
                  >
                    Use Active Span
                  </button>
                )}
              </div>
            </form>

            {gapsError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/30 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{gapsError}</span>
              </div>
            )}

            {gapsResult && (
              <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                <div className="grid grid-cols-2 gap-2 font-mono-tech text-xs">
                  <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <div className="text-[10px] uppercase text-amber-200/80">Missing IDs</div>
                    <div className="mt-0.5 text-lg font-bold text-amber-200">
                      {gapsResult.missingCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#38E8FF]/25 bg-[#38E8FF]/10 p-3">
                    <div className="text-[10px] uppercase text-[#8EEBFF]">Present IDs</div>
                    <div className="mt-0.5 text-lg font-bold text-[#38E8FF]">
                      {gapsResult.presentCount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {gapsResult.missingIntervals.length === 0 ? (
                    <div className="rounded-xl border border-[#38E8FF]/30 bg-[#38E8FF]/10 p-4 text-center font-mono-tech text-xs text-[#38E8FF]">
                      100% Contiguous — Zero missing intervals in [{gapsResult.start}, {gapsResult.end}]
                    </div>
                  ) : (
                    gapsResult.missingIntervals.map((gap) => (
                      <div
                        key={`gap-${gap.start}-${gap.end}`}
                        className="flex items-center justify-between rounded-xl border border-amber-400/25 bg-[#080B12] px-3.5 py-2.5 font-mono-tech text-xs"
                      >
                        <span className="font-semibold text-amber-200">
                          [{gap.start}, {gap.end}]
                        </span>
                        <span className="text-[#8E9FB8]">{gap.count.toLocaleString()} missing</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
