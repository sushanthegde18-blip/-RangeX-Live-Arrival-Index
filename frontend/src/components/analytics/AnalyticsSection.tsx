import { Activity, BarChart3, Cpu, GitMerge, Gauge, PackageCheck, RefreshCw } from 'lucide-react'
import { useRangeX } from '../../state/useRangeX'

export function AnalyticsSection() {
  const { mode, analytics, isInitialLoading, fetchError, refreshAllFromBackend } = useRangeX()

  const cards = [
    {
      label: 'Total Packages Indexed',
      value: analytics ? analytics.totalPackages.toLocaleString() : '—',
      icon: PackageCheck,
      accent: 'text-[#38E8FF]',
    },
    {
      label: 'Active Disjoint Intervals',
      value: analytics ? String(analytics.activeIntervals) : '—',
      icon: BarChart3,
      accent: 'text-[#2E7BFF]',
    },
    {
      label: 'Interval Merges Executed',
      value: analytics ? String(analytics.mergedCount) : '—',
      icon: GitMerge,
      accent: 'text-cyan-300',
    },
    {
      label: 'Range Compression Ratio',
      value: analytics ? `${analytics.compressionRatio.toFixed(2)}x` : '—',
      icon: Gauge,
      accent: 'text-[#38E8FF]',
    },
    {
      label: 'AVL Rotations Reported',
      value: analytics ? String(analytics.rotationCount) : '—',
      icon: Cpu,
      accent: 'text-amber-300',
    },
    {
      label: 'Mean Engine Lookup',
      value:
        analytics && analytics.avgLookupMicros != null
          ? `${analytics.avgLookupMicros.toFixed(2)} μs`
          : '—',
      icon: Activity,
      accent: 'text-[#8CB8FF]',
    },
  ]

  const throughput = analytics?.recentThroughput ?? []
  const maxArrival = Math.max(1, ...throughput.map((t) => t.arrivals))

  return (
    <section
      id="analytics"
      className="relative scroll-mt-24 border-t border-white/10 bg-[#05070B] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>06 // Warehouse Analytics</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Live Telemetry &amp; Density.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'fixture' ? (
              <span className="font-mono-tech rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] uppercase tracking-wider text-amber-200">
                FIXTURE TELEMETRY (NON-BACKEND)
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void refreshAllFromBackend()}
                className="font-mono-tech inline-flex items-center gap-2 rounded-full border border-white/12 bg-[#0C1018] px-4 py-2 text-xs uppercase tracking-wider text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isInitialLoading ? 'animate-spin' : ''}`} />
                <span>Sync Metrics</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Note if API is offline in Live Mode */}
        {mode === 'live' && !analytics && (
          <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-950/25 px-5 py-4 text-xs text-rose-200">
            <span className="font-mono-tech uppercase tracking-wider text-rose-300">
              Analytics Awaiting C++ Backend:{' '}
            </span>
            <span>
              {fetchError ||
                'Real-time warehouse KPIs remain blank until Member 2 backend responds.'}
            </span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="studio-panel group rounded-2xl p-6 transition-colors hover:border-[#2E7BFF]/45"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[11px] uppercase tracking-[0.16em] text-[#7F8EA6]">
                    {card.label}
                  </span>
                  <Icon className={`h-4 w-4 ${card.accent}`} />
                </div>
                <div className="font-display mt-4 text-4xl font-bold tracking-tight text-white">
                  {card.value}
                </div>
              </div>
            )
          })}
        </div>

        {/* Throughput Breakdown Panel */}
        <div className="studio-panel mt-6 rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">
                Arrival &amp; Consolidation Cadence
              </h3>
              <p className="mt-1 text-xs text-[#7F8EA6]">
                Direct stream breakdown from backend `recentThroughput` telemetry.
              </p>
            </div>
            <div className="font-mono-tech flex items-center gap-4 text-[11px] text-[#9BAAC0]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2E7BFF]" /> Arrivals
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#38E8FF]" /> Merges
              </span>
            </div>
          </div>

          {throughput.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#05070B] font-mono-tech text-xs text-[#64748B]">
              No throughput samples received from backend yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {throughput.map((sample) => {
                const arrivalPct = Math.max(12, Math.round((sample.arrivals / maxArrival) * 100))
                const mergePct =
                  sample.merges > 0
                    ? Math.max(10, Math.round((sample.merges / maxArrival) * 100))
                    : 0

                return (
                  <div
                    key={sample.timestamp}
                    className="flex flex-col justify-end rounded-xl border border-white/8 bg-[#060910] p-3"
                  >
                    <div className="flex h-28 items-end gap-1.5">
                      <div
                        style={{ height: `${arrivalPct}%` }}
                        className="w-1/2 rounded-t bg-gradient-to-t from-[#1A4AC2] to-[#2E7BFF]"
                        title={`Arrivals: ${sample.arrivals}`}
                      />
                      <div
                        style={{ height: `${mergePct}%` }}
                        className="w-1/2 rounded-t bg-gradient-to-t from-[#1D9AB5] to-[#38E8FF]"
                        title={`Merges: ${sample.merges}`}
                      />
                    </div>
                    <div className="font-mono-tech mt-2 text-center text-[10px] text-[#7F8EA6]">
                      {sample.timestamp}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
