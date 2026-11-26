import type {
  AvlRotationEvent,
  AvlTreeSnapshot,
  BackendRuntimeMode,
  IntervalMutationType,
  IntervalRange,
} from './api'

/**
 * Reusable component contract shared between Member 3 (3D Frontend)
 * and Member 4 (`feature/avl-visualizer`).
 *
 * Member 4 owns the tree rendering, layout geometry, and node/edge animations.
 * Member 3 hosts the responsive container, passes live backend state & events,
 * and triggers rotation/search highlight cues only when reported by the backend.
 */
export interface AvlVisualizerMutationCue {
  eventId: string
  packageId: number
  mutationType: IntervalMutationType
  targetInterval: IntervalRange
  /** Ordered sequence of node IDs visited by Member 1's AVL lookup/insert. */
  searchPath: Array<string | number>
  /** Node IDs created, extended, or merged during this backend operation. */
  highlightedNodeIds: Array<string | number>
  /** Rotation reported explicitly by backend; null or NONE means no rotation occurred. */
  rotation: AvlRotationEvent | null
  timestamp: string
}

export interface AvlVisualizerThemeTokens {
  background: string
  surface: string
  nodeFill: string
  nodeBorder: string
  edgeStroke: string
  accentBlue: string
  accentCyan: string
  silverText: string
  warningAmber: string
}

export interface AvlVisualizerProps {
  /** Current AVL tree snapshot returned by Member 2's C++ backend. */
  snapshot: AvlTreeSnapshot | null
  /** Latest confirmed backend mutation & rotation cue (null when idle). */
  lastMutation: AvlVisualizerMutationCue | null
  /** Currently highlighted node IDs (e.g., from Interval Explorer hover or search). */
  highlightedNodeIds: Array<string | number>
  /** Ordered search path node IDs to animate traversal along edges. */
  searchPath: Array<string | number>
  /** Active rotation reported by backend (never inferred from merges). */
  activeRotation: AvlRotationEvent | null
  /** Backend connection / loading state so Member 4 can render matching status. */
  isLoading: boolean
  error: string | null
  /** Runtime source indicator: live backend vs opt-in fixture preview. */
  mode: BackendRuntimeMode
  /** Accessibility flag: disable continuous animations when true. */
  reducedMotion: boolean
  /** Dark Cinematic studio theme palette for visual consistency. */
  theme: AvlVisualizerThemeTokens
  /** Optional callback when a user clicks an AVL node to inspect/highlight its rack bay. */
  onNodeSelect?: (nodeId: string | number, interval: IntervalRange) => void
  /** Optional callback when Member 4 finishes playing a rotation/search animation. */
  onAnimationComplete?: (eventId: string) => void
}

export const RANGEX_AVL_THEME_TOKENS: AvlVisualizerThemeTokens = {
  background: '#05070B',
  surface: '#0C1018',
  nodeFill: '#111827',
  nodeBorder: 'rgba(196, 208, 224, 0.24)',
  edgeStroke: 'rgba(148, 163, 184, 0.35)',
  accentBlue: '#2E7BFF',
  accentCyan: '#38E8FF',
  silverText: '#C8D3E3',
  warningAmber: '#F59E0B',
}
