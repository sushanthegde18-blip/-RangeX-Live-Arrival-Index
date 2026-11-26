import { useEffect, useRef, useState } from 'react'

interface MagneticCursorProps {
  disabled: boolean
}

export function MagneticCursor({ disabled }: MagneticCursorProps) {
  const ringRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [interactive, setInteractive] = useState(false)

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    if (isCoarsePointer) return

    let targetX = -100
    let targetY = -100
    let currentX = -100
    let currentY = -100
    let rafId = 0

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY
      setVisible(true)
      const target = e.target as HTMLElement | null
      setInteractive(Boolean(target?.closest('a, button, input, select, [role="button"]')))
    }

    const onLeave = () => setVisible(false)

    const tick = () => {
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${interactive ? 1.45 : 1})`
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`
      }
      rafId = window.requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      window.cancelAnimationFrame(rafId)
    }
  }, [disabled, interactive])

  if (disabled) return null

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-50 hidden md:block transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={ringRef}
        className={`fixed top-0 left-0 h-8 w-8 rounded-full border transition-colors duration-200 ${
          interactive
            ? 'border-[#38E8FF]/70 bg-[#38E8FF]/10'
            : 'border-[#C8D3E3]/35 bg-transparent'
        }`}
      />
      <div
        ref={dotRef}
        className="fixed top-0 left-0 h-1.5 w-1.5 rounded-full bg-[#38E8FF] shadow-[0_0_12px_#38E8FF]"
      />
    </div>
  )
}
