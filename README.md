# RANGEX – Intelligent Warehouse Arrival Index

**RANGEX** is an educational, production-grade Data Structures and Algorithms (DSA) project implementing a high-performance **Custom AVL Tree** in **C++17** connected to a modern web API using the **Crow framework** and **WebSockets** for dynamic warehouse package arrival indexing.

Instead of storing individual package IDs, RANGEX dynamically clusters consecutive packages into sorted, non-overlapping intervals `[start, end]`, automatically handling out-of-order arrivals, extensions, duplicates, and **bridge merges**.

---

## Architecture & Responsibilities

- **Member 1 (AVL Tree Core Engine)**: Custom self-balancing AVL Tree keyed on `intervalStart`, balancing rotations (LL, RR, LR, RL), bridge merge logic, and discrete event emission.
- **Member 2 (Backend & API Architecture)**: Thread-safe backend service (`WarehouseManager`, `EventManager`, `API`) powered by Crow, RESTful JSON API, WebSocket real-time event streaming, and error handling.
- **Member 3 (React Frontend)**: User interface, interval dashboard, package search, and arrival trigger controls.
- **Member 4 (Tree Visualizer & Animation)**: Dynamic D3 / SVG tree rendering driven by real-time algorithm events.

---

## Backend Architecture

```
backend/
    include/
        API.h                  # Crow REST routes, WebSocket handler, and CORS middleware
        EventManager.h         # Thread-safe event bus, WebSocket client manager & sequence enricher
        WarehouseManager.h     # Reader-Writer mutex synchronization, statistics & AVL bridge
        AVLTree.h              # Member 1's AVL node, balancing rotations & core algorithm
        Interval.h             # Closed interval [start, end] data structure
        Event.h                # Discrete algorithm event definitions & logger
    src/
        API.cpp                # REST endpoints (/arrival, /tree, /intervals, /missing, /statistics, /reset)
        EventManager.cpp       # Real-time WebSocket broadcasting and JSON formatting
        WarehouseManager.cpp   # Synchronization wrapper and AVL algorithm event hook
        AVLTree.cpp            # Core AVL tree insertion, deletion, balancing & search
        main.cpp               # Server entry point with CLI flags (--port, --demo)
    tests/
        test_avl.cpp           # Member 1's 10-suite AVL algorithm verification
        test_backend.cpp       # Backend API, thread safety concurrency, and statistics test suite
    CMakeLists.txt
CMakeLists.txt
API_DOCUMENTATION.md           # Comprehensive REST & WebSocket API specification
INTEGRATION_GUIDE.md           # Team coordination, React hooks, and build guide
README.md
```

---

## API Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/packages/arrival` | Process package arrival (returns updated intervals, tree snapshot & real events) |
| `GET` | `/api/tree` | Current AVL tree hierarchical snapshot for D3 visualizer |
| `GET` | `/api/intervals` | List of all sorted consecutive intervals |
| `GET` | `/api/missing?low=1&high=100` | Missing unarrived package intervals within query range |
| `GET` | `/api/packages/search?id=5` | Check existence and enclosing interval in $O(\log n)$ |
| `GET` | `/api/statistics` | Runtime metrics (unique packages, intervals, height, merges, rotations) |
| `POST` | `/api/reset` | Clear index and reset statistics for demonstration |
| `WS` | `/ws/events` | Real-time WebSocket event stream during insertions |
| `GET` | `/api/events` | Server-Sent Events (SSE) event stream |

Detailed request/response JSON schemas are documented in [API_DOCUMENTATION.md](file:///c:/kv/mem2/API_DOCUMENTATION.md).

---

## Build and Run

### Build with CMake:
```bash
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

### Run Tests:
```bash
# Run backend concurrency and API verification
./build/rangex_test_backend

# Run core AVL algorithm tests
./build/rangex_test_avl
```

### Start Backend Server:
```bash
./build/rangex_server --port 8080
```
Server will be available at `http://localhost:8080` with WebSockets active at `ws://localhost:8080/ws/events`.

### Run Offline CLI Demo:
```bash
./build/rangex_server --demo
```
