import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MagneticCursor } from './components/common/MagneticCursor'
import { StudioHud } from './components/common/StudioHud'
import { useGraphicsCapabilities } from './hooks/useGraphicsCapabilities'
import { AvlVisualizerPage } from './pages/AvlVisualizerPage'
import { DashboardPage } from './pages/DashboardPage'
import { IntervalExplorerPage } from './pages/IntervalExplorerPage'
import { LandingPage, type AppRoute } from './pages/LandingPage'
import { PerformanceLabPage } from './pages/PerformanceLabPage'
import { TimeTravelPage } from './pages/TimeTravelPage'
import { RangeXProvider } from './state/RangeXProvider'

const VALID_ROUTES: AppRoute[] = [
  'landing',
  'dashboard',
  'avl',
  'intervals',
  'performance',
  'replay',
]

function parseRouteFromHash(): AppRoute {
  if (typeof window === 'undefined') return 'landing'
  const raw = window.location.hash.replace(/^#\/?/, '').trim() as AppRoute
  return VALID_ROUTES.includes(raw) ? raw : 'landing'
}

function RangeXExperience() {
  const graphics = useGraphicsCapabilities()
  const [activeRoute, setActiveRoute] = useState<AppRoute>(parseRouteFromHash)
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const onHashChange = () => {
      setActiveRoute(parseRouteFromHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (graphics.prefersReducedMotion) {
      lenisRef.current?.destroy()
      lenisRef.current = null
      return
    }

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      touchMultiplier: 1.35,
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

  const navigateTo = useCallback((route: AppRoute) => {
    setActiveRoute(route)
    const targetHash = route === 'landing' ? '#/' : `#/${route}`
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F5F8FC]">
      <MagneticCursor disabled={graphics.prefersReducedMotion || graphics.isMobileViewport} />
      <StudioHud graphics={graphics} activeRoute={activeRoute} onNavigate={navigateTo} />

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRoute}
            initial={graphics.prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={graphics.prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: graphics.prefersReducedMotion ? 0 : 0.25 }}
          >
            {activeRoute === 'landing' && (
              <LandingPage graphics={graphics} onNavigate={navigateTo} />
            )}
            {activeRoute === 'dashboard' && (
              <DashboardPage graphics={graphics} onNavigate={navigateTo} />
            )}
            {activeRoute === 'avl' && <AvlVisualizerPage graphics={graphics} />}
            {activeRoute === 'intervals' && <IntervalExplorerPage graphics={graphics} />}
            {activeRoute === 'performance' && <PerformanceLabPage />}
            {activeRoute === 'replay' && <TimeTravelPage graphics={graphics} />}
          </motion.div>
        </AnimatePresence>
      </main>
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
