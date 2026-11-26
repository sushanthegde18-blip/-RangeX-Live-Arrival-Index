# RANGEX – Integration & Build Guide

This document outlines team integration protocols and build instructions for the **RANGEX Intelligent Warehouse Arrival Index Backend**.

---

## 1. Team Coordination & Interfaces

### 1.1 Coordination with Member 1 (AVL Tree Engine Developer)
- **Zero Logic Duplication**: The backend directly consumes Member 1's `rangex::AVLTree` and `rangex::Interval` classes from `backend/include/AVLTree.h` and `backend/include/Interval.h`.
- **Event Pipeline Hook**: The backend does NOT simulate algorithm events. In `WarehouseManager`, Member 1's `tree.getLogger().setCallback(...)` is bound at initialization:
  ```cpp
  tree.getLogger().setCallback([this](const AlgorithmEvent& ev) {
      this->handleTreeAlgorithmEvent(ev);
  });
  ```
  Whenever `tree.processPackageArrival(packageId)` executes, real node visits, interval searches, extensions, bridge merges, and rotations trigger the callback in real time.
- **Node-Level Introspection**: The backend uses Member 1's `tree.getRoot()`, `tree.getHeight(...)`, `tree.getBalanceFactor(...)`, `tree.getAllIntervals()`, and `tree.getMissingIntervals(low, high)`.

---

### 1.2 Coordination with Member 3 (Frontend React Developer)
The backend provides CORS-enabled endpoints (`Access-Control-Allow-Origin: *`) compatible with React Vite (`localhost:5173`) and Create React App (`localhost:3000`).

#### Recommended React WebSocket Hook (`useRangeXEvents.js`)
```javascript
import { useState, useEffect, useRef } from 'react';

export function useRangeXEvents(onEventReceived) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws/events');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[RangeX WS] Connected');
      setConnected(true);
    };

    ws.onmessage = (msgEvent) => {
      try {
        const event = JSON.parse(msgEvent.data);
        if (onEventReceived) onEventReceived(event);
      } catch (err) {
        console.error('[RangeX WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[RangeX WS] Closed. Reconnecting in 2s...');
      setConnected(false);
      setTimeout(() => wsRef.current = new WebSocket('ws://localhost:8080/ws/events'), 2000);
    };

    return () => ws.close();
  }, []);

  const requestSnapshot = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('snapshot');
    }
  };

  return { connected, requestSnapshot };
}
```

#### Calling Package Arrival from React
```javascript
export async function sendPackageArrival(packageId) {
  const res = await fetch('http://localhost:8080/api/packages/arrival', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId: Number(packageId) }),
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || 'Arrival processing failed');
  }
  return await res.json();
}
```

---

### 1.3 Coordination with Member 4 (Visualization & Algorithm Animator)
Member 4's visualizer receives events either step-by-step via WebSocket during insertion, or in a batch array returned inside the `POST /api/packages/arrival` response.

#### Visualizer Event Contract
Each event includes:
- `operationId`: Correlates all events belonging to the single package arrival.
- `sequenceNumber`: 1-based ordering guarantee ($1, 2, 3, \dots, N$).
- `eventType`: Visual state trigger (`NODE_VISITED`, `INTERVAL_MERGED`, `LEFT_ROTATION`, etc.).
- `nodeInfo`: Exact intervals involved:
  - `nodeStart`, `nodeEnd`: Node currently highlighted/operated on.
  - `pivotStart`, `childStart`: Pivot points during LL/RR rotations.
- `treeSnapshot`: Present on structural changes (`TREE_UPDATED`, `INSERTION_COMPLETED`, rotations) containing the complete tree hierarchy ready for D3 / SVG rendering.

---

## 2. Thread Safety Architecture

The warehouse API is designed for concurrent multi-client usage:
- Shared mutable data (`AVLTree` and statistics) is guarded by `std::shared_mutex rwMutex` in `WarehouseManager`.
- **Write Operations** (`POST /api/packages/arrival`, `POST /api/reset`):
  Acquire an exclusive `std::unique_lock<std::shared_mutex>`, guaranteeing no simultaneous tree mutation or iterator invalidation.
- **Read Operations** (`GET /api/tree`, `GET /api/intervals`, `GET /api/missing`, `GET /api/packages/search`, `GET /api/statistics`):
  Acquire a concurrent `std::shared_lock<std::shared_mutex>`, allowing unlimited simultaneous reader threads.
- **WebSocket Broadcasts**:
  Guarded by `std::mutex wsMutex` inside `EventManager` ensuring thread-safe client registration and message delivery across worker threads.

---

## 3. Build & Run Instructions

### Prerequisites
- C++17 compliant compiler (`g++ 9+`, `clang++ 10+`, or MSVC 2019+)
- CMake 3.15+

### 3.1 Building with CMake

#### Linux / macOS:
```bash
# Generate build files
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release

# Build all targets (server, core, tests)
cmake --build build -j$(nproc)

# Run Backend Verification Tests
./build/rangex_test_backend

# Run AVL Core Tests
./build/rangex_test_avl

# Start Server
./build/rangex_server --port 8080
```

#### Windows (PowerShell / Visual Studio / MinGW):
```powershell
# Generate build directory
cmake -B build -S .

# Build Release binary
cmake --build build --config Release

# Run backend tests
.\build\Release\rangex_test_backend.exe

# Start Server
.\build\Release\rangex_server.exe --port 8080
```

---

## 4. Running Demonstrations & CLI Mode

To verify algorithm operations without running a web browser:

```bash
# Run the warehouse arrival scenario (packages 1, 2, 3, 6, 7, 8 -> 4 -> 5 bridge merge)
./build/rangex_server --demo
```
