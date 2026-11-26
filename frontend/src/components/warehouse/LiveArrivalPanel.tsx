import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  StepForward,
  Terminal,
  WifiOff,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { IntervalMutationType } from '../../contracts/api'
import { API_CONFIG } from '../../services/apiConfig'
import { useRangeX } from '../../state/useRangeX'

function mutationBadgeStyle(type: IntervalMutationType) {
  switch (type) {
    case 'CREATED':
      return 'border-[#38E8FF]/45 bg-[#38E8FF]/15 text-[#38E8FF]'
    case 'EXTENDED':
      return 'border-[#2E7BFF]/55 bg-[#2E7BFF]/20 text-[#9BC4FF]'
    case 'MERGED':
      return 'border-cyan-300/60 bg-cyan-400/20 text-cyan-200'
    case 'DUPLICATE':
      return 'border-amber-400/50 bg-amber-500/15 text-amber-200'
  }
}

export function LiveArrivalPanel() {
  const {
    mode,
    setMode,
    connectionHealth,
    streamStatusMessage,
    isSubmitting,
    isInitialLoading,
    fetchError,
    submitError,
    lastArrival,
    eventLogs,
    submitPackageArrival,
    refreshAllFromBackend,
    fixtureStepIndex,
    fixtureStepTotal,
    fixtureLabel,
    fixtureDescription,
    advanceFixture,
    resetFixture,
  } = useRangeX()

  const [packageIdInput, setPackageIdInput] = useState('')
  const [priority, setPriority] = useState<'STANDARD' | 'EXPRESS' | 'COLD'>('STANDARD')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const trimmed = packageIdInput.trim()
    if (!trimmed) {
      setValidationError('Enter a numeric Package ID to dispatch.')
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000_000) {
      setValidationError('Package ID must be a non-negative integer.')
      return
    }

    await submitPackageArrival({ packageId: parsed, priority })
  }

  return (
    <div className="studio-panel flex h-full flex-col justify-between rounded-3xl p-6">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#38E8FF]">
              03 // Live Arrival Interface
            </div>
            <h3 className="font-display mt-1 text-2xl font-bold text-white">
              Package Registration
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void refreshAllFromBackend()}
            disabled={mode === 'fixture' || isInitialLoading}
            title="Poll Member 2 C++ backend"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#C8D3E3] transition-colors hover:border-[#38E8FF]/50 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isInitialLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Mode Switcher Tabs: Live Backend vs Visual Fixture Sandbox */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#06090F] p-1">
          <button
            type="button"
            onClick={() => setMode('live')}
            className={`font-mono-tech rounded-lg px-3 py-2 text-[11px] uppercase tracking-wider transition-all ${
              mode === 'live'
                ? 'bg-[#2E7BFF]/25 text-white shadow-[inset_0_0_0_1px_rgba(46,123,255,0.5)]'
                : 'text-[#7F8EA6] hover:text-white'
            }`}
          >
            Real C++ Backend
          </button>
          <button
            type="button"
            onClick={() => setMode('fixture')}
            className={`font-mono-tech inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] uppercase tracking-wider transition-all ${
              mode === 'fixture'
                ? 'bg-amber-500/20 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)]'
                : 'text-[#7F8EA6] hover:text-white'
            }`}
          >
            <FlaskConical className="h-3 w-3" />
            <span>Fixture Preview</span>
          </button>
        </div>

        {/* Live Mode Form */}
        {mode === 'live' ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="rangex-package-id"
                className="font-mono-tech mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#9BAAC0]"
              >
                Package Arrival ID
              </label>
              <div className="flex gap-2">
                <input
                  id="rangex-package-id"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 4 or 5"
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
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#38E8FF]/50 bg-gradient-to-r from-[#2E7BFF] to-[#1D5AE0] px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_30px_-8px_rgba(46,123,255,0.7)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending to C++ Engine...</span>
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4" />
                  <span>Register Arrival</span>
                </>
              )}
            </button>

            {validationError && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Honest Backend Error / Offline State */}
            {(submitError || fetchError || connectionHealth === 'offline') && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 p-3.5 text-xs text-rose-200">
                <div className="mb-1 flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-rose-300">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Backend Connection Required</span>
                </div>
                <p className="leading-relaxed text-rose-200/90">
                  {submitError ||
                    fetchError ||
                    `Waiting for Member 2 C++ backend at ${API_CONFIG.baseUrl}.`}
                </p>
                <p className="font-mono-tech mt-2 text-[10px] text-rose-300/75">
                  No operation was simulated. Use Fixture Preview above only for static UI review.
                </p>
              </div>
            )}
          </form>
        ) : (
          /* Opt-In Static Fixture Playback Controls */
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-400/35 bg-amber-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-amber-300">
                Visual Storyboard {fixtureStepIndex + 1} / {fixtureStepTotal}
              </span>
              <span className="font-mono-tech rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                STATIC FIXTURE
              </span>
            </div>
            <div className="text-sm font-medium text-white">{fixtureLabel}</div>
            <p className="text-xs leading-relaxed text-[#B6C2D4]">{fixtureDescription}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={advanceFixture}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/20 px-4 py-2.5 font-mono-tech text-xs uppercase tracking-wider text-amber-100 hover:bg-amber-400/30"
              >
                <StepForward className="h-3.5 w-3.5" />
                <span>Next Fixture Frame</span>
              </button>
              <button
                type="button"
                onClick={resetFixture}
                title="Reset fixture storyboard"
                className="flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[#C8D3E3] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Latest Confirmed Result Card */}
        {lastArrival && (
          <div className="mt-5 rounded-2xl border border-white/12 bg-[#070B12] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#C8D3E3]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#38E8FF]" />
                {lastArrival.isFixture ? 'Fixture Result' : 'Confirmed Backend Result'}
              </span>
              <span
                className={`font-mono-tech rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${mutationBadgeStyle(
                  lastArrival.mutationType,
                )}`}
              >
                {lastArrival.mutationType}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 font-mono-tech text-xs">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <div className="text-[10px] text-[#7F8EA6]">PACKAGE ID</div>
                <div className="mt-0.5 text-sm font-semibold text-white">#{lastArrival.packageId}</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <div className="text-[10px] text-[#7F8EA6]">TARGET INTERVAL</div>
                <div className="mt-0.5 text-sm font-semibold text-[#38E8FF]">
                  [{lastArrival.targetInterval.start}, {lastArrival.targetInterval.end}]
                </div>
              </div>
            </div>

            <div className="font-mono-tech mt-2.5 flex items-center justify-between text-[11px] text-[#9BAAC0]">
              <span>AVL Rotation Reported:</span>
              <span className="text-white">
                {lastArrival.rotation && lastArrival.rotation.type !== 'NONE'
                  ? lastArrival.rotation.type
                  : 'NONE'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Event Stream Console */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
          <span className="inline-flex items-center gap-1.5">
            <Terminal className="h-3 w-3 text-[#38E8FF]" />
            Event Telemetry
          </span>
          <span className="truncate max-w-[180px]" title={streamStatusMessage}>
            {streamStatusMessage}
          </span>
        </div>

        <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-[#05070B] p-2.5 font-mono-tech text-[11px]">
          {eventLogs.length === 0 ? (
            <div className="py-2 text-center text-[#5E6D85]">
              Awaiting confirmed backend arrival events...
            </div>
          ) : (
            eventLogs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 leading-snug">
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${
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
      </div>
    </div>
  )
}
