import { Activity, Cpu, Gauge, GitBranch, Layers, Loader2, Play, ShieldCheck, Zap } from 'lucide-react'
import { useState } from 'react'
import type { ArrivalPattern, BenchmarkResponse } from '../contracts/api'
import { rangexApi } from '../services/rangexApi'
import { useRangeX } from '../state/useRangeX'

const SCALES = [1000, 10000, 50000] as const
const PATTERNS: Array<{ id: ArrivalPattern; label: string; desc: string }> = [
  { id: 'random', label: 'Random Arrivals', desc: 'Uniform random distribution across sparse key space' },
  { id: 'sequential', label: 'Sequential Arrivals', desc: 'Monotonic 0..N-1 worst-case BST input coalesced in AVL' },
  { id: 'spaced', label: 'Widely Spaced IDs', desc: 'Spread across 0 to 10^9 without sparse array allocation' },
  { id: 'duplicate-heavy', label: 'Duplicate-Heavy', desc: 'High collision workload verifying O(log K) deduplication' },
]

export function PerformanceLabPage() {
  const { mode } = useRangeX()
  const [selectedCount, setSelectedCount] = useState<number>(10000)
  const [selectedPattern, setSelectedPattern] = useState<ArrivalPattern>('random')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<BenchmarkResponse | null>(null)
  const [history, setHistory] = useState<BenchmarkResponse[]>([])

  const runBenchmark = async (count = selectedCount, pattern = selectedPattern) => {
    if (mode === 'fixture') {
      setError('Performance Lab requires LIVE C++ backend mode so every timing is genuinely measured.')
      return
    }
    setIsRunning(true)
    setError(null)
    try {
      const res = await rangexApi.runBulkArrivals({
        count,
        pattern,
        benchmarkOnly: true,
      })
      setLatestResult(res)
      setHistory((prev) => [res, ...prev.slice(0, 7)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  const maxInsertMs = Math.max(1, ...history.map((h) => h.insertTotalMs))

  return (
    <div className="min-h-screen bg-[#05070B] pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>04 // C++17 Performance Lab</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Measured AVL Scale &amp; Throughput.
            </h1>
          </div>

          <div className="studio-panel flex items-center gap-2 rounded-full px-4 py-2 font-mono-tech text-xs text-[#9BAAC0]">
            <ShieldCheck className="h-4 w-4 text-[#38E8FF]" />
            <span>Isolated C++ Benchmark · Live Index Untouched</span>
          </div>
        </div>

        <div className="studio-panel mb-8 rounded-3xl p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="font-mono-tech mb-2 text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                1. Workload Scale (Package IDs)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SCALES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedCount(n)}
                    className={`rounded-xl border py-3 font-mono-tech text-sm font-bold transition-all ${
                      selectedCount === n
                        ? 'border-[#38E8FF] bg-[#38E8FF]/15 text-[#38E8FF]'
                        : 'border-white/12 bg-[#070A10] text-[#C8D3E3] hover:border-white/30'
                    }`}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="font-mono-tech mb-2 text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                2. Arrival Pattern
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setSelectedPattern(pat.id)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      selectedPattern === pat.id
                        ? 'border-[#2E7BFF] bg-[#2E7BFF]/20 text-white'
                        : 'border-white/12 bg-[#070A10] text-[#9BAAC0] hover:text-white'
                    }`}
                  >
                    <div className="font-mono-tech text-xs font-semibold">{pat.label}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] text-[#7F8EA6]">{pat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-end lg:col-span-3">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => void runBenchmark()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#38E8FF]/60 bg-gradient-to-r from-[#2E7BFF] to-[#1D5AE0] px-5 py-4 font-mono-tech text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_32px_-6px_rgba(46,123,255,0.75)] transition-all hover:brightness-110 disabled:opacity-55"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Running in C++...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Run Benchmark</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-950/35 p-3 font-mono-tech text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {latestResult ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>Insert Time</span>
                  <Zap className="h-3.5 w-3.5 text-[#38E8FF]" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {latestResult.insertTotalMs.toFixed(2)} ms
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-[#38E8FF]">
                  {latestResult.avgInsertMicros.toFixed(3)} µs / op
                </div>
              </div>

              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>Search Perf</span>
                  <Activity className="h-3.5 w-3.5 text-[#2E7BFF]" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {(latestResult.avgLookupMicros ?? 0).toFixed(3)} µs
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-[#9BAAC0]">
                  {latestResult.lookupQueries?.toLocaleString() ?? 0} queries ({(latestResult.lookupTotalMs ?? 0).toFixed(2)} ms)
                </div>
              </div>

              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>Throughput</span>
                  <Gauge className="h-3.5 w-3.5 text-[#38E8FF]" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {Math.round(latestResult.insertThroughputOpsSec ?? 0).toLocaleString()}
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-[#9BAAC0]">ops / sec</div>
              </div>

              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>AVL Height</span>
                  <GitBranch className="h-3.5 w-3.5 text-amber-300" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {latestResult.avlHeight ?? 0}
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-[#9BAAC0]">
                  {latestResult.invariantsValid ? 'Invariants Verified' : 'Check Failed'}
                </div>
              </div>

              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>Intervals</span>
                  <Layers className="h-3.5 w-3.5 text-[#2E7BFF]" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {(latestResult.activeIntervals ?? 0).toLocaleString()}
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-[#9BAAC0]">
                  {(latestResult.compressionRatio ?? 1).toFixed(2)}x compression
                </div>
              </div>

              <div className="studio-panel rounded-2xl p-4">
                <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase text-[#7F8EA6]">
                  <span>Unique IDs</span>
                  <Cpu className="h-3.5 w-3.5 text-[#38E8FF]" />
                </div>
                <div className="font-display mt-2 text-2xl font-bold text-white">
                  {(latestResult.uniqueIds ?? 0).toLocaleString()}
                </div>
                <div className="font-mono-tech mt-1 text-[10px] text-amber-200">
                  {(latestResult.duplicateCount ?? 0).toLocaleString()} duplicates
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="studio-panel rounded-3xl p-6 lg:col-span-4">
                <h2 className="font-display text-lg font-bold text-white">AVL Rotation Breakdown</h2>
                <p className="mt-1 text-xs text-[#8E9FB8]">
                  Exact self-balancing rotations triggered during {latestResult.count.toLocaleString()} {latestResult.pattern} arrivals.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 font-mono-tech text-xs">
                  <div className="rounded-xl border border-white/10 bg-[#070A10] p-3">
                    <div className="text-[10px] text-[#7F8EA6]">LL Rotations</div>
                    <div className="mt-1 text-xl font-bold text-[#38E8FF]">{latestResult.llRotations ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#070A10] p-3">
                    <div className="text-[10px] text-[#7F8EA6]">RR Rotations</div>
                    <div className="mt-1 text-xl font-bold text-[#2E7BFF]">{latestResult.rrRotations ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#070A10] p-3">
                    <div className="text-[10px] text-[#7F8EA6]">LR Double</div>
                    <div className="mt-1 text-xl font-bold text-amber-300">{latestResult.lrRotations ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#070A10] p-3">
                    <div className="text-[10px] text-[#7F8EA6]">RL Double</div>
                    <div className="mt-1 text-xl font-bold text-cyan-200">{latestResult.rlRotations ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="studio-panel rounded-3xl p-6 lg:col-span-8">
                <h2 className="font-display mb-4 text-lg font-bold text-white">Benchmark Run History</h2>
                <div className="space-y-2.5">
                  {history.map((run, idx) => {
                    const barPct = Math.max(8, Math.round((run.insertTotalMs / maxInsertMs) * 100))
                    return (
                      <div key={idx} className="rounded-xl border border-white/10 bg-[#070A10] p-3 font-mono-tech text-xs">
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-white">
                            {run.count.toLocaleString()} IDs · {run.pattern}
                          </span>
                          <span className="text-[#38E8FF]">
                            {run.insertTotalMs.toFixed(2)} ms · H={run.avlHeight} · {run.activeIntervals?.toLocaleString()} intervals
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            style={{ width: `${barPct}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-[#2E7BFF] to-[#38E8FF]"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="studio-panel flex flex-col items-center justify-center rounded-3xl py-20 text-center">
            <Gauge className="mb-3 h-9 w-9 text-[#38E8FF]" />
            <h2 className="font-display text-xl font-semibold text-white">Ready to Benchmark C++ AVL Core</h2>
            <p className="mt-2 max-w-md text-xs text-[#8E9FB8]">
              Select 1,000, 10,000, or 50,000 package IDs above and click Run Benchmark to measure
              real C++17 insertion and lookup latency.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
