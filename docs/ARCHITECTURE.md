# RangeX – Intelligent Live Arrival Index

## 1. System Overview

RangeX is a real-time warehouse arrival indexing system backed by a custom C++17 **AVL Interval Tree** engine, a **Crow** C++17 REST/WebSocket backend, and a cinematic **React + Three.js (R3F)** 3D visualization frontend.

## 2. Core Architecture Layers

```
+-------------------------------------------------------------------+
|                        Frontend (React + R3F)                     |
|  Landing 3D Warehouse · Dashboard · 3D AVL Visualizer · Explorer  |
|  Performance Lab · Time-Travel Replay                             |
+---------------------------------+---------------------------------+
                                  | HTTP REST + WebSocket (/api/*, /ws)
+---------------------------------v---------------------------------+
|                      Backend (C++17 + Crow)                       |
|  JSON Validation · Persistent Engine State · Event History        |
|  WebSocket Live Broadcast · Isolated Benchmark Runner             |
+---------------------------------+---------------------------------+
                                  | Direct C++ Linkage
+---------------------------------v---------------------------------+
|                   Core Engine (C++17 AVL Tree)                    |
|  Custom AvlNode · Rotations (LL/RR/LR/RL) · Interval Coalescing   |
|  O(log n) Search/Insert · Gap Finder · Operation Trace Snapshots  |
+-------------------------------------------------------------------+
```

## 3. Data Structure Invariants

1. **Disjointness & Non-Adjacency**: For any two distinct nodes $A$ and $B$ in the AVL tree with $A$ preceding $B$ in inorder traversal: $A.\text{end} + 1 < B.\text{start}$.
2. **AVL Height Balance**: For every node $u$, $\text{BF}(u) = \text{height}(u.\text{left}) - \text{height}(u.\text{right}) \in \{-1, 0, +1\}$ maintained via explicit `LL`, `RR`, `LR`, and `RL` rotations.
3. **Space Efficiency**: Memory usage is $O(K)$ where $K \le N$ is the number of disjoint intervals, independent of the maximum package ID ($10^9$).
