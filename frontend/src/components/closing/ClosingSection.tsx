import { ArrowUp, Boxes } from 'lucide-react'

export function ClosingSection({
  onScrollTop,
  onJumpArrival,
}: {
  onScrollTop: () => void
  onJumpArrival: () => void
}) {
  return (
    <footer
      id="closing"
      className="relative overflow-hidden border-t border-white/10 bg-[#05070B] py-28 sm:py-36"
    >
      {/* Ambient Studio Lighting Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(46,123,255,0.16),transparent_58%)]"
      />
      <div className="studio-grid-bg pointer-events-none absolute inset-0 opacity-45" />

      <div className="relative z-10 mx-auto max-w-5xl px-5 text-center sm:px-8">
        <div className="font-mono-tech mb-5 inline-flex items-center gap-2 rounded-full border border-[#38E8FF]/30 bg-[#0C1322]/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[#38E8FF]">
          <Boxes className="h-3.5 w-3.5" />
          <span>07 // Structural Resolution</span>
        </div>

        <h2 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          BRING ORDER TO EVERY ARRIVAL.
        </h2>

        <p className="font-mono-tech mt-6 text-xs uppercase tracking-[0.3em] text-[#C8D3E3] sm:text-sm">
          RANGEX – INTELLIGENT ARRIVAL INDEX.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onJumpArrival}
            className="rounded-full border border-[#38E8FF]/60 bg-gradient-to-r from-[#2E7BFF] to-[#1A5BE0] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_0_32px_-8px_rgba(46,123,255,0.7)] transition-transform hover:scale-[1.02]"
          >
            Dispatch Another Arrival
          </button>

          <button
            type="button"
            onClick={onScrollTop}
            className="font-mono-tech inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-xs uppercase tracking-[0.18em] text-[#C8D3E3] hover:border-[#38E8FF]/45 hover:text-white"
          >
            <ArrowUp className="h-3.5 w-3.5 text-[#38E8FF]" />
            <span>Return to Monolith</span>
          </button>
        </div>

        {/* Modular Branch Coordination Footer */}
        <div className="mt-20 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 text-left font-mono-tech text-[11px] text-[#7F8EA6] sm:grid-cols-3">
          <div>
            <div className="text-white">BRANCH // feature/3d-frontend</div>
            <div className="mt-1">React · Vite · R3F · Drei · GSAP · Tailwind</div>
          </div>
          <div>
            <div className="text-white">ENGINE INTEGRATION</div>
            <div className="mt-1">Member 1 (`avl-core`) · Member 2 (`backend-api`)</div>
          </div>
          <div>
            <div className="text-white">AVL VISUALIZER SLOT</div>
            <div className="mt-1">Member 4 (`avl-visualizer`) via `AvlVisualizerProps`</div>
          </div>
        </div>
      </div>
    </footer>
  )
}
