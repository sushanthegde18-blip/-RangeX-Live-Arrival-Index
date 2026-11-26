import React, { Component, ErrorInfo, ReactNode, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Crosshair,
  Eye,
  GitFork,
  Layers,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { useAvlStore } from '../../store/useAvlStore';
import { computeTreeLayout } from '../../utils/treeLayout';
import { Tree2DSvg } from './Tree2DSvg';
import { Tree3DCanvas } from './Tree3DCanvas';

interface WebGlErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class WebGlErrorBoundary extends Component<WebGlErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {
    // Gracefully degrades to 2D SVG viewport when WebGL is unavailable
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const STEP_LABELS: Record<number, string> = {
  1: 'Package Arrives',
  2: 'Highlight Root',
  3: 'Search Traversal',
  4: 'Predecessor Interval',
  5: 'Successor Interval',
  6: 'Bridge Detected',
  7: 'Merging Intervals',
  8: 'AVL Tree Updated',
  9: 'Interval List Updated',
  10: 'Insertion Completed',
};

export const TreeStageViewport: React.FC = () => {
  const frames = useAvlStore((s) => s.frames);
  const cursor = useAvlStore((s) => s.cursor);
  const viewMode = useAvlStore((s) => s.viewMode);
  const selectedNodeId = useAvlStore((s) => s.selectedNodeId);
  const focusSubtreeRootId = useAvlStore((s) => s.focusSubtreeRootId);
  const highlightedSearchPathOnly = useAvlStore((s) => s.highlightedSearchPathOnly);
  const playbackSpeed = useAvlStore((s) => s.playbackSpeed);
  const cameraResetNonce = useAvlStore((s) => s.cameraResetNonce);
  const connectionStatus = useAvlStore((s) => s.connectionStatus);
  const isAwaitingBackendResponse = useAvlStore((s) => s.isAwaitingBackendResponse);

  const setViewMode = useAvlStore((s) => s.setViewMode);
  const selectNode = useAvlStore((s) => s.selectNode);
  const setFocusSubtreeRootId = useAvlStore((s) => s.setFocusSubtreeRootId);
  const setHighlightedSearchPathOnly = useAvlStore((s) => s.setHighlightedSearchPathOnly);
  const triggerCameraReset = useAvlStore((s) => s.triggerCameraReset);

  const currentFrame = cursor >= 0 && cursor < frames.length ? frames[cursor] : null;
  const snapshot = currentFrame?.snapshot ?? { rootId: null, nodesById: {}, nodeOrder: [] };
  const visual = currentFrame?.visual ?? null;

  const layout = useMemo(
    () => computeTreeLayout(snapshot, focusSubtreeRootId),
    [snapshot, focusSubtreeRootId],
  );

  const selectedNode = selectedNodeId ? snapshot.nodesById[selectedNodeId] ?? null : null;
  const isTreeEmpty = layout.totalVisibleNodes === 0;
  const isLargeTree = snapshot.nodeOrder.length > 40;

  return (
    <div className="rangex-panel relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-charcoal-950/90 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-charcoal-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === '3d'
                  ? 'bg-electric-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              3D Metallic
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === '2d'
                  ? 'bg-electric-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              2D SVG Fallback
            </button>
          </div>

          {isLargeTree && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-300">
              Performance Mode ({snapshot.nodeOrder.length} nodes)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHighlightedSearchPathOnly(!highlightedSearchPathOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
              highlightedSearchPathOnly
                ? 'border-cyanpulse-400/60 bg-cyanpulse-500/15 text-cyanpulse-300'
                : 'border-slate-700/80 bg-charcoal-900 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Search Path Focus
          </button>

          {focusSubtreeRootId && (
            <button
              type="button"
              onClick={() => setFocusSubtreeRootId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-500/15 px-2.5 py-1 text-xs text-purple-200 hover:bg-purple-500/25"
            >
              <GitFork className="h-3.5 w-3.5" />
              Exit Subtree Focus
            </button>
          )}

          <button
            type="button"
            onClick={triggerCameraReset}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-charcoal-900 px-2.5 py-1 text-xs text-slate-300 hover:border-electric-500 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Camera
          </button>
        </div>
      </div>

      {/* Main Tree Canvas */}
      <div className="rangex-grid-bg relative flex-1 overflow-hidden">
        {/* 10-Stage Live Insertion Progress HUD */}
        <AnimatePresence>
          {visual && visual.stepNumber > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-electric-500/30 bg-charcoal-950/90 px-3.5 py-2 backdrop-blur-md"
            >
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-electric-600/25 px-2 py-0.5 font-mono text-xs font-bold text-cyanpulse-300 ring-1 ring-electric-500/40">
                  STEP {visual.stepNumber}/10
                </span>
                <span className="text-xs font-semibold text-slate-100">
                  {STEP_LABELS[visual.stepNumber] ?? visual.stage}
                </span>
                {visual.packageId !== null && (
                  <span className="rounded border border-slate-700 bg-charcoal-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                    PKG #{visual.packageId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {Array.from({ length: 10 }, (_, idx) => {
                  const step = idx + 1;
                  const active = step === visual.stepNumber;
                  const completed = step < visual.stepNumber;
                  return (
                    <span
                      key={step}
                      className={`h-1.5 w-4 rounded-full transition-all ${
                        active
                          ? 'bg-cyanpulse-400 shadow-cyanGlow w-6'
                          : completed
                            ? 'bg-electric-500'
                            : 'bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backend-reported Rotation HUD */}
        <AnimatePresence>
          {visual?.activeRotation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-none absolute right-3 top-16 z-10 max-w-xs rounded-xl border border-amber-400/50 bg-charcoal-950/95 p-3 shadow-lg backdrop-blur"
            >
              <div className="flex items-center gap-2 text-amber-300">
                <Sparkles className="h-4 w-4" />
                <span className="font-mono text-xs font-bold tracking-wide">
                  {visual.activeRotation.type} ROTATION ({visual.stage === 'ROTATION_DETECTED' ? 'DETECTED' : 'APPLIED'})
                </span>
              </div>
              <div className="mt-1.5 space-y-1 font-mono text-[11px] text-slate-300">
                <div>
                  Unbalanced:{' '}
                  <span className="text-red-400">{visual.activeRotation.unbalancedNodeId}</span>{' '}
                  (BF:{' '}
                  {visual.activeRotation.unbalancedBalanceFactor > 0
                    ? `+${visual.activeRotation.unbalancedBalanceFactor}`
                    : visual.activeRotation.unbalancedBalanceFactor}
                  )
                </div>
                <div>
                  Pivot Node:{' '}
                  <span className="text-amber-300">{visual.activeRotation.pivotNodeId}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backend-reported Merge Bridge HUD */}
        <AnimatePresence>
          {visual?.activeMerge && (visual.stage === 'BRIDGE_DETECTED' || visual.stage === 'INTERVAL_MERGING') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="pointer-events-none absolute left-3 top-16 z-10 rounded-xl border border-cyanpulse-400/45 bg-charcoal-950/95 p-3 backdrop-blur"
            >
              <div className="font-mono text-[11px] font-bold text-cyanpulse-300">
                INTERVAL BRIDGE MERGE
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-xs text-slate-200">
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300">
                  [{visual.activeMerge.leftInterval[0]}, {visual.activeMerge.leftInterval[1]}]
                </span>
                <span className="text-cyanpulse-400">+ {visual.activeMerge.bridgePackage} +</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">
                  [{visual.activeMerge.rightInterval[0]}, {visual.activeMerge.rightInterval[1]}]
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded bg-electric-600/30 px-2 py-0.5 font-bold text-cyanpulse-300 ring-1 ring-cyanpulse-400/50">
                  [{visual.activeMerge.mergedInterval[0]}, {visual.activeMerge.mergedInterval[1]}]
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty / Loading / Disconnected State */}
        {isTreeEmpty ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            {connectionStatus === 'connecting' || isAwaitingBackendResponse ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-cyanpulse-400" />
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  Synchronizing Authoritative AVL Tree...
                </h3>
                <p className="mt-1.5 max-w-md text-xs text-slate-400">
                  Waiting for backend snapshot and event stream from Member 2&apos;s C++ AVL gateway.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/80 bg-charcoal-900/90 text-cyanpulse-400">
                  {connectionStatus === 'connected' ? (
                    <GitFork className="h-7 w-7" />
                  ) : (
                    <WifiOff className="h-7 w-7 text-slate-400" />
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  {connectionStatus === 'connected'
                    ? 'AVL Tree is Currently Empty'
                    : 'No Active Tree Snapshot'}
                </h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                  {connectionStatus === 'connected'
                    ? 'Enter a Package ID above to send an arrival to the C++ AVL backend and watch the live traversal.'
                    : 'Connect to Member 2’s live backend stream or load a Recorded Backend Trace fixture from the top bar to inspect real C++ AVL event sequences.'}
                </p>
              </>
            )}
          </div>
        ) : viewMode === '3d' ? (
          <WebGlErrorBoundary
            fallback={
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  WebGL context unavailable — automatically rendering 2D SVG tree fallback.
                </div>
                <div className="flex-1">
                  <Tree2DSvg
                    layout={layout}
                    visual={visual}
                    selectedNodeId={selectedNodeId}
                    highlightedSearchPathOnly={highlightedSearchPathOnly}
                    playbackSpeed={playbackSpeed}
                    cameraResetNonce={cameraResetNonce}
                    onSelectNode={selectNode}
                  />
                </div>
              </div>
            }
          >
            <Tree3DCanvas
              layout={layout}
              visual={visual}
              selectedNodeId={selectedNodeId}
              highlightedSearchPathOnly={highlightedSearchPathOnly}
              playbackSpeed={playbackSpeed}
              cameraResetNonce={cameraResetNonce}
              onSelectNode={selectNode}
            />
          </WebGlErrorBoundary>
        ) : (
          <Tree2DSvg
            layout={layout}
            visual={visual}
            selectedNodeId={selectedNodeId}
            highlightedSearchPathOnly={highlightedSearchPathOnly}
            playbackSpeed={playbackSpeed}
            cameraResetNonce={cameraResetNonce}
            onSelectNode={selectNode}
          />
        )}

        {/* Selected Node Inspector Drawer */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              className="rangex-metallic-card absolute bottom-3 right-3 z-10 w-64 rounded-xl p-3.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-cyanpulse-400">
                    Node Inspector
                  </div>
                  <div className="mt-0.5 font-mono text-base font-bold text-white">
                    [{selectedNode.intervalStart}, {selectedNode.intervalEnd}]
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => selectNode(null)}
                  className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="rounded-lg bg-charcoal-950/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">HEIGHT</div>
                  <div className="font-bold text-electric-400">{selectedNode.height}</div>
                </div>
                <div className="rounded-lg bg-charcoal-950/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">BALANCE FACTOR</div>
                  <div
                    className={`font-bold ${
                      Math.abs(selectedNode.balanceFactor) > 1 ? 'text-red-400' : 'text-cyanpulse-300'
                    }`}
                  >
                    {selectedNode.balanceFactor > 0
                      ? `+${selectedNode.balanceFactor}`
                      : selectedNode.balanceFactor}
                  </div>
                </div>
                <div className="rounded-lg bg-charcoal-950/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">PACKAGES</div>
                  <div className="font-bold text-slate-200">
                    {selectedNode.intervalEnd - selectedNode.intervalStart + 1}
                  </div>
                </div>
                <div className="rounded-lg bg-charcoal-950/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">NODE ID</div>
                  <div className="truncate font-semibold text-slate-300" title={selectedNode.id}>
                    {selectedNode.id}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 font-mono text-[11px] text-slate-400">
                <div>Left Child: {selectedNode.leftId ?? 'null'}</div>
                <div>Right Child: {selectedNode.rightId ?? 'null'}</div>
              </div>

              <button
                type="button"
                onClick={() => setFocusSubtreeRootId(selectedNode.id)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-electric-500/40 bg-electric-600/20 py-1.5 text-xs font-medium text-electric-400 transition hover:bg-electric-600/30 hover:text-white"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Focus Selected Subtree
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
