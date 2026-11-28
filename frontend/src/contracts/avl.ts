import type {
  AvlOperationTrace,
  AvlRotationEvent,
  AvlTreeSnapshot,
  BackendRuntimeMode,
  IntervalMutationType,
  IntervalRange,
} from './api'

export interface AvlVisualizerMutationCue {
  eventId: string
  packageId: number
  mutationType: IntervalMutationType
  targetInterval: IntervalRange
  searchPath: Array<string | number>
  highlightedNodeIds: Array<string | number>
  rotation: AvlRotationEvent | null
  trace?: AvlOperationTrace | null
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
  snapshot: AvlTreeSnapshot | null
  lastMutation: AvlVisualizerMutationCue | null
  highlightedNodeIds: Array<string | number>
  searchPath: Array<string | number>
  activeRotation: AvlRotationEvent | null
  trace?: AvlOperationTrace | null
  isLoading: boolean
  error: string | null
  mode: BackendRuntimeMode
  reducedMotion: boolean
  theme: AvlVisualizerThemeTokens
  onNodeSelect?: (nodeId: string | number, interval: IntervalRange) => void
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
