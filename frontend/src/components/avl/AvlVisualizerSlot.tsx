import { GitBranch, Layers, PlugZap, RotateCw, Search } from 'lucide-react'
import { useMemo, type ComponentType } from 'react'
import type { AvlNodeSnapshot, IntervalRange } from '../../contracts/api'
import {
  RANGEX_AVL_THEME_TOKENS,
  type AvlVisualizerProps,
} from '../../contracts/avl'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'
import { useRangeX } from '../../state/useRangeX'

export interface AvlVisualizerSlotProps {
  /**
   * Member 4 (`feature/avl-visualizer`) passes their animated AVL component here.
   * When omitted, this slot renders a diagnostic contract inspector showing the
   * exact live backend props ready for Member 4's integration.
   */
  VisualizerComponent?: ComponentType<AvlVisualizerProps>
  graphics: GraphicsCapabilities
}

function DefaultContractMountPreview({
  snapshot,
  lastMutation,
  highlightedNodeIds,
  searchPath,
  activeRotation,
  isLoading,
  error,
  mode,
  onNodeSelect,
}: AvlVisualizerProps) {
  const nodesByDepth = useMemo(() => {
    if (!snapshot) return [] as Array<{ depth: number; nodes: AvlNodeSnapshot[] }>
    const map = new Map<number, AvlNodeSnapshot[]>()
    for (const node of snapshot.nodes) {
      const depth = node.depth ?? 0
      const list = map.get(depth) ?? []
      list.push(node)
      map.set(depth, list)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodes]) => ({ depth, nodes }))
  }, [snapshot])

  return (
    <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-[#38E8FF]/35 bg-[#060910] p-6">
      <div className="studio-grid-bg pointer-events-none absolute inset-0 opacity-45" />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <PlugZap className="h-4 w-4 text-[#38E8FF]" />
          <span className="font-mono-tech text-xs uppercase tracking-[0.18em] text-[#E5ECF6]">
            Member 4 Integration Mount Point (AvlVisualizerProps)
          </span>
        </div>
        <span className="font-mono-tech rounded-full border border-[#2E7BFF]/40 bg-[#2E7BFF]/15 px-3 py-1 text-[10px] uppercase tracking-wider text-[#9BC4FF]">
          {mode === 'fixture' ? 'Receiving Fixture Snapshot' : 'Receiving Live Backend Snapshot'}
        </span>
      </div>

      {/* Diagnostic Topology / Status Display (No AVL Algorithm Computed Here) */}
      <div className="relative z-10 my-6 flex-1">
        {isLoading && !snapshot ? (
          <div className="flex h-48 items-center justify-center font-mono-tech text-xs uppercase tracking-widest text-[#7F8EA6]">
            Waiting for backend AVL tree snapshot...
          </div>
        ) : error && !snapshot ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <p className="font-mono-tech text-xs uppercase tracking-wider text-rose-300">
              No AVL Snapshot Available
            </p>
            <p className="mt-2 max-w-md text-xs text-[#8D9DB5]">{error}</p>
          </div>
        ) : !snapshot || snapshot.nodes.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <GitBranch className="mb-2 h-6 w-6 text-[#55647B]" />
            <p className="text-sm text-[#9BAAC0]">
              Backend returned an empty AVL tree (`rootId: null`).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
              Read-only Snapshot Telemetry (Awaiting Member 4&apos;s Animated Renderer)
            </div>
            <div className="space-y-3">
              {nodesByDepth.map((level) => (
                <div key={level.depth} className="flex flex-wrap items-center justify-center gap-3">
                  {level.nodes.map((node) => {
                    const isHighlighted = highlightedNodeIds.includes(node.id)
                    const inSearchPath = searchPath.includes(node.id)
                    const isPivot = activeRotation?.pivotNodeId === node.id

                    return (
                      <button
                        key={String(node.id)}
                        type="button"
                        onClick={() => onNodeSelect?.(node.id, node.interval)}
                        className={`min-w-[148px] rounded-xl border px-3.5 py-2.5 text-left font-mono-tech transition-all ${
                          isPivot
                            ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_18px_rgba(245,158,11,0.35)]'
                            : isHighlighted
                              ? 'border-[#38E8FF] bg-[#38E8FF]/15 shadow-[0_0_18px_rgba(56,232,255,0.3)]'
                              : inSearchPath
                                ? 'border-[#2E7BFF] bg-[#2E7BFF]/15'
                                : 'border-white/12 bg-[#0B1018] hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#7F8EA6]">
                          <span>NODE {String(node.id)}</span>
                          <span>BF:{node.balanceFactor}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          [{node.interval.start}, {node.interval.end}]
                        </div>
                        <div className="mt-1 text-[10px] text-[#8E9FB8]">
                          H:{node.height} · L:{node.leftId ?? '∅'} · R:{node.rightId ?? '∅'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Contract Telemetry Footer */}
      <div className="relative z-10 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 font-mono-tech text-[11px] sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase text-[#7F8EA6]">Search Path Prop</div>
          <div className="mt-1 truncate text-[#C8D3E3]">
            {searchPath.length > 0 ? searchPath.join(' -> ') : '[]'}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase text-[#7F8EA6]">Active Rotation Prop</div>
          <div className="mt-1 text-white">
            {activeRotation && activeRotation.type !== 'NONE'
              ? `${activeRotation.type} (pivot: ${activeRotation.pivotNodeId ?? '—'})`
              : 'NONE (No rotation reported)'}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase text-[#7F8EA6]">Last Mutation Cue</div>
          <div className="mt-1 truncate text-[#38E8FF]">
            {lastMutation
              ? `${lastMutation.mutationType} #${lastMutation.packageId}`
              : 'Idle'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AvlVisualizerSlot({ VisualizerComponent, graphics }: AvlVisualizerSlotProps) {
  const {
    avlSnapshot,
    lastMutationCue,
    highlightedNodeIds,
    searchPath,
    activeRotation,
    isInitialLoading,
    fetchError,
    mode,
    setSelectedIntervalId,
    clearActiveAnimation,
  } = useRangeX()

  const handleNodeSelect = (_nodeId: string | number, interval: IntervalRange) => {
    setSelectedIntervalId(interval.id ?? `${interval.start}-${interval.end}`)
  }

  const handleAnimationComplete = (eventId: string) => {
    clearActiveAnimation(eventId)
  }

  const sharedProps: AvlVisualizerProps = {
    snapshot: avlSnapshot,
    lastMutation: lastMutationCue,
    highlightedNodeIds,
    searchPath,
    activeRotation,
    isLoading: isInitialLoading,
    error: fetchError,
    mode,
    reducedMotion: graphics.prefersReducedMotion,
    theme: RANGEX_AVL_THEME_TOKENS,
    onNodeSelect: handleNodeSelect,
    onAnimationComplete: handleAnimationComplete,
  }

  return (
    <section
      id="avl-index"
      className="relative scroll-mt-24 border-t border-white/10 bg-[#05070B] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="font-mono-tech mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#38E8FF]">
              <span>05 // AVL Tree Visualization Area</span>
              <span className="h-px w-10 bg-[#38E8FF]/40" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Balanced Interval Index Core.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-[#92A1B8]">
            Reusable integration container built for Member 4&apos;s AVL visualizer module—streaming
            backend-confirmed nodes, edges, search paths, and rotations without client-side tree
            recomputation.
          </p>
        </div>

        {/* Capabilities & Signal Strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="studio-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-[#7F8EA6]">
              <Layers className="h-3.5 w-3.5 text-[#38E8FF]" />
              <span>Tree Height</span>
            </div>
            <div className="font-display mt-1 text-2xl font-bold text-white">
              {avlSnapshot ? avlSnapshot.height : '—'}
            </div>
          </div>

          <div className="studio-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-[#7F8EA6]">
              <GitBranch className="h-3.5 w-3.5 text-[#2E7BFF]" />
              <span>AVL Nodes</span>
            </div>
            <div className="font-display mt-1 text-2xl font-bold text-white">
              {avlSnapshot ? avlSnapshot.nodeCount : '—'}
            </div>
          </div>

          <div className="studio-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-[#7F8EA6]">
              <Search className="h-3.5 w-3.5 text-[#38E8FF]" />
              <span>Search Hops</span>
            </div>
            <div className="font-display mt-1 text-2xl font-bold text-white">
              {searchPath.length > 0 ? searchPath.length : '—'}
            </div>
          </div>

          <div className="studio-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-wider text-[#7F8EA6]">
              <RotateCw className="h-3.5 w-3.5 text-amber-400" />
              <span>Rotation Event</span>
            </div>
            <div className="font-display mt-1 text-2xl font-bold text-white">
              {activeRotation && activeRotation.type !== 'NONE' ? activeRotation.type : 'NONE'}
            </div>
          </div>
        </div>

        {/* Pluggable Member 4 Component Slot */}
        <div className="studio-panel rounded-3xl p-4 sm:p-6">
          {VisualizerComponent ? (
            <VisualizerComponent {...sharedProps} />
          ) : (
            <DefaultContractMountPreview {...sharedProps} />
          )}
        </div>
      </div>
    </section>
  )
}
