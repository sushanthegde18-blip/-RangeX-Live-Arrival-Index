import { Activity, AlertTriangle, Cpu, FlaskConical, Menu, Radio, X } from 'lucide-react'
import { useState } from 'react'
import type { GraphicsCapabilities, GraphicsQualitySetting } from '../../hooks/useGraphicsCapabilities'
import type { AppRoute } from '../../pages/LandingPage'
import { useRangeX } from '../../state/useRangeX'

interface StudioHudProps {
  graphics: GraphicsCapabilities
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
}

const NAV_ITEMS: Array<{ id: AppRoute; label: string }> = [
  { id: 'landing', label: '00 Home' },
  { id: 'dashboard', label: '01 Dashboard' },
  { id: 'avl', label: '02 3D AVL' },
  { id: 'intervals', label: '03 Intervals' },
  { id: 'performance', label: '04 Perf Lab' },
  { id: 'replay', label: '05 Replay' },
]

export function StudioHud({ graphics, activeRoute, onNavigate }: StudioHudProps) {
  const { mode, setMode, connectionHealth } = useRangeX()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const statusConfig =
    mode === 'fixture'
      ? {
          dot: 'bg-amber-400 shadow-[0_0_10px_#f59e0b]',
          label: 'DEV FIXTURE',
          border: 'border-amber-400/35 text-amber-300 bg-amber-500/10',
        }
      : connectionHealth === 'connected'
        ? {
            dot: 'bg-[#38E8FF] shadow-[0_0_10px_#38E8FF]',
            label: 'C++ ENGINE LIVE',
            border: 'border-[#38E8FF]/35 text-[#38E8FF] bg-[#38E8FF]/10',
          }
        : connectionHealth === 'connecting'
          ? {
              dot: 'bg-[#2E7BFF] animate-pulse',
              label: 'CONNECTING API',
              border: 'border-[#2E7BFF]/35 text-[#8CB8FF] bg-[#2E7BFF]/10',
            }
          : {
              dot: 'bg-rose-400',
              label: 'BACKEND OFFLINE',
              border: 'border-rose-400/35 text-rose-300 bg-rose-500/10',
            }

  const handleJump = (route: AppRoute) => {
    setMobileMenuOpen(false)
    onNavigate(route)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 rounded-full border border-[#C8D3E3]/12 bg-[#070A10]/85 px-4 py-2.5 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleJump('landing')}
          className="group flex shrink-0 items-center gap-2.5 text-left focus:outline-none"
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#38E8FF]/40 bg-[#0D1422]">
            <span className="h-2.5 w-2.5 rotate-45 border border-[#38E8FF] bg-[#2E7BFF]/60 transition-transform duration-300 group-hover:rotate-90" />
          </span>
          <div className="whitespace-nowrap">
            <div className="font-display text-sm font-bold tracking-[0.22em] text-white">RANGEX</div>
            <div className="font-mono-tech hidden text-[9px] tracking-[0.16em] text-[#7F8EA6] xl:block">
              ARRIVAL INDEX // AVL
            </div>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 lg:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleJump(item.id)}
                className={`font-mono-tech shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10.5px] uppercase tracking-[0.12em] transition-all ${
                  isActive
                    ? 'border border-[#38E8FF]/45 bg-[#38E8FF]/15 text-[#38E8FF]'
                    : 'text-[#9BAAC0] hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-mono-tech text-[10px] tracking-[0.12em] sm:flex ${statusConfig.border}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusConfig.dot}`} />
            <span>{statusConfig.label}</span>
          </div>

          <button
            type="button"
            onClick={() => setMode(mode === 'live' ? 'fixture' : 'live')}
            title={
              mode === 'live'
                ? 'Switch to static visual fixture preview (not live backend)'
                : 'Return to real C++ backend mode'
            }
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono-tech text-[10px] tracking-[0.1em] transition-all ${
              mode === 'fixture'
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                : 'border-[#C8D3E3]/18 bg-white/5 text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white'
            }`}
          >
            {mode === 'fixture' ? (
              <>
                <Radio className="h-3 w-3 shrink-0" />
                <span className="hidden md:inline">Go Live</span>
              </>
            ) : (
              <>
                <FlaskConical className="h-3 w-3 shrink-0" />
                <span className="hidden md:inline">Fixture</span>
              </>
            )}
          </button>

          <label className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C8D3E3]/15 bg-[#0C1018] px-2.5 py-1 text-[10px] text-[#9BAAC0] xl:flex">
            <Cpu className="h-3 w-3 shrink-0 text-[#38E8FF]" />
            <select
              aria-label="3D Graphics Quality"
              value={graphics.setting}
              onChange={(e) => graphics.setQualitySetting(e.target.value as GraphicsQualitySetting)}
              className="font-mono-tech bg-transparent text-[10px] uppercase tracking-wider text-[#C8D3E3] focus:outline-none"
            >
              <option value="auto" className="bg-[#0C1018]">
                GPU: Auto ({graphics.resolvedTier})
              </option>
              <option value="high" className="bg-[#0C1018]">
                GPU: High
              </option>
              <option value="balanced" className="bg-[#0C1018]">
                GPU: Balanced
              </option>
              <option value="fallback" className="bg-[#0C1018]">
                GPU: 2D Safe
              </option>
            </select>
          </label>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#C8D3E3]/15 bg-white/5 text-[#C8D3E3] lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Explicit Banner when Dev Fixture Preview is active */}
      {mode === 'fixture' && (
        <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-2 rounded-2xl border border-amber-400/35 bg-amber-950/85 px-3.5 py-1.5 text-xs text-amber-200 backdrop-blur-md sm:rounded-full">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="font-mono-tech truncate text-[10px] tracking-wide sm:text-[11px]">
              DEV FIXTURE PREVIEW MODE — Static storyboard frames. Not connected to C++ backend.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMode('live')}
            className="shrink-0 rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-0.5 font-mono-tech text-[10px] uppercase tracking-wider text-amber-100 hover:bg-amber-400/25"
          >
            Go Live
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-[#C8D3E3]/15 bg-[#090D15]/95 p-4 backdrop-blur-xl lg:hidden">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono-tech text-[10px] ${statusConfig.border}`}>
              <Activity className="h-3 w-3" />
              <span>{statusConfig.label}</span>
            </div>
            <select
              aria-label="Mobile 3D Graphics Quality"
              value={graphics.setting}
              onChange={(e) => graphics.setQualitySetting(e.target.value as GraphicsQualitySetting)}
              className="font-mono-tech rounded-full border border-white/15 bg-[#0C1018] px-2.5 py-1 text-[10px] uppercase text-[#C8D3E3]"
            >
              <option value="auto">GPU Auto ({graphics.resolvedTier})</option>
              <option value="high">GPU High</option>
              <option value="balanced">GPU Balanced</option>
              <option value="fallback">2D Fallback</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleJump(item.id)}
                className={`font-mono-tech rounded-xl border px-3 py-2.5 text-left text-xs uppercase tracking-wider ${
                  activeRoute === item.id
                    ? 'border-[#38E8FF]/60 bg-[#38E8FF]/15 text-[#38E8FF]'
                    : 'border-white/10 bg-white/[0.03] text-[#C8D3E3] hover:border-[#38E8FF]/40 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
