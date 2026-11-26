# RANGEX – Backend REST API & Real-Time Event Stream Documentation

**Version:** 1.0.0  
**Framework:** Crow (C++17)  
**Base URL:** `http://localhost:8080`  
**WebSocket URL:** `ws://localhost:8080/ws/events`  
**SSE URL:** `http://localhost:8080/api/events`

---

## 1. Architectural Overview

RANGEX provides an intelligent warehouse arrival indexing backend that connects a custom C++17 self-balancing AVL Tree to a React visualizer frontend.

```
+-------------------------------------------------------------------------+
|                              React Frontend                             |
|       (Tree Visualizer, Interval Badges, Real-Time Algorithm Steps)     |
+-------------------+---------------------------------+-------------------+
                    | REST (HTTP JSON)                | WebSockets / SSE
                    v                                 v
+-------------------------------------------------------------------------+
|                             Crow Web Server                             |
|                                 (API.cpp)                               |
+-------------------+---------------------------------+-------------------+
                    |                                 |
                    v                                 v
+------------------------------------+   +--------------------------------+
|          WarehouseManager          |   |          EventManager          |
|  - Reader-Writer Lock (shared_mutex|   |  - Real-Time Broadcast Bus     |
|  - Statistics Tracking             |   |  - Event Enrichment & History  |
|  - Input Validation                |   |  - WebSocket Client Registry   |
+-------------------+----------------+   +----------------+---------------+
                    |                                     ^
                    | Direct Method Calls                 | Event Callback
                    v                                     | (Zero Simulation)
+---------------------------------------------------------+---------------+
|                        Custom AVL Tree Engine (Member 1)                |
|  - Self-Balancing AVL Invariant (Balance Factor in {-1, 0, 1})          |
|  - Bridge Merging ([1, 3] + 4 + [5, 8] -> [1, 8])                       |
|  - Dynamic Extensions & Rotations (LL, RR, LR, RL)                      |
|  - Discrete Algorithm Event Emitter                                     |
+-------------------------------------------------------------------------+
```

---

## 2. Real-Time Algorithm Event Stream

### WebSocket Connection: `GET /ws/events`

The website connects to `ws://localhost:8080/ws/events` to receive discrete algorithm events in real time while an insertion or rebalancing operation is occurring.

#### Client-to-Server Messages
- `"ping"`: Server responds with `{"type":"pong"}`.
- `"snapshot"`: Server responds with the current AVL tree JSON snapshot.

#### Server-to-Client Enriched Event Schema (Contract with Member 4)
Every algorithm event originates directly from Member 1's AVL tree execution (`logger.record(...)`). No synthetic or fake events are generated.

```json
{
  "eventId": "ev_1",
  "operationId": "op_pkg_5_1732600000123",
  "sequenceNumber": 4,
  "eventType": "INTERVAL_MERGED",
  "packageId": 5,
  "message": "Bridge merge: package 5 bridges [1, 4] and [6, 8] into [1, 8]",
  "timestamp": 1732600000125,
  "nodeInfo": {
    "nodeStart": 1,
    "nodeEnd": 8,
    "pivotStart": null,
    "childStart": null,
    "parentStart": null
  },
  "treeSnapshot": {
    "intervalStart": 1,
    "intervalEnd": 8,
    "height": 1,
    "balanceFactor": 0,
    "left": null,
    "right": null
  }
}
```

### Event Type Catalog

| `eventType` | Triggered When | Context Provided |
|---|---|---|
| `PACKAGE_RECEIVED` | New package arrival initiates | `packageId` |
| `SEARCH_STARTED` | Lookup begins for existing interval | `packageId` |
| `NODE_VISITED` | Tree traversal visits an AVL node | `nodeStart`, `nodeEnd` |
| `INTERVAL_FOUND` | Package already falls in an interval | `nodeStart`, `nodeEnd` |
| `DUPLICATE_IGNORED` | Duplicate package identified & rejected | `nodeStart`, `nodeEnd` |
| `PREDECESSOR_FOUND` | Interval immediately to the left found | `nodeStart`, `nodeEnd` |
| `SUCCESSOR_FOUND` | Interval immediately to the right found | `nodeStart`, `nodeEnd` |
| `NEW_INTERVAL_CREATED` | Package forms isolated interval `[P, P]` | `nodeStart`, `nodeEnd` |
| `INTERVAL_EXTENDED` | Interval expanded on left or right | `nodeStart`, `nodeEnd` |
| `INTERVAL_MERGED` | Bridge merge unites two intervals | `nodeStart`, `nodeEnd` |
| `AVL_NODE_INSERTED` | New AVL node memory allocated | `nodeStart`, `nodeEnd` |
| `AVL_NODE_DELETED` | AVL node deleted during bridge merge | `nodeStart`, `nodeEnd` |
| `LEFT_ROTATION` | Left (RR) rotation executed | `pivotStart`, `childStart` |
| `RIGHT_ROTATION` | Right (LL) rotation executed | `pivotStart`, `childStart` |
| `TREE_UPDATED` | Rebalancing completes after change | `treeSnapshot` |
| `INSERTION_COMPLETED` | Entire arrival process finishes | `treeSnapshot` |

---

## 3. REST API Endpoints

### 3.1 Package Arrival
- **Route:** `POST /api/packages/arrival`
- **Description:** Submits an incoming package ID to the AVL tree warehouse index. Handles insertion, extension, or bridge merging. Returns captured algorithm events, updated interval list, and tree snapshot.

#### Request Example
```http
POST /api/packages/arrival HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "packageId": 5
}
```

#### Successful Insertion Response (200 OK)
```json
{
  "success": true,
  "status": "inserted",
  "packageId": 5,
  "message": "Package 5 successfully integrated into arrival index",
  "intervals": [
    {
      "start": 1,
      "end": 8
    }
  ],
  "treeSnapshot": {
    "intervalStart": 1,
    "intervalEnd": 8,
    "height": 1,
    "balanceFactor": 0,
    "left": null,
    "right": null
  },
  "events": [
    {
      "eventId": "ev_1",
      "operationId": "op_pkg_5_1732600100000",
      "sequenceNumber": 1,
      "eventType": "PACKAGE_RECEIVED",
      "packageId": 5,
      "message": "Package ID 5 received at warehouse",
      "timestamp": 1732600100001,
      "nodeInfo": {},
      "treeSnapshot": null
    },
    {
      "eventId": "ev_2",
      "operationId": "op_pkg_5_1732600100000",
      "sequenceNumber": 2,
      "eventType": "SEARCH_STARTED",
      "packageId": 5,
      "message": "Searching for interval containing package 5",
      "timestamp": 1732600100002,
      "nodeInfo": {},
      "treeSnapshot": null
    },
    {
      "eventId": "ev_3",
      "operationId": "op_pkg_5_1732600100000",
      "sequenceNumber": 3,
      "eventType": "INTERVAL_MERGED",
      "packageId": 5,
      "message": "Bridge merge: package 5 bridges [1, 4] and [6, 8] into [1, 8]",
      "timestamp": 1732600100003,
      "nodeInfo": {
        "nodeStart": 1,
        "nodeEnd": 8
      },
      "treeSnapshot": {
        "intervalStart": 1,
        "intervalEnd": 8,
        "height": 1,
        "balanceFactor": 0,
        "left": null,
        "right": null
      }
    },
    {
      "eventId": "ev_4",
      "operationId": "op_pkg_5_1732600100000",
      "sequenceNumber": 4,
      "eventType": "INSERTION_COMPLETED",
      "packageId": 5,
      "message": "Package 5 integrated via bridge merge",
      "timestamp": 1732600100004,
      "nodeInfo": {
        "nodeStart": 1,
        "nodeEnd": 8
      },
      "treeSnapshot": {
        "intervalStart": 1,
        "intervalEnd": 8,
        "height": 1,
        "balanceFactor": 0,
        "left": null,
        "right": null
      }
    }
  ]
}
```

#### Duplicate Arrival Response (200 OK)
```json
{
  "success": false,
  "status": "duplicate",
  "packageId": 5,
  "message": "Duplicate package ID 5 ignored; already indexed",
  "intervals": [
    {
      "start": 1,
      "end": 8
    }
  ],
  "treeSnapshot": { ... },
  "events": [
    {
      "eventId": "ev_5",
      "operationId": "op_pkg_5_1732600100500",
      "sequenceNumber": 1,
      "eventType": "DUPLICATE_IGNORED",
      "packageId": 5,
      "message": "Duplicate package ID 5 ignored",
      "timestamp": 1732600100501,
      "nodeInfo": {
        "nodeStart": 1,
        "nodeEnd": 8
      },
      "treeSnapshot": null
    }
  ]
}
```

---

### 3.2 Tree Snapshot
- **Route:** `GET /api/tree`
- **Description:** Returns the current hierarchical state of the AVL tree for D3 / SVG rendering.

#### Response Example (200 OK)
```json
{
  "height": 2,
  "intervalCount": 3,
  "totalPackages": 15,
  "root": {
    "intervalStart": 20,
    "intervalEnd": 25,
    "height": 2,
    "balanceFactor": 0,
    "left": {
      "intervalStart": 1,
      "intervalEnd": 5,
      "height": 1,
      "balanceFactor": 0,
      "left": null,
      "right": null
    },
    "right": {
      "intervalStart": 50,
      "intervalEnd": 53,
      "height": 1,
      "balanceFactor": 0,
      "left": null,
      "right": null
    }
  }
}
```

---

### 3.3 Sorted Intervals
- **Route:** `GET /api/intervals`
- **Description:** Retrieves all consecutive intervals currently tracked in the warehouse, sorted by `start`.

#### Response Example (200 OK)
```json
{
  "count": 2,
  "intervals": [
    {
      "start": 1,
      "end": 4
    },
    {
      "start": 6,
      "end": 8
    }
  ]
}
```

---

### 3.4 Missing Ranges
- **Route:** `GET /api/missing?low=1&high=100`
- **Query Parameters:**
  - `low` (int64, default 1): Lower bound of package ID range.
  - `high` (int64, default 100): Upper bound of package ID range (up to $10^9$).
- **Description:** Calculates missing package IDs within `[low, high]` that have not arrived yet. Computed $O(k)$ without memory allocation.

#### Response Example (200 OK)
```json
{
  "queryRange": {
    "low": 1,
    "high": 100
  },
  "count": 2,
  "missingIntervals": [
    {
      "start": 5,
      "end": 5
    },
    {
      "start": 9,
      "end": 100
    }
  ]
}
```

---

### 3.5 Package Search
- **Route:** `GET /api/packages/search?id=5`
- **Query Parameters:**
  - `id` (int64, required): The package ID to search.
- **Description:** Discovers whether package ID exists in $O(\log n)$ and returns the interval enclosing it.

#### Response (Package Exists - 200 OK)
```json
{
  "exists": true,
  "packageId": 5,
  "interval": {
    "start": 1,
    "end": 8
  }
}
```

#### Response (Package Not Arrived - 200 OK)
```json
{
  "exists": false,
  "packageId": 99,
  "interval": null
}
```

---

### 3.6 Statistics
- **Route:** `GET /api/statistics?low=1&high=100`
- **Description:** Returns live warehouse metrics.

#### Response Example (200 OK)
```json
{
  "totalUniquePackages": 8,
  "totalIntervals": 1,
  "avlTreeHeight": 1,
  "successfulInsertions": 8,
  "duplicateArrivals": 1,
  "intervalMerges": 1,
  "avlRotations": 2,
  "boundedRange": {
    "low": 1,
    "high": 100
  },
  "missingRangesInBound": 2
}
```

---

### 3.7 Reset
- **Route:** `POST /api/reset`
- **Description:** Resets tree nodes, statistics counters, and event buffers to initial state for demos and tests. Broadcasts `RESET` event over WebSockets.

#### Response Example (200 OK)
```json
{
  "success": true,
  "message": "Warehouse arrival index and runtime statistics reset successfully",
  "treeSnapshot": null,
  "intervals": []
}
```

---

## 4. Error Handling Matrix

| HTTP Status | Error Type | Scenario | Response Example |
|---|---|---|---|
| `400 Bad Request` | `MalformedJSON` | Request body is empty or malformed | `{"error":"MalformedJSON","message":"Request body must be a valid JSON object","code":400}` |
| `400 Bad Request` | `MissingField` | Body lacks `"packageId"` | `{"error":"MissingField","message":"Missing required field 'packageId' in request body","code":400}` |
| `400 Bad Request` | `OutOfRange` | Package ID $\le 0$ | `{"error":"OutOfRange","message":"Package ID cannot be zero or negative. Minimum valid ID is 1","code":400}` |
| `400 Bad Request` | `OutOfRange` | Package ID $> 10^9$ | `{"error":"OutOfRange","message":"Package ID exceeds warehouse capacity. Maximum valid ID is 1,000,000,000 (10^9)","code":400}` |
| `400 Bad Request` | `InvalidRange` | In missing query, `low > high` | `{"error":"InvalidRange","message":"Query bound 'low' cannot be greater than 'high'","code":400}` |
| `400 Bad Request` | `MissingParameter` | Search query lacks `?id=` | `{"error":"MissingParameter","message":"Query parameter 'id' is required (e.g. ?id=5)","code":400}` |
