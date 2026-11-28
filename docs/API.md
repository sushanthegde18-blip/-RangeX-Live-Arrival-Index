# RangeX REST & WebSocket API Reference

- `GET /api/health` — Engine status, uptime, package & interval counts
- `POST /api/packages` (alias `POST /api/packages/arrive`) — Register package ID (`0..1000000000`)
- `GET /api/intervals` — Sorted disjoint intervals
- `GET /api/gaps?start=1&end=100` — O(log K + M) missing range calculation
- `GET /api/stats` (alias `GET /api/analytics`) — Live KPIs & timing metrics
- `GET /api/tree` (alias `GET /api/avl/snapshot`) — Structural AVL tree snapshot
- `GET /api/events` — Recorded operation history for Time-Travel Replay
- `POST /api/simulate` — Multi-arrival batch simulation (`random`, `sequential`, `spaced`, `duplicate-heavy`)
- `POST /api/bulk-arrivals` — Isolated 1k/10k/50k benchmark or bulk arrival ingestion
- `POST /api/reset` — Reset persistent AVL index and history
- `WS /ws` — Real-time arrival/state broadcast channel
