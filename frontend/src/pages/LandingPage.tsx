import { ArrowRight, ChevronDown, GitBranch, Layers, ShieldCheck, Sparkles } from 'lucide-react'
import { Suspense, lazy, useEffect, useRef } from 'react'
import { runStaggerReveal } from '../animations/gsapTransitions'
import { HeroFallbackSchematic } from '../components/hero/HeroFallbackSchematic'
import { WebGLErrorBoundary } from '../components/common/WebGLErrorBoundary'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'
import { useRangeX } from '../state/useRangeX'

const HeroWarehouseCanvas = lazy(() => import('../visualization/HeroWarehouseCanvas'))

export type AppRoute = 'landing' | 'dashboard' | 'avl' | 'intervals' | 'performance' | 'replay'

interface LandingPageProps {
  graphics: GraphicsCapabilities
  onNavigate: (route: AppRoute) => void
}

export function LandingPage({ graphics, onNavigate }: LandingPageProps) {
  const { analytics, intervals } = useRangeX()
  const sectionRef = useRef<HTMLElement | null>(null)
  const use3D = graphics.resolvedTier !== 'fallback'

  useEffect(() => {
    return runStaggerReveal(sectionRef.current, '.hero-stagger', graphics.prefersReducedMotion)
  }, [graphics.prefersReducedMotion])

  const fallbackView = (
    <HeroFallbackSchematic
      reason={
        graphics.webglSupported
          ? '2D Architectural Mode Active'
          : 'WebGL Unavailable — 2D Schematic Fallback'
      }
    />
  )

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#05070B] pt-28 pb-12"
    >
      {/* 3D Warehouse Background Canvas */}
      <div className="absolute inset-0 z-0">
        {use3D ? (
          <WebGLErrorBoundary fallback={fallbackView}>
            <Suspense fallback={fallbackView}>
              <HeroWarehouseCanvas graphics={graphics} />
            </Suspense>
          </WebGLErrorBoundary>
        ) : (
          fallbackView
        )}
      </div>

      {/* Left-focused Dark Readability Shield so 3D Labels Stay on Right Stage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#05070B] via-[#05070B]/88 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_76%_48%,transparent_16%,rgba(5,7,11,0.82)_68%,#05070B_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-[#05070B] via-[#05070B]/70 to-transparent"
      />

      {/* Main Hero Content */}
      <div className="relative z-20 mx-auto my-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <div className="hero-stagger mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#38E8FF]/35 bg-[#0B1220]/85 px-4 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#38E8FF] shadow-[0_0_12px_#38E8FF]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.22em] text-[#C8D3E3]">
              RANGEX // INTELLIGENT LIVE ARRIVAL INDEX
            </span>
          </div>

          <h1 className="hero-stagger font-display text-4xl font-extrabold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
            EVERY ARRIVAL.
            <br />
            EVERY RANGE.
            <br />
            <span className="bg-gradient-to-r from-[#38E8FF] via-[#7CB8FF] to-[#2E7BFF] bg-clip-text text-transparent">
              IN REAL TIME.
            </span>
          </h1>

          <p className="hero-stagger mt-6 max-w-xl text-lg font-light leading-relaxed text-[#DCE5F2] sm:text-xl">
            An intelligent live arrival indexing system powered by self-balancing data structures.
          </p>

          <p className="hero-stagger mt-3 max-w-lg text-sm leading-relaxed text-[#92A3BB]">
            Watch incoming cargo packages coalesce into maximal consecutive intervals inside a custom
            C++17 AVL Tree—complete with real-time 3D warehouse routing, rotation kinematics, gap
            intelligence, and time-travel replay.
          </p>

          <div className="hero-stagger mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-[#38E8FF]/65 bg-gradient-to-r from-[#2E7BFF] to-[#1A5BE0] px-7 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_40px_-6px_rgba(46,123,255,0.8)] transition-all duration-300 hover:scale-[1.02] hover:border-[#38E8FF] hover:shadow-[0_0_52px_-4px_rgba(56,232,255,0.75)] focus:outline-none"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('avl')}
              className="font-mono-tech inline-flex items-center gap-2.5 rounded-full border border-[#38E8FF]/35 bg-[#0C1018]/85 px-6 py-4 text-xs uppercase tracking-[0.18em] text-[#E5ECF6] backdrop-blur-md transition-all hover:border-[#38E8FF] hover:bg-[#101C30] hover:text-white"
            >
              <GitBranch className="h-4 w-4 text-[#38E8FF]" />
              <span>Experience AVL Engine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Studio Telemetry Strip + Module Cards */}
      <div className="relative z-20 mx-auto mt-10 w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="hero-stagger grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="studio-panel group rounded-2xl p-4 text-left transition-all hover:border-[#38E8FF]/50"
          >
            <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
              <span>01 // Live Operations</span>
              <ShieldCheck className="h-3.5 w-3.5 text-[#38E8FF]" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-[#38E8FF]">
              Warehouse Dashboard
            </div>
            <div className="font-mono-tech mt-1 text-[11px] text-[#8E9FB8]">
              {analytics ? `${analytics.totalPackages.toLocaleString()} pkgs · ${intervals.length} ranges` : 'Real-time 3D conveyor & merges'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('avl')}
            className="studio-panel group rounded-2xl p-4 text-left transition-all hover:border-[#38E8FF]/50"
          >
            <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
              <span>02 // 3D Tree Physics</span>
              <GitBranch className="h-3.5 w-3.5 text-[#2E7BFF]" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-[#38E8FF]">
              3D AVL Visualizer
            </div>
            <div className="font-mono-tech mt-1 text-[11px] text-[#8E9FB8]">
              Step-by-step LL / RR / LR / RL traces
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('intervals')}
            className="studio-panel group rounded-2xl p-4 text-left transition-all hover:border-[#38E8FF]/50"
          >
            <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
              <span>03 // Gap Intelligence</span>
              <Layers className="h-3.5 w-3.5 text-[#38E8FF]" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-[#38E8FF]">
              Interval Explorer
            </div>
            <div className="font-mono-tech mt-1 text-[11px] text-[#8E9FB8]">
              Bridge merges &amp; O(log k) gap queries
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('performance')}
            className="studio-panel group rounded-2xl p-4 text-left transition-all hover:border-[#38E8FF]/50"
          >
            <div className="flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
              <span>04 // Benchmarks &amp; Replay</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-[#38E8FF]">
              Perf Lab &amp; Time-Travel
            </div>
            <div className="font-mono-tech mt-1 text-[11px] text-[#8E9FB8]">
              50K stress tests &amp; operation replay
            </div>
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#6E7D96]">
          <span>Click any moving 3D crate to inspect · Move pointer for optical parallax</span>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-[#9BAAC0] hover:text-[#38E8FF]"
          >
            <span>Enter Command Deck</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
