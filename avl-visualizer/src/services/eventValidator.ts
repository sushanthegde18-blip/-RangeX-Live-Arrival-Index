import {
  AvlBackendEvent,
  AvlEventStage,
  AvlNodeSnapshot,
  IntervalSummary,
  NormalizedTreeSnapshot,
  RawNestedAvlNode,
  RotationType,
  WarehouseAnalyticsSnapshot,
} from '../types/avlBackend';

const VALID_STAGES = new Set<AvlEventStage>([
  'SNAPSHOT_SYNC',
  'PACKAGE_ARRIVED',
  'SEARCH_START',
  'SEARCH_VISIT',
  'PREDECESSOR_FOUND',
  'SUCCESSOR_FOUND',
  'BRIDGE_DETECTED',
  'INTERVAL_MERGING',
  'INTERVAL_INSERTED',
  'INTERVAL_EXTENDED',
  'DUPLICATE_PACKAGE',
  'BALANCE_UPDATED',
  'ROTATION_DETECTED',
  'ROTATION_APPLIED',
  'TREE_UPDATED',
  'INTERVAL_LIST_UPDATED',
  'INSERTION_COMPLETED',
]);

const VALID_ROTATIONS = new Set<RotationType>(['LL', 'RR', 'LR', 'RL']);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function createEmptyTreeSnapshot(): NormalizedTreeSnapshot {
  return {
    rootId: null,
    nodesById: {},
    nodeOrder: [],
  };
}

export function createEmptyAnalytics(): WarehouseAnalyticsSnapshot {
  return {
    totalPackagesReceived: 0,
    totalIntervals: 0,
    largestInterval: null,
    smallestInterval: null,
    totalUniquePackages: 0,
    duplicateArrivals: 0,
    totalIntervalMerges: 0,
    totalAvlRotations: 0,
    currentTreeHeight: 0,
  };
}

function validateNodeFields(node: Record<string, unknown>): string | null {
  if (!isFiniteInt(node.intervalStart) || !isFiniteInt(node.intervalEnd)) {
    return 'Node intervalStart and intervalEnd must be finite integers';
  }
  if (node.intervalStart > node.intervalEnd) {
    return `Invalid interval [${node.intervalStart}, ${node.intervalEnd}]: start > end`;
  }
  if (!isFiniteInt(node.height) || node.height < 0) {
    return `Invalid node height ${String(node.height)}`;
  }
  if (!isFiniteInt(node.balanceFactor)) {
    return `Invalid node balanceFactor ${String(node.balanceFactor)}`;
  }
  return null;
}

/**
 * Validates and normalizes either a flat backend snapshot ({ rootId, nodes }) or
 * a nested tree snapshot ({ root: RawNestedAvlNode | null }).
 * Rejects cycles, dangling references, and malformed intervals.
 */
export function validateAndNormalizeSnapshot(raw: unknown): ValidationResult<NormalizedTreeSnapshot> {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Snapshot must be an object' };
  }

  // Case 1: Already normalized shape { rootId, nodesById }
  if ('nodesById' in raw && isRecord(raw.nodesById)) {
    const rootId = raw.rootId === null ? null : typeof raw.rootId === 'string' ? raw.rootId : undefined;
    if (rootId === undefined) {
      return { ok: false, error: 'Snapshot rootId must be string or null' };
    }
    const nodesById: Record<string, AvlNodeSnapshot> = {};
    const nodeOrder: string[] = [];
    for (const [key, val] of Object.entries(raw.nodesById)) {
      if (!isRecord(val)) return { ok: false, error: `Node ${key} is not an object` };
      const err = validateNodeFields(val);
      if (err) return { ok: false, error: err };
      const id = typeof val.id === 'string' ? val.id : key;
      nodesById[id] = {
        id,
        intervalStart: val.intervalStart as number,
        intervalEnd: val.intervalEnd as number,
        height: val.height as number,
        balanceFactor: val.balanceFactor as number,
        leftId: typeof val.leftId === 'string' ? val.leftId : null,
        rightId: typeof val.rightId === 'string' ? val.rightId : null,
        parentId: typeof val.parentId === 'string' ? val.parentId : null,
      };
      nodeOrder.push(id);
    }
    return verifyTreeAcyclic(rootId, nodesById, nodeOrder);
  }

  // Case 2: Flat array shape { rootId, nodes: [...] }
  if ('nodes' in raw && Array.isArray(raw.nodes)) {
    const rootId = raw.rootId === null ? null : typeof raw.rootId === 'string' ? raw.rootId : undefined;
    if (rootId === undefined) {
      return { ok: false, error: 'Flat snapshot rootId must be string or null' };
    }
    const nodesById: Record<string, AvlNodeSnapshot> = {};
    const nodeOrder: string[] = [];
    for (const item of raw.nodes) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id) {
        return { ok: false, error: 'Every flat node must include a non-empty string id' };
      }
      const err = validateNodeFields(item);
      if (err) return { ok: false, error: err };
      nodesById[item.id] = {
        id: item.id,
        intervalStart: item.intervalStart as number,
        intervalEnd: item.intervalEnd as number,
        height: item.height as number,
        balanceFactor: item.balanceFactor as number,
        leftId: typeof item.leftId === 'string' ? item.leftId : null,
        rightId: typeof item.rightId === 'string' ? item.rightId : null,
        parentId: typeof item.parentId === 'string' ? item.parentId : null,
      };
      nodeOrder.push(item.id);
    }
    return verifyTreeAcyclic(rootId, nodesById, nodeOrder);
  }

  // Case 3: Nested shape { root: RawNestedAvlNode | null }
  if ('root' in raw) {
    if (raw.root === null) {
      return { ok: true, value: createEmptyTreeSnapshot() };
    }
    if (!isRecord(raw.root)) {
      return { ok: false, error: 'Nested snapshot root must be an object or null' };
    }
    const nodesById: Record<string, AvlNodeSnapshot> = {};
    const nodeOrder: string[] = [];

    const visit = (nodeRaw: RawNestedAvlNode, parentId: string | null): ValidationResult<string> => {
      if (!isRecord(nodeRaw)) return { ok: false, error: 'Nested child must be an object' };
      const err = validateNodeFields(nodeRaw);
      if (err) return { ok: false, error: err };

      const id =
        typeof nodeRaw.id === 'string' && nodeRaw.id.length > 0
          ? nodeRaw.id
          : `node_${nodeRaw.intervalStart}_${nodeRaw.intervalEnd}`;

      if (nodesById[id]) {
        return { ok: false, error: `Duplicate node id ${id} in nested snapshot` };
      }

      const placeholder: AvlNodeSnapshot = {
        id,
        intervalStart: nodeRaw.intervalStart,
        intervalEnd: nodeRaw.intervalEnd,
        height: nodeRaw.height,
        balanceFactor: nodeRaw.balanceFactor,
        leftId: null,
        rightId: null,
        parentId,
      };
      nodesById[id] = placeholder;
      nodeOrder.push(id);

      if (nodeRaw.left !== undefined && nodeRaw.left !== null) {
        const leftRes = visit(nodeRaw.left, id);
        if (!leftRes.ok) return leftRes;
        placeholder.leftId = leftRes.value;
      }
      if (nodeRaw.right !== undefined && nodeRaw.right !== null) {
        const rightRes = visit(nodeRaw.right, id);
        if (!rightRes.ok) return rightRes;
        placeholder.rightId = rightRes.value;
      }
      return { ok: true, value: id };
    };

    const rootRes = visit(raw.root as unknown as RawNestedAvlNode, null);
    if (!rootRes.ok) return rootRes;
    return {
      ok: true,
      value: {
        rootId: rootRes.value,
        nodesById,
        nodeOrder,
      },
    };
  }

  return { ok: false, error: 'Unrecognized snapshot format (expected root, nodes, or nodesById)' };
}

function verifyTreeAcyclic(
  rootId: string | null,
  nodesById: Record<string, AvlNodeSnapshot>,
  nodeOrder: string[],
): ValidationResult<NormalizedTreeSnapshot> {
  if (rootId === null) {
    if (nodeOrder.length > 0) {
      return { ok: false, error: 'Snapshot has null rootId but non-empty nodes' };
    }
    return { ok: true, value: createEmptyTreeSnapshot() };
  }
  if (!nodesById[rootId]) {
    return { ok: false, error: `Snapshot rootId "${rootId}" not found in nodes` };
  }

  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) {
      return { ok: false, error: `Cycle detected at node "${id}"` };
    }
    visited.add(id);
    const node = nodesById[id];
    if (node.leftId !== null) {
      if (!nodesById[node.leftId]) {
        return { ok: false, error: `Dangling leftId "${node.leftId}" on node "${id}"` };
      }
      nodesById[node.leftId].parentId = id;
      stack.push(node.leftId);
    }
    if (node.rightId !== null) {
      if (!nodesById[node.rightId]) {
        return { ok: false, error: `Dangling rightId "${node.rightId}" on node "${id}"` };
      }
      nodesById[node.rightId].parentId = id;
      stack.push(node.rightId);
    }
  }

  return {
    ok: true,
    value: {
      rootId,
      nodesById,
      nodeOrder,
    },
  };
}

export function validateIntervals(raw: unknown): ValidationResult<IntervalSummary[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Intervals must be an array' };
  }
  const result: IntervalSummary[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return { ok: false, error: 'Interval entry must be an object' };
    if (!isFiniteInt(item.start) || !isFiniteInt(item.end) || item.start > item.end) {
      return { ok: false, error: 'Invalid interval bounds in interval list' };
    }
    const count = isFiniteInt(item.count) && item.count >= 0 ? item.count : item.end - item.start + 1;
    result.push({ start: item.start, end: item.end, count });
  }
  return { ok: true, value: result };
}

export function validateAnalytics(raw: unknown): ValidationResult<WarehouseAnalyticsSnapshot> {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Analytics payload must be an object' };
  }
  const numericFields = [
    'totalPackagesReceived',
    'totalIntervals',
    'totalUniquePackages',
    'duplicateArrivals',
    'totalIntervalMerges',
    'totalAvlRotations',
    'currentTreeHeight',
  ] as const;

  for (const field of numericFields) {
    if (!isFiniteNum(raw[field]) || (raw[field] as number) < 0) {
      return { ok: false, error: `Analytics field "${field}" must be a non-negative finite number` };
    }
  }

  const parseExtremum = (val: unknown, name: string) => {
    if (val === null || val === undefined) return { ok: true as const, value: null };
    if (!isRecord(val) || !isFiniteInt(val.start) || !isFiniteInt(val.end) || !isFiniteInt(val.size)) {
      return { ok: false as const, error: `Analytics ${name} is malformed` };
    }
    return {
      ok: true as const,
      value: { start: val.start, end: val.end, size: val.size },
    };
  };

  const largest = parseExtremum(raw.largestInterval, 'largestInterval');
  if (!largest.ok) return largest;
  const smallest = parseExtremum(raw.smallestInterval, 'smallestInterval');
  if (!smallest.ok) return smallest;

  return {
    ok: true,
    value: {
      totalPackagesReceived: raw.totalPackagesReceived as number,
      totalIntervals: raw.totalIntervals as number,
      largestInterval: largest.value,
      smallestInterval: smallest.value,
      totalUniquePackages: raw.totalUniquePackages as number,
      duplicateArrivals: raw.duplicateArrivals as number,
      totalIntervalMerges: raw.totalIntervalMerges as number,
      totalAvlRotations: raw.totalAvlRotations as number,
      currentTreeHeight: raw.currentTreeHeight as number,
    },
  };
}

export function validateBackendEvent(raw: unknown): ValidationResult<AvlBackendEvent> {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Backend event must be a JSON object' };
  }
  if (typeof raw.eventId !== 'string' || raw.eventId.trim() === '') {
    return { ok: false, error: 'Event missing non-empty eventId' };
  }
  if (!isFiniteInt(raw.sequence) || raw.sequence < 0) {
    return { ok: false, error: 'Event sequence must be a non-negative integer' };
  }
  if (typeof raw.stage !== 'string' || !VALID_STAGES.has(raw.stage as AvlEventStage)) {
    return { ok: false, error: `Unknown or unsupported event stage "${String(raw.stage)}"` };
  }
  if (typeof raw.message !== 'string' || raw.message.trim() === '') {
    return { ok: false, error: 'Event missing descriptive message' };
  }
  if (raw.packageId !== undefined && !isFiniteInt(raw.packageId)) {
    return { ok: false, error: 'Event packageId must be an integer when provided' };
  }

  let normalizedSnapshot: NormalizedTreeSnapshot | undefined;
  if (raw.snapshot !== undefined) {
    const snapRes = validateAndNormalizeSnapshot(raw.snapshot);
    if (!snapRes.ok) return { ok: false, error: `Event snapshot invalid: ${snapRes.error}` };
    normalizedSnapshot = snapRes.value;
  }

  let normalizedIntervals: IntervalSummary[] | undefined;
  if (raw.intervals !== undefined) {
    const intRes = validateIntervals(raw.intervals);
    if (!intRes.ok) return { ok: false, error: `Event intervals invalid: ${intRes.error}` };
    normalizedIntervals = intRes.value;
  }

  let normalizedAnalytics: WarehouseAnalyticsSnapshot | undefined;
  if (raw.analytics !== undefined) {
    const anaRes = validateAnalytics(raw.analytics);
    if (!anaRes.ok) return { ok: false, error: `Event analytics invalid: ${anaRes.error}` };
    normalizedAnalytics = anaRes.value;
  }

  if (raw.stage === 'ROTATION_DETECTED' || raw.stage === 'ROTATION_APPLIED') {
    if (!isRecord(raw.rotation)) {
      return { ok: false, error: `${raw.stage} event must include a rotation payload` };
    }
    if (!VALID_ROTATIONS.has(raw.rotation.type as RotationType)) {
      return { ok: false, error: `Invalid rotation type "${String(raw.rotation.type)}"` };
    }
    if (
      typeof raw.rotation.unbalancedNodeId !== 'string' ||
      typeof raw.rotation.pivotNodeId !== 'string' ||
      !isFiniteInt(raw.rotation.unbalancedBalanceFactor)
    ) {
      return { ok: false, error: 'Rotation payload missing unbalancedNodeId, pivotNodeId, or balance factor' };
    }
  }

  if ((raw.stage === 'BRIDGE_DETECTED' || raw.stage === 'INTERVAL_MERGING') && raw.mergeInfo !== undefined) {
    if (
      !isRecord(raw.mergeInfo) ||
      !Array.isArray(raw.mergeInfo.leftInterval) ||
      !Array.isArray(raw.mergeInfo.rightInterval) ||
      !Array.isArray(raw.mergeInfo.mergedInterval) ||
      !isFiniteInt(raw.mergeInfo.bridgePackage)
    ) {
      return { ok: false, error: 'Malformed mergeInfo payload' };
    }
  }

  const event: AvlBackendEvent = {
    eventId: raw.eventId,
    sequence: raw.sequence,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    operationId: typeof raw.operationId === 'string' ? raw.operationId : `op-${raw.sequence}`,
    packageId: raw.packageId as number | undefined,
    stage: raw.stage as AvlEventStage,
    stepNumber: isFiniteInt(raw.stepNumber) ? raw.stepNumber : undefined,
    message: raw.message,
    comparison: typeof raw.comparison === 'string' ? raw.comparison : undefined,
    actionText: typeof raw.actionText === 'string' ? raw.actionText : undefined,
    intervalResult: typeof raw.intervalResult === 'string' ? raw.intervalResult : undefined,
    treeStatus: typeof raw.treeStatus === 'string' ? raw.treeStatus : undefined,
    highlight: isRecord(raw.highlight) ? (raw.highlight as AvlBackendEvent['highlight']) : undefined,
    rotation: isRecord(raw.rotation) ? (raw.rotation as unknown as AvlBackendEvent['rotation']) : undefined,
    mergeInfo: isRecord(raw.mergeInfo) ? (raw.mergeInfo as unknown as AvlBackendEvent['mergeInfo']) : undefined,
    snapshot: normalizedSnapshot,
    intervals: normalizedIntervals,
    analytics: normalizedAnalytics,
  };

  return { ok: true, value: event };
}
