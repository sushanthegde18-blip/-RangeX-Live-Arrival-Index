import { AvlNodeSnapshot, NormalizedTreeSnapshot } from '../types/avlBackend';

export interface PositionedNode {
  node: AvlNodeSnapshot;
  depth: number;
  x2d: number;
  y2d: number;
  x3d: number;
  y3d: number;
  z3d: number;
}

export interface PositionedEdge {
  id: string;
  parentId: string;
  childId: string;
  side: 'left' | 'right';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  start3d: [number, number, number];
  end3d: [number, number, number];
}

export interface TreeLayoutResult {
  nodes: PositionedNode[];
  nodesById: Record<string, PositionedNode>;
  edges: PositionedEdge[];
  bounds2d: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  maxDepth: number;
  totalVisibleNodes: number;
}

/**
 * Computes collision-free hierarchical visual coordinates strictly from the
 * backend's exact tree structure (rootId, leftId, rightId).
 * Does NOT alter, balance, or invent any tree relationships.
 */
export function computeTreeLayout(
  snapshot: NormalizedTreeSnapshot,
  focusSubtreeRootId: string | null = null,
): TreeLayoutResult {
  const effectiveRootId =
    focusSubtreeRootId && snapshot.nodesById[focusSubtreeRootId]
      ? focusSubtreeRootId
      : snapshot.rootId;

  if (!effectiveRootId || !snapshot.nodesById[effectiveRootId]) {
    return {
      nodes: [],
      nodesById: {},
      edges: [],
      bounds2d: { minX: -200, maxX: 200, minY: -120, maxY: 120, width: 400, height: 240 },
      maxDepth: 0,
      totalVisibleNodes: 0,
    };
  }

  // First pass: in-order traversal guarantees monotonically increasing X slots
  // so no two nodes at any depth can collide horizontally, even in large trees.
  const orderedIds: Array<{ id: string; depth: number }> = [];
  const visited = new Set<string>();
  let maxDepth = 0;

  const traverseInOrder = (id: string | null, depth: number) => {
    if (!id || visited.has(id)) return;
    const node = snapshot.nodesById[id];
    if (!node) return;
    visited.add(id);
    if (depth > maxDepth) maxDepth = depth;
    traverseInOrder(node.leftId, depth + 1);
    orderedIds.push({ id, depth });
    traverseInOrder(node.rightId, depth + 1);
  };

  traverseInOrder(effectiveRootId, 0);

  const count = orderedIds.length;
  // Adaptive horizontal spacing keeps large trees readable while maintaining crisp spacing for small trees.
  const hGap2d = count > 45 ? 116 : count > 20 ? 132 : 154;
  const vGap2d = count > 45 ? 112 : 124;

  const hGap3d = count > 45 ? 2.4 : count > 20 ? 2.8 : 3.2;
  const vGap3d = 2.6;

  const centerOffset = (count - 1) / 2;

  const nodes: PositionedNode[] = [];
  const nodesById: Record<string, PositionedNode> = {};

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  orderedIds.forEach(({ id, depth }, slotIndex) => {
    const node = snapshot.nodesById[id];
    const centeredSlot = slotIndex - centerOffset;

    const x2d = centeredSlot * hGap2d;
    const y2d = depth * vGap2d;

    const x3d = centeredSlot * hGap3d;
    const y3d = (maxDepth / 2 - depth) * vGap3d;
    // Slight arc along Z for depth separation in 3D view without obscuring labels
    const z3d = -Math.abs(centeredSlot) * 0.14 - depth * 0.18;

    minX = Math.min(minX, x2d - 75);
    maxX = Math.max(maxX, x2d + 75);
    minY = Math.min(minY, y2d - 48);
    maxY = Math.max(maxY, y2d + 48);

    const positioned: PositionedNode = {
      node,
      depth,
      x2d,
      y2d,
      x3d,
      y3d,
      z3d,
    };
    nodes.push(positioned);
    nodesById[id] = positioned;
  });

  const edges: PositionedEdge[] = [];
  for (const pNode of nodes) {
    const { node } = pNode;
    if (node.leftId && nodesById[node.leftId]) {
      const child = nodesById[node.leftId];
      edges.push({
        id: `${node.id}->${child.node.id}`,
        parentId: node.id,
        childId: child.node.id,
        side: 'left',
        x1: pNode.x2d,
        y1: pNode.y2d,
        x2: child.x2d,
        y2: child.y2d,
        start3d: [pNode.x3d, pNode.y3d, pNode.z3d],
        end3d: [child.x3d, child.y3d, child.z3d],
      });
    }
    if (node.rightId && nodesById[node.rightId]) {
      const child = nodesById[node.rightId];
      edges.push({
        id: `${node.id}->${child.node.id}`,
        parentId: node.id,
        childId: child.node.id,
        side: 'right',
        x1: pNode.x2d,
        y1: pNode.y2d,
        x2: child.x2d,
        y2: child.y2d,
        start3d: [pNode.x3d, pNode.y3d, pNode.z3d],
        end3d: [child.x3d, child.y3d, child.z3d],
      });
    }
  }

  return {
    nodes,
    nodesById,
    edges,
    bounds2d: {
      minX: Number.isFinite(minX) ? minX : -200,
      maxX: Number.isFinite(maxX) ? maxX : 200,
      minY: Number.isFinite(minY) ? minY : -120,
      maxY: Number.isFinite(maxY) ? maxY : 120,
      width: Number.isFinite(maxX - minX) ? Math.max(400, maxX - minX) : 400,
      height: Number.isFinite(maxY - minY) ? Math.max(240, maxY - minY) : 240,
    },
    maxDepth,
    totalVisibleNodes: nodes.length,
  };
}
