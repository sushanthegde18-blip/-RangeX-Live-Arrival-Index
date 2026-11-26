import Lenis from 'lenis'
import { useCallback, useEffect, useRef } from 'react'
import { AnalyticsSection } from './components/analytics/AnalyticsSection'
import { AvlVisualizerSlot } from './components/avl/AvlVisualizerSlot'
import { ClosingSection } from './components/closing/ClosingSection'
import { MagneticCursor } from './components/common/MagneticCursor'
import { StudioHud } from './components/common/StudioHud'
import { HeroSection } from './components/hero/HeroSection'
import { IntervalExplorerSection } from './components/intervals/IntervalExplorerSection'
import { WarehouseSection } from './components/warehouse/WarehouseSection'
import { useGraphicsCapabilities } from './hooks/useGraphicsCapabilities'
import { RangeXProvider } from './state/RangeXProvider'
import { useRangeX } from './state/useRangeX'

function RangeXExperience() {
  const graphics = useGraphicsCapabilities()
  const { mode } = useRangeX()
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (graphics.prefersReducedMotion) {
      lenisRef.current?.destroy()
      lenisRef.current = null
      return
    }

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      touchMultiplier: 1.4,
    })
    lenisRef.current = lenis

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = window.requestAnimationFrame(raf)
    }
    rafId = window.requestAnimationFrame(raf)

    return () => {
      window.cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [graphics.prefersReducedMotion])

  const scrollToSection = useCallback(
    (sectionId: string) => {
      const target = document.getElementById(sectionId)
      if (!target) return
      const offset = mode === 'fixture' ? -96 : -56
      if (lenisRef.current && !graphics.prefersReducedMotion) {
        lenisRef.current.scrollTo(target, { offset })
      } else {
        target.scrollIntoView({
          behavior: graphics.prefersReducedMotion ? 'auto' : 'smooth',
        })
      }
    },
    [graphics.prefersReducedMotion, mode],
  )

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F5F8FC]">
      <MagneticCursor disabled={graphics.prefersReducedMotion || graphics.isMobileViewport} />
      <StudioHud graphics={graphics} onNavigateSection={scrollToSection} />

      <main>
        <HeroSection
          graphics={graphics}
          onEnterWarehouse={() => scrollToSection('warehouse')}
        />
        <WarehouseSection graphics={graphics} />
        <IntervalExplorerSection graphics={graphics} />
        <AvlVisualizerSlot graphics={graphics} />
        <AnalyticsSection />
      </main>

      <ClosingSection
        onScrollTop={() => scrollToSection('hero')}
        onJumpArrival={() => scrollToSection('arrival')}
      />
    </div>
  )
}

export function App() {
  return (
    <RangeXProvider>
      <RangeXExperience />
    </RangeXProvider>
  )
}

export default App
