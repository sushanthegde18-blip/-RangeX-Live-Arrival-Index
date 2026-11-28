# RangeX – Intelligent Live Arrival Index

**RangeX** is an intelligent, real-time warehouse arrival indexing system powered by a custom **C++17 AVL Interval Tree**, a **Crow** C++17 REST & WebSocket backend, and a cinematic **React + Three.js (R3F)** 3D web interface.

---

## Core Architecture

- **Core Engine (`core/`)**: Genuine custom C++17 AVL Tree storing maximal disjoint closed intervals `[start, end]` with manual rotations (`LL`, `RR`, `LR`, `RL`), predecessor/successor lookup, bridge interval coalescing, $O(\log K + M)$ missing gap queries, and operation trace capture.
- **Backend (`backend/`)**: Thread-safe C++17 Crow HTTP REST & WebSocket server exposing `/api/packages`, `/api/intervals`, `/api/gaps`, `/api/stats`, `/api/tree`, `/api/events`, `/api/simulate`, `/api/bulk-arrivals`, `/api/reset`, `/api/health`, and `/ws`.
- **Frontend (`frontend/`)**: Cinematic React + Vite + Three.js + React Three Fiber + Drei + GSAP + Framer Motion + Tailwind CSS interface.

---

## Quick Start (Windows 11)

### 1. Build & Run C++ Unit Tests
```cmd
run-tests.bat
```

### 2. Start the C++ Backend (`http://127.0.0.1:8080`)
```cmd
start-backend.bat
```

### 3. Start the Frontend (`http://localhost:5173`)
In a second terminal:
```cmd
start-frontend.bat
```

---

## Documentation
- [Architecture Overview](docs/ARCHITECTURE.md)
- [REST & WebSocket API](docs/API.md)
- [AVL Operation & Animation Trace Events](docs/AVL_EVENTS.md)
- [Testing & Verification](docs/TESTING.md)
