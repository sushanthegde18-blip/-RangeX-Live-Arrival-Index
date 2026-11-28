# RangeX AVL Operation & Animation Trace Events

Every interactive arrival returns a backend `trace` payload capturing:
1. `searchPath` — Root-to-target BST node traversal order
2. `preBalanceSnapshot` — Tree state right after leaf insertion/merge before rebalancing
3. `rotationSteps` — List of rotations (`LL`, `RR`, `LR`, `RL`) with `pivotNodeId`, `pivotBalanceFactor`, `affectedNodeIds`, `intermediateSnapshot` (for double rotations), and `afterSnapshot`
4. `finalSnapshot` — Final balanced AVL tree snapshot
