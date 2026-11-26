export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type AvlEventStage =
  | 'SNAPSHOT_SYNC'
  | 'PACKAGE_ARRIVED'
  | 'SEARCH_START'
  | 'SEARCH_VISIT'
  | 'PREDECESSOR_FOUND'
  | 'SUCCESSOR_FOUND'
  | 'BRIDGE_DETECTED'
  | 'INTERVAL_MERGING'
  | 'INTERVAL_INSERTED'
  | 'INTERVAL_EXTENDED'
  | 'DUPLICATE_PACKAGE'
  | 'BALANCE_UPDATED'
  | 'ROTATION_DETECTED'
  | 'ROTATION_APPLIED'
  | 'TREE_UPDATED'
  | 'INTERVAL_LIST_UPDATED'
  | 'INSERTION_COMPLETED';

export type RotationType = 'LL' | 'RR' | 'LR' | 'RL';

/**
 * Flat node format returned or normalized from Member 2's backend.
 * All AVL values (interval, height, balanceFactor, children) come exclusively from the C++ AVL Tree via backend.
 */
export interface AvlNodeSnapshot {
  id: string;
  intervalStart: number;
  intervalEnd: number;
  height: number;
  balanceFactor: number;
  leftId: string | null;
  rightId: string | null;
  parentId: string | null;
}

/**
 * Optional nested tree shape that Member 2's backend may send;
 * normalized into NormalizedTreeSnapshot by eventValidator.
 */
export interface RawNestedAvlNode {
  id?: string;
  intervalStart: number;
  intervalEnd: number;
  height: number;
  balanceFactor: number;
  left?: RawNestedAvlNode | null;
  right?: RawNestedAvlNode | null;
}

export interface NormalizedTreeSnapshot {
  rootId: string | null;
  nodesById: Record<string, AvlNodeSnapshot>;
  nodeOrder: string[];
}

export interface IntervalSummary {
  start: number;
  end: number;
  count: number;
}

export interface IntervalExtremum {
  start: number;
  end: number;
  size: number;
}

export interface WarehouseAnalyticsSnapshot {
  totalPackagesReceived: number;
  totalIntervals: number;
  largestInterval: IntervalExtremum | null;
  smallestInterval: IntervalExtremum | null;
  totalUniquePackages: number;
  duplicateArrivals: number;
  totalIntervalMerges: number;
  totalAvlRotations: number;
  currentTreeHeight: number;
}

export interface RotationPayload {
  type: RotationType;
  unbalancedNodeId: string;
  unbalancedBalanceFactor: number;
  pivotNodeId: string;
  affectedNodeIds: string[];
}

export interface MergePayload {
  leftInterval: [number, number];
  rightInterval: [number, number];
  bridgePackage: number;
  mergedInterval: [number, number];
}

export interface HighlightDirective {
  rootId?: string | null;
  activeNodeId?: string | null;
  visitedIds?: string[];
  predecessorId?: string | null;
  successorId?: string | null;
  unbalancedNodeId?: string | null;
  pivotNodeId?: string | null;
  mergedNodeId?: string | null;
  affectedEdgePairs?: Array<[string, string]>;
}

export interface AvlBackendEvent {
  eventId: string;
  sequence: number;
  timestamp: string;
  operationId: string;
  packageId?: number;
  stage: AvlEventStage;
  stepNumber?: number;
  message: string;
  comparison?: string;
  actionText?: string;
  intervalResult?: string;
  treeStatus?: string;
  highlight?: HighlightDirective;
  rotation?: RotationPayload;
  mergeInfo?: MergePayload;
  snapshot?: NormalizedTreeSnapshot;
  intervals?: IntervalSummary[];
  analytics?: WarehouseAnalyticsSnapshot;
}

export interface VisualStepState {
  stage: AvlEventStage;
  stepNumber: number;
  activeNodeId: string | null;
  visitedNodeIds: string[];
  predecessorId: string | null;
  successorId: string | null;
  unbalancedNodeId: string | null;
  pivotNodeId: string | null;
  mergedNodeId: string | null;
  activeRotation: RotationPayload | null;
  activeMerge: MergePayload | null;
  affectedEdgePairs: Array<[string, string]>;
  packageId: number | null;
  comparison: string | null;
  actionText: string | null;
  intervalResult: string | null;
  treeStatus: string;
}

/**
 * Immutable event-sourced frame stored for forward/backward playback
 * without ever re-running or simulating the AVL algorithm on the client.
 */
export interface PlaybackFrame {
  index: number;
  event: AvlBackendEvent;
  snapshot: NormalizedTreeSnapshot;
  intervals: IntervalSummary[];
  analytics: WarehouseAnalyticsSnapshot;
  visual: VisualStepState;
}

export interface BackendTraceFixture {
  id: string;
  name: string;
  description: string;
  source: string;
  events: unknown[];
}

export interface InvalidEventRecord {
  id: string;
  receivedAt: string;
  reason: string;
  rawPayloadPreview: string;
}
