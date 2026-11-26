import { useEffect, useMemo, useState } from 'react'

export type GraphicsQualitySetting = 'auto' | 'high' | 'balanced' | 'fallback'
export type ResolvedGraphicsTier = 'high' | 'balanced' | 'fallback'

export interface GraphicsCapabilities {
  webglSupported: boolean
  prefersReducedMotion: boolean
  isMobileViewport: boolean
  isLowEndHardware: boolean
  setting: GraphicsQualitySetting
  resolvedTier: ResolvedGraphicsTier
  dpr: [number, number]
  particleCount: number
  enableReflections: boolean
  setQualitySetting: (next: GraphicsQualitySetting) => void
}

function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

export function useGraphicsCapabilities(): GraphicsCapabilities {
  const [setting, setSetting] = useState<GraphicsQualitySetting>('auto')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  const webglSupported = useMemo(() => detectWebGLSupport(), [])

  const isLowEndHardware = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    const cores = navigator.hardwareConcurrency ?? 4
    const navWithMemory = navigator as Navigator & { deviceMemory?: number }
    const memory = navWithMemory.deviceMemory ?? 8
    return cores <= 2 || memory <= 2
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    media.addEventListener('change', onMotionChange)

    const onResize = () => setIsMobileViewport(window.innerWidth < 768)
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      media.removeEventListener('change', onMotionChange)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const resolvedTier: ResolvedGraphicsTier = useMemo(() => {
    if (!webglSupported) return 'fallback'
    if (setting !== 'auto') return setting
    if (isLowEndHardware || isMobileViewport) return 'balanced'
    return 'high'
  }, [webglSupported, setting, isLowEndHardware, isMobileViewport])

  const dpr: [number, number] =
    resolvedTier === 'high' ? [1, 2] : resolvedTier === 'balanced' ? [1, 1.35] : [1, 1]

  const particleCount =
    prefersReducedMotion || resolvedTier === 'fallback'
      ? 0
      : resolvedTier === 'high'
        ? 180
        : 70

  return {
    webglSupported,
    prefersReducedMotion,
    isMobileViewport,
    isLowEndHardware,
    setting,
    resolvedTier,
    dpr,
    particleCount,
    enableReflections: resolvedTier === 'high' && !prefersReducedMotion,
    setQualitySetting: setSetting,
  }
}
