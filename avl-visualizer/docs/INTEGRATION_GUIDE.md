# RangeX AVL Visualizer — Member 3 Integration Guide

Branch: `feature/avl-visualizer`

## Exported Architecture

- **Store**: `src/store/useAvlStore.ts` (`useAvlStore`) — Event-sourced timeline store holding immutable `PlaybackFrame` snapshots for Play, Pause, Next, Previous, Restart, and Speed Control.
- **Backend Client**: `src/services/backendClient.ts` (`RangeXBackendClient`) — WebSocket + REST client with exponential-backoff reconnection and strict payload validation.
- **Validator**: `src/services/eventValidator.ts` — Validates snapshots, intervals, analytics, and events; rejects cycles, dangling pointers, and malformed intervals.
- **Components**:
  - `src/components/visualizer/TreeStageViewport.tsx` (3D R3F + GSAP canvas with automatic 2D SVG fallback)
  - `src/components/events/LiveEventPanel.tsx` (Live operation breakdown + chronological history)
  - `src/components/playback/PlaybackControls.tsx` (Timeline scrubber & speed controls)
  - `src/components/explorer/IntervalExplorer.tsx` (Sorted intervals, missing ranges, merge animations)
  - `src/components/analytics/WarehouseAnalytics.tsx` (Radial AVL envelope gauge, ingestion spectrum, span comparator)
  - `src/components/learn/AvlLearningMode.tsx` (DSA evaluation guide)

## Environment Variables

Configure `.env.local` based on `.env.example`:
- `VITE_RANGEX_API_URL` (default `http://localhost:8080`)
- `VITE_RANGEX_WS_URL` (default `ws://localhost:8080/ws/avl`)
