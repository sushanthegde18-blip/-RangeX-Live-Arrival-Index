import type { AvlOperationTrace, AvlTreeSnapshot, PackageRegistrationResult } from '../contracts/api'
import type { AvlTimelineStage } from './AvlTree3DCanvas'

export function buildAvlOperationTimeline(
  currentSnapshot: AvlTreeSnapshot | null,
  lastArrival: PackageRegistrationResult | null,
  trace: AvlOperationTrace | null,
): AvlTimelineStage[] {
  if (!lastArrival || !trace) {
    if (!currentSnapshot) return []
    return [
      {
        kind: 'IDLE',
        title: 'Live Balanced Index',
        description: `Displaying ${currentSnapshot.nodeCount} interval node(s) at tree height ${currentSnapshot.height}.`,
        snapshot: currentSnapshot,
        activeNodeIds: [],
        searchVisitedIds: [],
      },
    ]
  }

  const stages: AvlTimelineStage[] = []
  const finalSnap = trace.finalSnapshot ?? currentSnapshot
  const beforeSnap =
    trace.beforeSnapshot && trace.beforeSnapshot.nodes.length > 0 ? trace.beforeSnapshot : null
  const searchSnap = beforeSnap ?? finalSnap
  const path = lastArrival.searchPath ?? []

  if (searchSnap && searchSnap.nodes.length > 0 && path.length > 0) {
    stages.push({
      kind: 'SEARCH_START',
      title: '1. Search Starting at Root',
      description: `Package #${lastArrival.packageId} enters root node #${path[0]} for O(log n) interval lookup.`,
      snapshot: searchSnap,
      activeNodeIds: [],
      searchCursorId: path[0],
      searchVisitedIds: [path[0]],
    })

    if (path.length > 1) {
      for (let i = 1; i < path.length; i++) {
        stages.push({
          kind: 'TRAVERSAL',
          title: `2. Tree Traversal (Hop ${i + 1}/${path.length})`,
          description: `Comparing #${lastArrival.packageId} against node #${path[i]} boundaries.`,
          snapshot: searchSnap,
          activeNodeIds: [],
          searchCursorId: path[i],
          searchVisitedIds: path.slice(0, i + 1),
        })
      }
    }
  }

  const preBalSnap = trace.preBalanceSnapshot ?? finalSnap
  if (preBalSnap) {
    const mutVerb =
      lastArrival.mutationType === 'CREATED'
        ? 'Created new interval node'
        : lastArrival.mutationType === 'EXTENDED'
          ? 'Extended interval boundary'
          : lastArrival.mutationType === 'MERGED'
            ? 'Merged adjacent intervals across bridge'
            : 'Duplicate ID detected — no mutation'

    stages.push({
      kind: 'MUTATE',
      title: `3. ${lastArrival.mutationType} [${lastArrival.targetInterval.start}, ${lastArrival.targetInterval.end}]`,
      description: mutVerb,
      snapshot: preBalSnap,
      activeNodeIds: lastArrival.highlightedNodeIds,
      searchVisitedIds: path,
    })

    stages.push({
      kind: 'HEIGHT_UPDATE',
      title: '4. Height Recalculation',
      description: `Recomputing bottom-up subtree heights across visited ancestors (max H=${preBalSnap.height}).`,
      snapshot: preBalSnap,
      activeNodeIds: lastArrival.highlightedNodeIds,
      searchVisitedIds: path,
    })

    stages.push({
      kind: 'BALANCE_CALC',
      title: '5. Balance Factor Check',
      description: 'Evaluating BF = height(left) - height(right) on ancestor chain.',
      snapshot: preBalSnap,
      activeNodeIds: lastArrival.highlightedNodeIds,
      searchVisitedIds: path,
    })
  }

  const rotSteps = trace.rotationSteps ?? []
  for (const step of rotSteps) {
    const imbalanceSnap = step.preRotationSnapshot ?? preBalSnap ?? finalSnap
    if (imbalanceSnap) {
      stages.push({
        kind: 'IMBALANCE_DETECTED',
        title: `6. Imbalance Detected (BF=${step.pivotBalanceFactor ?? '±2'})`,
        description: step.reason || `Node #${step.pivotNodeId} violated |BF| <= 1 — scheduling ${step.type} rotation.`,
        snapshot: imbalanceSnap,
        activeNodeIds: step.affectedNodeIds ?? [],
        searchVisitedIds: [],
        imbalancedNodeId: step.pivotNodeId ?? null,
        rotationLabel: step.type,
      })
    }

    if (step.intermediateSnapshot) {
      stages.push({
        kind: 'ROTATION_HALF',
        title: `7a. ${step.type} First Sub-Rotation`,
        description:
          step.type === 'LR'
            ? 'Rotating left child counter-clockwise to align Left-Left spine.'
            : 'Rotating right child clockwise to align Right-Right spine.',
        snapshot: step.intermediateSnapshot,
        activeNodeIds: step.affectedNodeIds ?? [],
        searchVisitedIds: [],
        rotationLabel: step.type,
      })
    }

    const afterRotSnap = step.afterSnapshot ?? finalSnap
    if (afterRotSnap) {
      stages.push({
        kind: 'ROTATION_COMPLETE',
        title: `7. ${step.type} Rotation Executed`,
        description: `Pivot #${step.pivotNodeId} rebalanced via ${step.type} rotation.`,
        snapshot: afterRotSnap,
        activeNodeIds: step.affectedNodeIds ?? [],
        searchVisitedIds: [],
        rotationLabel: step.type,
      })
    }
  }

  if (finalSnap) {
    stages.push({
      kind: 'FINAL_BALANCED',
      title: '8. Balanced AVL Tree Committed',
      description: `All nodes satisfy |BF| <= 1. Height=${finalSnap.height}, Nodes=${finalSnap.nodeCount}.`,
      snapshot: finalSnap,
      activeNodeIds: lastArrival.highlightedNodeIds,
      searchVisitedIds: [],
    })
  }

  return stages
}
