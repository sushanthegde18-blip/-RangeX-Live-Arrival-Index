# RANGEX — 3D Frontend (`feature/3d-frontend`)

Cinematic WebGL and React frontend for **RANGEX – Intelligent Warehouse Arrival Index**, built on React, Vite, TypeScript, Three.js, React Three Fiber, Drei, GSAP, Framer Motion, Lenis, and Tailwind CSS.

---

## 1. Installation

> Prerequisites: **Node.js >= 20** and **npm >= 10**.

```bash
cd frontend
npm install
cp .env.example .env
```

---

## 2. Development & Build Commands

```bash
# Start local Vite dev server (default http://localhost:5173)
npm run dev

# Type-check + production bundle build
npm run build

# Lint source files with oxlint
npm run lint

# Preview production build locally
npm run preview
```

### Environment Variables (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_RANGEX_BACKEND_TARGET` | `http://127.0.0.1:8080` | Proxy target for Member 2's C++ API during `npm run dev` |
| `VITE_RANGEX_API_BASE_URL` | `/api` | Base URL for REST calls (`rangexApi`) |
| `VITE_RANGEX_EVENTS_URL` | `/api/events` | SSE or WebSocket stream URL (`subscribeToBackendEvents`) |
| `VITE_RANGEX_EVENT_TRANSPORT` | `auto` | `auto` \| `sse` \| `ws` |

---

## 3. Component Architecture

```text
frontend/src/
├── contracts/
│   ├── api.ts                     # Canonical Member 2 C++ API request/response/event types
│   └── avl.ts                     # Shared Member 4 AvlVisualizerProps integration contract
├── services/
│   ├── apiConfig.ts               # Env-driven endpoint + transport configuration
│   ├── rangexApi.ts               # Centralized REST client (never fakes backend success)
│   └── rangexEvents.ts            # SSE / WebSocket event subscription with reconnect backoff
├── state/
│   └── RangeXProvider.tsx         # Global state, live backend sync, and opt-in fixture sandbox
├── fixtures/
│   └── visualFixtures.ts          # Static visual UI storyboard (strictly gated & labeled)
├── hooks/
│   └── useGraphicsCapabilities.ts # WebGL detection, prefers-reduced-motion, GPU tiering
└── components/
    ├── common/
    │   ├── MagneticCursor.tsx     # Studio reticle (auto-disabled on touch / reduced motion)
    │   ├── StudioHud.tsx          # Top navigation, backend status pill, quality/fixture switch
    │   └── WebGLErrorBoundary.tsx # Graceful recovery into 2D schematic fallbacks
    ├── hero/
    │   ├── HeroSection.tsx        # Section 1: GSAP choreography + Enter Warehouse CTA
    │   ├── HeroMonolithCanvas.tsx # Lazy-loaded Three.js monolith with Lightformers & particles
    │   └── HeroFallbackSchematic.tsx
    ├── warehouse/
    │   ├── WarehouseSection.tsx   # Section 2 & 3 container + camera presets + zoom toggle
    │   ├── WarehouseFloorCanvas.tsx # Conveyor, rotating rollers, scanner gate, racks & crates
    │   ├── WarehouseFallback2D.tsx
    │   └── LiveArrivalPanel.tsx   # Package ID registration form, errors & telemetry feed
    ├── intervals/
    │   └── IntervalExplorerSection.tsx # Section 4: Animated interval diffs & spatial ruler
    ├── avl/
    │   └── AvlVisualizerSlot.tsx  # Section 5: Reusable integration mount for Member 4
    ├── analytics/
    │   └── AnalyticsSection.tsx   # Section 6: Live API warehouse metrics & throughput bars
    └── closing/
        └── ClosingSection.tsx     # Section 7: Closing experience & branch attribution
```

### Adaptive Rendering & Accessibility
- **Lazy Loading**: `HeroMonolithCanvas` and `WarehouseFloorCanvas` are dynamically imported via `React.lazy` with `Suspense` and `WebGLErrorBoundary`.
- **Weak-Device / Mobile Fallback**: `useGraphicsCapabilities` scales DPR (`[1, 2]` vs `[1, 1.35]`), disables heavy floor reflections on balanced devices, and falls back to `HeroFallbackSchematic` and `WarehouseFallback2D` when WebGL is unavailable or `GPU: 2D Safe` is chosen.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` across Lenis smooth scrolling, GSAP entrances, Framer Motion layout transitions, 3D animations, and the custom cursor.

---

## 4. Backend Integration Requirements (Member 2 — `feature/backend-api`)

All network communication goes through `src/services/rangexApi.ts` and `src/services/rangexEvents.ts`. The frontend **never simulates successful backend responses** in Live mode: if the C++ server is unreachable or returns an error, the UI surfaces an explicit error state and suppresses conveyor arrival animations.

### Expected REST Endpoints

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/packages/arrive` | Register arrival `{ "packageId": number, "priority"?: "STANDARD" \| "EXPRESS" \| "COLD" }` |
| `GET` | `/api/intervals` | Fetch sorted disjoint intervals `{ "intervals": IntervalRange[] }` |
| `GET` | `/api/avl/snapshot` | Fetch current AVL tree snapshot `{ "rootId", "nodes", "height", "nodeCount" }` |
| `GET` | `/api/analytics` | Fetch aggregate metrics (`WarehouseAnalytics`) |
| `GET` | `/api/health` | Optional health probe `{ "status": "ok" }` |

### Expected `POST /api/packages/arrive` Payload

```json
{
  "packageId": 5,
  "mutationType": "MERGED",
  "targetInterval": { "id": "1-8", "start": 1, "end": 8, "zone": "BAY-A1", "packageCount": 8 },
  "previousIntervals": [
    { "id": "1-4", "start": 1, "end": 4 },
    { "id": "6-8", "start": 6, "end": 8 }
  ],
  "intervals": [
    { "id": "1-8", "start": 1, "end": 8, "zone": "BAY-A1", "packageCount": 8 }
  ],
  "mergedFrom": [
    { "id": "1-4", "start": 1, "end": 4 },
    { "id": "6-8", "start": 6, "end": 8 }
  ],
  "searchPath": ["1-4", "6-8"],
  "highlightedNodeIds": ["1-8"],
  "rotation": { "type": "NONE" },
  "timestamp": "2026-11-26T11:02:00.000Z"
}
```

- `mutationType`: `"CREATED" | "EXTENDED" | "MERGED" | "DUPLICATE"`
- `rotation.type`: `"NONE" | "LL" | "RR" | "LR" | "RL"` — **must be reported explicitly by the backend**; the frontend never assumes an interval merge implies a rotation.
- Optional real-time push events on `/api/events` (SSE or WebSocket JSON frames): `PACKAGE_ARRIVED`, `INTERVALS_UPDATED`, `AVL_SNAPSHOT_UPDATED`, `ANALYTICS_UPDATED`.

---

## 5. AVL Visualization Integration Requirements (Member 4 — `feature/avl-visualizer`)

Section 5 renders `AvlVisualizerSlot` (`src/components/avl/AvlVisualizerSlot.tsx`), which accepts a pluggable `VisualizerComponent`:

```tsx
import type { AvlVisualizerProps } from './contracts/avl'
import { Member4AvlVisualizer } from './components/avl/Member4AvlVisualizer'

<AvlVisualizerSlot VisualizerComponent={Member4AvlVisualizer} graphics={graphics} />
```

### Props Delivered to Member 4's Component (`AvlVisualizerProps`)

- `snapshot: AvlTreeSnapshot | null` — Node list (`id`, `interval`, `height`, `balanceFactor`, `leftId`, `rightId`, `parentId`, `depth`) + `rootId`, `height`, `nodeCount`.
- `lastMutation: AvlVisualizerMutationCue | null` — Latest backend event (`mutationType`, `packageId`, `targetInterval`, `searchPath`, `highlightedNodeIds`, `rotation`).
- `highlightedNodeIds: Array<string | number>` — Active node IDs to accentuate.
- `searchPath: Array<string | number>` — Ordered AVL traversal path reported by Member 1/2.
- `activeRotation: AvlRotationEvent | null` — Rotation type (`LL`, `RR`, `LR`, `RL`, or `NONE`), `pivotNodeId`, and `affectedNodeIds`.
- `isLoading: boolean` / `error: string | null` / `mode: 'live' | 'fixture'`
- `reducedMotion: boolean` — Must suppress continuous/motion-heavy transitions when `true`.
- `theme: AvlVisualizerThemeTokens` — Dark Cinematic palette (`#05070B`, `#0C1018`, `#2E7BFF`, `#38E8FF`, `#C8D3E3`).
- `onNodeSelect(nodeId, interval)` — Call when a user selects a node so the 3D warehouse rack & Interval Explorer highlight the matching range.
- `onAnimationComplete(eventId)` — Call when your tree rotation/search animation completes.

Until `VisualizerComponent` is supplied, `AvlVisualizerSlot` renders a read-only diagnostic contract inspector displaying live `AvlTreeSnapshot` telemetry without implementing any client-side AVL logic.
