import gsap from 'gsap'
import { ArrowDownRight, ChevronDown, ShieldCheck } from 'lucide-react'
import { Suspense, lazy, useEffect, useRef } from 'react'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'
import { useRangeX } from '../../state/useRangeX'
import { WebGLErrorBoundary } from '../common/WebGLErrorBoundary'
import { HeroFallbackSchematic } from './HeroFallbackSchematic'

const HeroMonolithCanvas = lazy(() => import('./HeroMonolithCanvas'))

interface HeroSectionProps {
  graphics: GraphicsCapabilities
  onEnterWarehouse: () => void
}

export function HeroSection({ graphics, onEnterWarehouse }: HeroSectionProps) {
  const { mode } = useRangeX()
  const sectionRef = useRef<HTMLElement | null>(null)
  const use3D = graphics.resolvedTier !== 'fallback'

  useEffect(() => {
    if (graphics.prefersReducedMotion || !sectionRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.hero-stagger',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          stagger: 0.11,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      )
    }, sectionRef)

    return () => ctx.revert()
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
      id="hero"
      ref={sectionRef}
      className={`relative flex min-h-screen w-full items-center overflow-hidden bg-[#05070B] pb-16 scroll-mt-28 ${
        mode === 'fixture' ? 'pt-36 sm:pt-32' : 'pt-24 sm:pt-28'
      }`}
    >
      {/* 3D Background Canvas */}
      <div className="absolute inset-0 z-0">
        {use3D ? (
          <WebGLErrorBoundary fallback={fallbackView}>
            <Suspense fallback={fallbackView}>
              <HeroMonolithCanvas graphics={graphics} />
            </Suspense>
          </WebGLErrorBoundary>
        ) : (
          fallbackView
        )}
      </div>

      {/* Studio Gradient Vignettes for Legible Editorial Typography */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_68%_45%,transparent_12%,rgba(5,7,11,0.86)_65%,#05070B_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-[#05070B] via-[#05070B]/70 to-transparent"
      />

      {/* Foreground Content */}
      <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-col justify-between gap-12 px-5 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <div className="hero-stagger mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#38E8FF]/30 bg-[#0B1220]/75 px-3.5 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#38E8FF] shadow-[0_0_10px_#38E8FF]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-[#C8D3E3]">
              01 // Kinetic Spatial Indexing Engine
            </span>
          </div>

          <h1 className="hero-stagger font-display text-[2.65rem] font-extrabold tracking-[0.06em] text-white sm:text-7xl lg:text-8xl">
            RANGEX
          </h1>

          <p className="hero-stagger mt-5 max-w-2xl text-2xl font-light leading-tight tracking-tight text-[#DCE5F2] sm:text-4xl">
            Every arrival changes the structure.
          </p>

          <p className="hero-stagger font-mono-tech mt-4 text-xs uppercase tracking-[0.28em] text-[#38E8FF] sm:text-sm">
            AN INTELLIGENT WAREHOUSE ARRIVAL INDEX.
          </p>

          <p className="hero-stagger mt-6 max-w-xl text-sm leading-relaxed text-[#92A1B8] sm:text-base">
            Watch physical cargo routing synchronize with continuous range consolidation and balanced
            AVL interval indexing—built as a real-time digital twin connected to our C++ core.
          </p>

          <div className="hero-stagger mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onEnterWarehouse}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-[#38E8FF]/60 bg-gradient-to-r from-[#2E7BFF] to-[#1A5BE0] px-7 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_38px_-6px_rgba(46,123,255,0.75)] transition-all duration-300 hover:scale-[1.02] hover:border-[#38E8FF] hover:shadow-[0_0_48px_-4px_rgba(56,232,255,0.7)] focus:outline-none"
            >
              <span>ENTER THE WAREHOUSE</span>
              <ArrowDownRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
            </button>

            <a
              href="#arrival"
              className="font-mono-tech inline-flex items-center gap-2 rounded-full border border-[#C8D3E3]/20 bg-[#0C1018]/75 px-5 py-4 text-xs uppercase tracking-[0.16em] text-[#C8D3E3] backdrop-blur-md transition-colors hover:border-[#38E8FF]/45 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-[#38E8FF]" />
              <span>Live Arrival Deck</span>
            </a>
          </div>
        </div>

        {/* Bottom Architectural Telemetry Bar */}
        <div className="hero-stagger flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-10">
            <div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#7F8EA6]">
                Index Structure
              </div>
              <div className="mt-1 text-sm font-medium text-[#E5ECF6]">Disjoint Merged Ranges</div>
            </div>
            <div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#7F8EA6]">
                Core Engine
              </div>
              <div className="mt-1 text-sm font-medium text-[#E5ECF6]">C++ AVL Tree API</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#7F8EA6]">
                Interaction
              </div>
              <div className="mt-1 text-sm font-medium text-[#38E8FF]">Move pointer to align core</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onEnterWarehouse}
            className="font-mono-tech hidden items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#7F8EA6] transition-colors hover:text-[#38E8FF] sm:inline-flex"
          >
            <span>Scroll to Floor</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </button>
        </div>
      </div>
    </section>
  )
}
