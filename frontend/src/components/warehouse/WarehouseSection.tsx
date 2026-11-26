import { Camera, Eye, ZoomIn, ZoomOut } from 'lucide-react'
import { Suspense, lazy, useState } from 'react'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'
import { useRangeX } from '../../state/useRangeX'
import { WebGLErrorBoundary } from '../common/WebGLErrorBoundary'
import { LiveArrivalPanel } from './LiveArrivalPanel'
import type { WarehouseCameraPreset } from './WarehouseFloorCanvas'
import { WarehouseFallback2D } from './WarehouseFallback2D'

const WarehouseFloorCanvas = lazy(() => import('./WarehouseFloorCanvas'))

const PRESETS: Array<{ id: WarehouseCameraPreset; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'scanner', label: 'Scanner Gate' },
  { id: 'racks', label: 'Storage Racks' },
  { id: 'intake', label: 'Intake Dock' },
]

export function WarehouseSection({ graphics }: { graphics: GraphicsCapabilities }) {
  const {
    intervals,
    selectedIntervalId,
    setSelectedIntervalId,
    activeAnimation,
    clearActiveAnimation,
    mode,
  } = useRangeX()

  const [cameraPreset, setCameraPreset] = useState<WarehouseCameraPreset>('overview')
  const [presetTrigger, setPresetTrigger] = useState(0)
  const [interactiveZoom, setInteractiveZoom] = useState(false)

  const use3D = graphics.resolvedTier !== 'fallback'

  const fallbackView = (
    <WarehouseFallback2D
      intervals={intervals}
      selectedIntervalId={selectedIntervalId}
      activeAnimation={activeAnimation}
      onSelectInterval={(interval) =>
        setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
      }
      reason={
        graphics.webglSupported
          ? '2D Warehouse Schematic Active'
          : 'WebGL Unavailable — 2D Schematic Fallback'
      }
    />
  )

  return (
    <section
      id="warehouse"
      className="relative scroll-mt-24 border-t border-white/10 bg-[#05070B] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>02 // Interactive Warehouse Floor</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Physical Routing Meets Index Precision.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-[#92A1B8]">
            Every package entering the intake dock clears the optical scanner gate and routes to a
            live interval bay only after confirmation from Member 2&apos;s C++ engine.
          </p>
        </div>

        {/* Main Split Studio Layout: 3D Floor (Section 2) + Live Arrival Interface (Section 3) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 3D Warehouse Viewport */}
          <div className="studio-panel relative overflow-hidden rounded-3xl lg:col-span-7 xl:col-span-8">
            {/* Viewport Top HUD */}
            <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#060910]/75 px-4 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono-tech mr-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
                  <Camera className="h-3.5 w-3.5 text-[#38E8FF]" />
                  Cam
                </span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCameraPreset(preset.id)
                      setPresetTrigger((n) => n + 1)
                    }}
                    className={`font-mono-tech rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                      cameraPreset === preset.id
                        ? 'border border-[#38E8FF]/50 bg-[#38E8FF]/15 text-[#38E8FF]'
                        : 'border border-white/10 bg-white/[0.03] text-[#9BAAC0] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {use3D && (
                  <button
                    type="button"
                    onClick={() => setInteractiveZoom((z) => !z)}
                    className={`font-mono-tech inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                      interactiveZoom
                        ? 'border-[#2E7BFF]/60 bg-[#2E7BFF]/20 text-white'
                        : 'border-white/10 bg-white/[0.03] text-[#9BAAC0] hover:text-white'
                    }`}
                    title="Toggle wheel zoom inside the 3D warehouse viewport"
                  >
                    {interactiveZoom ? (
                      <>
                        <ZoomIn className="h-3 w-3 text-[#38E8FF]" />
                        <span>Wheel Zoom On</span>
                      </>
                    ) : (
                      <>
                        <ZoomOut className="h-3 w-3" />
                        <span>Scroll Safe</span>
                      </>
                    )}
                  </button>
                )}

                <span
                  className={`font-mono-tech rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                    mode === 'fixture'
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                      : 'border-white/10 bg-white/[0.03] text-[#9BAAC0]'
                  }`}
                >
                  {mode === 'fixture' ? 'FIXTURE VISUAL' : `${intervals.length} BAYS ACTIVE`}
                </span>
              </div>
            </div>

            {/* 3D Canvas Container */}
            <div className="h-[460px] w-full sm:h-[540px] lg:h-[620px]">
              {use3D ? (
                <WebGLErrorBoundary fallback={fallbackView}>
                  <Suspense fallback={fallbackView}>
                    <WarehouseFloorCanvas
                      graphics={graphics}
                      intervals={intervals}
                      selectedIntervalId={selectedIntervalId}
                      activeAnimation={activeAnimation}
                      cameraPreset={cameraPreset}
                      presetTrigger={presetTrigger}
                      interactiveZoom={interactiveZoom}
                      onSelectInterval={(interval) =>
                        setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
                      }
                      onAnimationComplete={clearActiveAnimation}
                    />
                  </Suspense>
                </WebGLErrorBoundary>
              ) : (
                fallbackView
              )}
            </div>

            {/* Bottom Viewport Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#060910]/85 px-4 py-2.5">
              <div className="font-mono-tech flex items-center gap-2 text-[11px] text-[#9BAAC0]">
                <Eye className="h-3.5 w-3.5 text-[#38E8FF]" />
                {activeAnimation ? (
                  <span className="text-[#38E8FF]">
                    CONVEYOR DISPATCH: PKG #{activeAnimation.packageId} → [
                    {activeAnimation.targetInterval.start}, {activeAnimation.targetInterval.end}] (
                    {activeAnimation.mutationType})
                  </span>
                ) : (
                  <span>Drag to orbit warehouse · Click any storage rack to inspect interval</span>
                )}
              </div>

              <div className="font-mono-tech text-[10px] uppercase tracking-[0.18em] text-[#7F8EA6]">
                RENDER: {graphics.resolvedTier.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Section 3: Live Arrival Registration Deck */}
          <div id="arrival" className="lg:col-span-5 xl:col-span-4">
            <LiveArrivalPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
