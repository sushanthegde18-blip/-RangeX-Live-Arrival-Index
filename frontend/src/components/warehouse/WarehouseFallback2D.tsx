import type { IntervalRange } from '../../contracts/api'
import type { ActivePackageAnimation } from '../../state/useRangeX'

interface WarehouseFallback2DProps {
  intervals: IntervalRange[]
  selectedIntervalId: string | null
  activeAnimation: ActivePackageAnimation | null
  onSelectInterval: (interval: IntervalRange) => void
  reason: string
}

const BAY_LABELS = ['BAY-A1', 'BAY-A2', 'BAY-A3', 'BAY-B1', 'BAY-B2', 'BAY-B3']

export function WarehouseFallback2D({
  intervals,
  selectedIntervalId,
  activeAnimation,
  onSelectInterval,
  reason,
}: WarehouseFallback2DProps) {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#060910] p-6">
      <div className="studio-grid-bg pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative z-10 flex items-center justify-between">
        <span className="font-mono-tech rounded-full border border-[#38E8FF]/30 bg-[#0C1322] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#38E8FF]">
          {reason}
        </span>
        {activeAnimation && (
          <span className="font-mono-tech rounded-full border border-[#2E7BFF]/40 bg-[#2E7BFF]/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
            Routing PKG #{activeAnimation.packageId} ({activeAnimation.mutationType})
          </span>
        )}
      </div>

      {/* Storage Rack Grid */}
      <div className="relative z-10 my-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BAY_LABELS.map((code, idx) => {
          const interval = intervals[idx]
          const intervalId = interval ? (interval.id ?? `${interval.start}-${interval.end}`) : null
          const isSelected = Boolean(intervalId && selectedIntervalId === intervalId)
          const isTarget =
            activeAnimation &&
            Math.abs(activeAnimation.targetInterval.start) % BAY_LABELS.length === idx

          return (
            <button
              key={code}
              type="button"
              disabled={!interval}
              onClick={() => interval && onSelectInterval(interval)}
              className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                isTarget
                  ? 'border-[#38E8FF] bg-[#38E8FF]/15 shadow-[0_0_24px_rgba(56,232,255,0.28)]'
                  : isSelected
                    ? 'border-[#2E7BFF] bg-[#2E7BFF]/15'
                    : 'border-white/10 bg-[#0B1018]/90 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] tracking-[0.18em] text-[#7F8EA6]">
                  {code}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    interval ? 'bg-[#38E8FF]' : 'bg-slate-700'
                  }`}
                />
              </div>
              <div className="font-mono-tech mt-3 text-lg font-semibold text-white">
                {interval ? `[${interval.start}, ${interval.end}]` : '— EMPTY —'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Conveyor Strip Schematic */}
      <div className="relative z-10 rounded-xl border border-white/12 bg-[#0A0F18] px-4 py-3">
        <div className="mb-2 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
          <span>Intake Dock</span>
          <span className="text-[#38E8FF]">Laser Scanner Gate</span>
          <span>Diverter Spur</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-[#131B29]">
          <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#38E8FF] shadow-[0_0_12px_#38E8FF]" />
          {activeAnimation && (
            <div className="absolute top-0.5 bottom-0.5 left-1/2 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#2E7BFF] to-[#38E8FF]" />
          )}
        </div>
      </div>
    </div>
  )
}
