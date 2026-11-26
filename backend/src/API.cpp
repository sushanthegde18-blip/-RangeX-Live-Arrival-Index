#include "API.h"
#include <iostream>
#include <sstream>
#include <string>
#include <chrono>

namespace rangex {

void API::setCorsHeaders(crow::response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With");
    res.set_header("Access-Control-Max-Age", "86400");
}

crow::response API::makeJsonResponse(int statusCode, const std::string& body) {
    crow::response res(statusCode, body);
    res.set_header("Content-Type", "application/json; charset=utf-8");
    setCorsHeaders(res);
    return res;
}

crow::response API::makeErrorResponse(int statusCode, const std::string& error, const std::string& message) {
    std::ostringstream ss;
    ss << "{";
    ss << "\"error\":\"" << error << "\",";
    ss << "\"message\":\"" << message << "\",";
    ss << "\"code\":" << statusCode;
    ss << "}";
    return makeJsonResponse(statusCode, ss.str());
}

API::API(WarehouseManager& wm, EventManager& em, int p)
    : warehouseManager(wm),
      eventManager(em),
      port(p) {}

API::~API() {
    stop();
}

void API::setupRoutes() {
    // ----------------------------------------------------
    // OPTIONS Preflight Handler for CORS
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/<path>")
    .methods(crow::HTTPMethod::Options)
    ([](const crow::request&, const std::string&) {
        crow::response res(204);
        setCorsHeaders(res);
        return res;
    });

    CROW_ROUTE(app, "/api/packages/<path>")
    .methods(crow::HTTPMethod::Options)
    ([](const crow::request&, const std::string&) {
        crow::response res(204);
        setCorsHeaders(res);
        return res;
    });

    // ----------------------------------------------------
    // Health Check Endpoint
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/health")
    .methods(crow::HTTPMethod::Get)
    ([]() {
        return makeJsonResponse(200, "{\"status\":\"ok\",\"service\":\"rangex-backend\",\"engine\":\"AVL-Tree-C++17\"}");
    });

    // ----------------------------------------------------
    // 1. Package Arrival API: POST /api/packages/arrival
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/packages/arrival")
    .methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        auto body = crow::json::load(req.body);
        if (!body) {
            return makeErrorResponse(400, "MalformedJSON", "Request body must be a valid JSON object");
        }

        if (!body.has("packageId")) {
            return makeErrorResponse(400, "MissingField", "Missing required field 'packageId' in request body");
        }

        // Validate package ID type and range
        long long packageId = 0;
        try {
            if (body["packageId"].t() == crow::json::type::Number) {
                packageId = body["packageId"].i();
            } else if (body["packageId"].t() == crow::json::type::String) {
                packageId = std::stoll(std::string(body["packageId"].s()));
            } else {
                return makeErrorResponse(400, "InvalidType", "Field 'packageId' must be an integer number");
            }
        } catch (...) {
            return makeErrorResponse(400, "InvalidFormat", "Failed to parse 'packageId' as a 64-bit integer");
        }

        if (packageId < WarehouseManager::MIN_PACKAGE_ID) {
            return makeErrorResponse(400, "OutOfRange", "Package ID cannot be zero or negative. Minimum valid ID is 1");
        }
        if (packageId > WarehouseManager::MAX_PACKAGE_ID) {
            return makeErrorResponse(400, "OutOfRange", "Package ID exceeds warehouse capacity. Maximum valid ID is 1,000,000,000 (10^9)");
        }

        // Execute package arrival on real AVL Tree
        ArrivalResult result = warehouseManager.processPackageArrival(packageId);

        if (!result.success && result.status == "error") {
            return makeErrorResponse(400, "ProcessingError", result.message);
        }

        return makeJsonResponse(200, result.toJson());
    });

    // ----------------------------------------------------
    // 2. Tree Snapshot API: GET /api/tree
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/tree")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        std::string treeSnapshot = warehouseManager.getTreeSnapshotJson();
        auto stats = warehouseManager.getStatistics();

        std::ostringstream ss;
        ss << "{";
        ss << "\"height\":" << stats.avlTreeHeight << ",";
        ss << "\"intervalCount\":" << stats.totalIntervals << ",";
        ss << "\"totalPackages\":" << stats.totalUniquePackages << ",";
        ss << "\"root\":";
        if (!treeSnapshot.empty() && treeSnapshot != "null") {
            ss << treeSnapshot;
        } else {
            ss << "null";
        }
        ss << "}";

        return makeJsonResponse(200, ss.str());
    });

    // ----------------------------------------------------
    // 3. Interval API: GET /api/intervals
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/intervals")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        std::vector<Interval> intervals = warehouseManager.getAllIntervals();
        std::ostringstream ss;
        ss << "{";
        ss << "\"count\":" << intervals.size() << ",";
        ss << "\"intervals\":[";
        for (size_t i = 0; i < intervals.size(); ++i) {
            if (i > 0) ss << ",";
            ss << intervals[i].toJson();
        }
        ss << "]}";

        return makeJsonResponse(200, ss.str());
    });

    // ----------------------------------------------------
    // 4. Missing Range API: GET /api/missing?low=1&high=100
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/missing")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        long long low = 1;
        long long high = 100;

        char* lowParam = req.url_params.get("low");
        char* highParam = req.url_params.get("high");

        if (lowParam) {
            try {
                low = std::stoll(lowParam);
            } catch (...) {
                return makeErrorResponse(400, "InvalidParameter", "Parameter 'low' must be an integer");
            }
        }
        if (highParam) {
            try {
                high = std::stoll(highParam);
            } catch (...) {
                return makeErrorResponse(400, "InvalidParameter", "Parameter 'high' must be an integer");
            }
        }

        if (low < 0) {
            return makeErrorResponse(400, "OutOfRange", "Query bound 'low' cannot be negative");
        }
        if (high > WarehouseManager::MAX_PACKAGE_ID) {
            return makeErrorResponse(400, "OutOfRange", "Query bound 'high' cannot exceed 1,000,000,000");
        }
        if (low > high) {
            return makeErrorResponse(400, "InvalidRange", "Query bound 'low' cannot be greater than 'high'");
        }

        std::vector<Interval> missing = warehouseManager.getMissingIntervals(low, high);

        std::ostringstream ss;
        ss << "{";
        ss << "\"queryRange\":{\"low\":" << low << ",\"high\":" << high << "},";
        ss << "\"count\":" << missing.size() << ",";
        ss << "\"missingIntervals\":[";
        for (size_t i = 0; i < missing.size(); ++i) {
            if (i > 0) ss << ",";
            ss << missing[i].toJson();
        }
        ss << "]}";

        return makeJsonResponse(200, ss.str());
    });

    // ----------------------------------------------------
    // 5. Package Search API: GET /api/packages/search?id=5
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/packages/search")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        char* idParam = req.url_params.get("id");
        if (!idParam) {
            return makeErrorResponse(400, "MissingParameter", "Query parameter 'id' is required (e.g. ?id=5)");
        }

        long long packageId = 0;
        try {
            packageId = std::stoll(idParam);
        } catch (...) {
            return makeErrorResponse(400, "InvalidParameter", "Query parameter 'id' must be a valid integer");
        }

        if (packageId < WarehouseManager::MIN_PACKAGE_ID || packageId > WarehouseManager::MAX_PACKAGE_ID) {
            return makeErrorResponse(400, "OutOfRange", "Package ID must be between 1 and 1,000,000,000");
        }

        SearchResult result = warehouseManager.searchPackage(packageId);
        return makeJsonResponse(200, result.toJson());
    });

    // ----------------------------------------------------
    // 6. Statistics API: GET /api/statistics
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/statistics")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        long long low = 1;
        long long high = 100;

        char* lowParam = req.url_params.get("low");
        char* highParam = req.url_params.get("high");
        if (lowParam) {
            try { low = std::stoll(lowParam); } catch (...) {}
        }
        if (highParam) {
            try { high = std::stoll(highParam); } catch (...) {}
        }

        WarehouseStatistics stats = warehouseManager.getStatistics(low, high);
        return makeJsonResponse(200, stats.toJson());
    });

    // ----------------------------------------------------
    // 7. Reset API: POST /api/reset
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/reset")
    .methods(crow::HTTPMethod::Post, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        warehouseManager.reset();

        std::ostringstream ss;
        ss << "{";
        ss << "\"success\":true,";
        ss << "\"message\":\"Warehouse arrival index and runtime statistics reset successfully\",";
        ss << "\"treeSnapshot\":null,";
        ss << "\"intervals\":[]";
        ss << "}";

        return makeJsonResponse(200, ss.str());
    });

    // ----------------------------------------------------
    // 8. Event History API: GET /api/events/history
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/events/history")
    .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Options)
    ([this](const crow::request& req) {
        if (req.method == crow::HTTPMethod::Options) {
            crow::response res(204);
            setCorsHeaders(res);
            return res;
        }

        size_t limit = 100;
        char* limitParam = req.url_params.get("limit");
        if (limitParam) {
            try { limit = std::max(1, std::min(500, std::stoi(limitParam))); } catch (...) {}
        }

        std::vector<EnrichedEvent> events = eventManager.getRecentEvents(limit);
        std::ostringstream ss;
        ss << "{";
        ss << "\"count\":" << events.size() << ",";
        ss << "\"events\":[";
        for (size_t i = 0; i < events.size(); ++i) {
            if (i > 0) ss << ",";
            ss << events[i].toJson();
        }
        ss << "]}";

        return makeJsonResponse(200, ss.str());
    });

    // ----------------------------------------------------
    // 9. Real-Time WebSocket Route: /ws/events
    // ----------------------------------------------------
    CROW_WEBSOCKET_ROUTE(app, "/ws/events")
    .onopen([this](crow::websocket::connection& conn) {
        eventManager.addConnection(&conn);
        // Send initial connected greeting with current tree snapshot
        std::string currentSnapshot = warehouseManager.getTreeSnapshotJson();
        std::ostringstream ss;
        ss << "{\"eventType\":\"SYSTEM_CONNECTED\",\"message\":\"Connected to RangeX real-time event stream\",\"treeSnapshot\":"
           << (currentSnapshot.empty() ? "null" : currentSnapshot) << "}";
        try {
            conn.send_text(ss.str());
        } catch (...) {}
    })
    .onclose([this](crow::websocket::connection& conn, const std::string& reason) {
        eventManager.removeConnection(&conn);
    })
    .onmessage([this](crow::websocket::connection& conn, const std::string& data, bool /*is_binary*/) {
        if (data == "ping") {
            try { conn.send_text("{\"type\":\"pong\"}"); } catch (...) {}
        } else if (data == "snapshot") {
            std::string snap = warehouseManager.getTreeSnapshotJson();
            std::ostringstream ss;
            ss << "{\"eventType\":\"SNAPSHOT_RESPONSE\",\"treeSnapshot\":" << (snap.empty() ? "null" : snap) << "}";
            try { conn.send_text(ss.str()); } catch (...) {}
        }
    });

    // ----------------------------------------------------
    // 10. Server-Sent Events (SSE) Route: GET /api/events
    // ----------------------------------------------------
    CROW_ROUTE(app, "/api/events")
    .methods(crow::HTTPMethod::Get)
    ([this](const crow::request&, crow::response& res) {
        res.set_header("Content-Type", "text/event-stream; charset=utf-8");
        res.set_header("Cache-Control", "no-cache");
        res.set_header("Connection", "keep-alive");
        setCorsHeaders(res);

        // Send initial SSE frame
        res.write("data: {\"eventType\":\"SSE_CONNECTED\",\"message\":\"RangeX SSE stream active\"}\n\n");
        res.end();
    });
}

void API::run() {
    setupRoutes();
    std::cout << "[RangeX API] Server starting on http://0.0.0.0:" << port << std::endl;
    std::cout << "[RangeX API] WebSocket available at ws://0.0.0.0:" << port << "/ws/events" << std::endl;
    app.port(port).multithreaded().run();
}

void API::runAsync() {
    setupRoutes();
    std::cout << "[RangeX API] Server starting asynchronously on port " << port << std::endl;
    serverThread = std::make_unique<std::thread>([this]() {
        app.port(port).multithreaded().run();
    });
}

void API::stop() {
    if (serverThread && serverThread->joinable()) {
        app.stop();
        serverThread->join();
        serverThread.reset();
    }
}

} // namespace rangex
