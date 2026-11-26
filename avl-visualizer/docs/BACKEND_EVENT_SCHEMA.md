# RangeX Backend Event & Snapshot Contract (Member 2 ↔ Visualizer)

The AVL Tree Visualizer module consumes **authoritative tree structures, events, and analytics** emitted by Member 1's C++ AVL Tree through Member 2's backend gateway. The frontend never simulates AVL logic or invents tree states.

## Endpoints

- **REST Initial Sync**: `GET /api/tree/snapshot`
  Returns `{ snapshot, intervals, analytics }`
- **REST Package Arrival**: `POST /api/packages`
  Request body: `{ "packageId": 25 }`
  Response: `{ "accepted": true }` or `{ "events": AvlBackendEvent[] }`
- **WebSocket Live Stream**: `ws://<host>/ws/avl`
  Streams single `AvlBackendEvent` JSON frames or `{ "events": AvlBackendEvent[] }` batches.
  Also accepts client command `{ "type": "INSERT_PACKAGE", "packageId": 25 }`.

## Accepted Snapshot Formats

Both flat and nested tree structures are accepted and strictly validated (`src/services/eventValidator.ts`):

1. **Flat Format**
```json
{
  "rootId": "n_1_3",
  "nodes": [
    {
      "id": "n_1_3",
      "intervalStart": 1,
      "intervalEnd": 3,
      "height": 2,
      "balanceFactor": -1,
      "leftId": null,
      "rightId": "n_5_8",
      "parentId": null
    }
  ]
}
```

2. **Nested Format**
```json
{
  "root": {
    "id": "n_1_3",
    "intervalStart": 1,
    "intervalEnd": 3,
    "height": 2,
    "balanceFactor": -1,
    "left": null,
    "right": { "id": "n_5_8", "intervalStart": 5, "intervalEnd": 8, "height": 1, "balanceFactor": 0 }
  }
}
```

## Supported Event Stages (`stage`)

- `SNAPSHOT_SYNC`
- `PACKAGE_ARRIVED`
- `SEARCH_START`
- `SEARCH_VISIT`
- `PREDECESSOR_FOUND`
- `SUCCESSOR_FOUND`
- `BRIDGE_DETECTED`
- `INTERVAL_MERGING`
- `INTERVAL_INSERTED`
- `INTERVAL_EXTENDED`
- `DUPLICATE_PACKAGE`
- `BALANCE_UPDATED`
- `ROTATION_DETECTED` *(requires `rotation: { type: 'LL'|'RR'|'LR'|'RL', unbalancedNodeId, unbalancedBalanceFactor, pivotNodeId, affectedNodeIds }`)*
- `ROTATION_APPLIED` *(requires `rotation` + updated `snapshot`)*
- `TREE_UPDATED`
- `INTERVAL_LIST_UPDATED`
- `INSERTION_COMPLETED`
