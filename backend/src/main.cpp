#include "rangex/backend_service.hpp"

#include <crow_all.h>

#include <cstdlib>
#include <iostream>
#include <mutex>
#include <string>
#include <unordered_set>

namespace {

crow::response makeJsonResponse(int statusCode, const nlohmann::json& body) {
    crow::response res(statusCode, body.dump());
    res.set_header("Content-Type", "application/json");
    return res;
}

crow::response makeErrorResponse(int statusCode, const std::string& code, const std::string& message) {
    return makeJsonResponse(statusCode, nlohmann::json{
        {"error", code},
        {"message", message}
    });
}

bool parseInt64Strict(const nlohmann::json& val, int64_t& out) {
    if (val.is_number_integer() || val.is_number_unsigned()) {
        if (val.is_number_unsigned()) {
            const uint64_t u = val.get<uint64_t>();
            if (u > static_cast<uint64_t>(rangex::MAX_PACKAGE_ID)) return false;
            out = static_cast<int64_t>(u);
            return true;
        }
        out = val.get<int64_t>();
        return true;
    }
    return false;
}

bool parseQueryInt64(const char* raw, int64_t& out) {
    if (!raw || *raw == '\0') return false;
    try {
        std::size_t idx = 0;
        const std::string s(raw);
        const long long parsed = std::stoll(s, &idx, 10);
        if (idx != s.size()) return false;
        out = static_cast<int64_t>(parsed);
        return true;
    } catch (...) {
        return false;
    }
}

std::size_t parseQuerySize(const char* raw, std::size_t fallback) {
    if (!raw || *raw == '\0') return fallback;
    try {
        std::size_t idx = 0;
        const std::string s(raw);
        const unsigned long long parsed = std::stoull(s, &idx, 10);
        if (idx != s.size()) return fallback;
        return static_cast<std::size_t>(parsed);
    } catch (...) {
        return fallback;
    }
}

}  // namespace

int main(int argc, char** argv) {
    uint16_t port = 8080;
    if (const char* envPort = std::getenv("RANGEX_PORT")) {
        try {
            const int p = std::stoi(envPort);
            if (p > 0 && p <= 65535) port = static_cast<uint16_t>(p);
        } catch (...) {}
    }
    for (int i = 1; i + 1 < argc; ++i) {
        if (std::string(argv[i]) == "--port") {
            try {
                const int p = std::stoi(argv[i + 1]);
                if (p > 0 && p <= 65535) port = static_cast<uint16_t>(p);
            } catch (...) {}
        }
    }

    rangex::BackendService service;

    std::mutex wsMutex;
    std::unordered_set<crow::websocket::connection*> wsClients;

    auto broadcastEvent = [&](const nlohmann::json& frame) {
        const std::string serialized = frame.dump();
        std::lock_guard<std::mutex> lock(wsMutex);
        for (auto* conn : wsClients) {
            if (conn) {
                conn->send_text(serialized);
            }
        }
    };

    crow::App<crow::CORSHandler> app;
    auto& cors = app.get_middleware<crow::CORSHandler>();
    cors.global()
        .origin("*")
        .methods("GET"_method, "POST"_method, "OPTIONS"_method)
        .headers("Content-Type", "Accept", "Origin");

    CROW_WEBSOCKET_ROUTE(app, "/ws")
        .onopen([&](crow::websocket::connection& conn) {
            std::lock_guard<std::mutex> lock(wsMutex);
            wsClients.insert(&conn);
        })
        .onclose([&](crow::websocket::connection& conn, const std::string&, uint16_t) {
            std::lock_guard<std::mutex> lock(wsMutex);
            wsClients.erase(&conn);
        })
        .onmessage([&](crow::websocket::connection& conn, const std::string& data, bool) {
            if (data == "ping") {
                conn.send_text(nlohmann::json{
                    {"type", "HEARTBEAT"},
                    {"timestamp", rangex::BackendService::currentIsoTimestamp()}
                }.dump());
            }
        });

    CROW_ROUTE(app, "/api/health").methods("GET"_method)([&]() {
        return makeJsonResponse(200, service.getHealth());
    });

    auto handlePackageArrival = [&](const crow::request& req) {
        nlohmann::json body;
        try {
            body = nlohmann::json::parse(req.body);
        } catch (...) {
            return makeErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
        }

        if (!body.is_object() || !body.contains("packageId")) {
            return makeErrorResponse(400, "VALIDATION_ERROR", "Missing required integer field: packageId");
        }

        int64_t packageId = 0;
        if (!parseInt64Strict(body["packageId"], packageId) || !rangex::BackendService::isValidPackageId(packageId)) {
            return makeErrorResponse(
                400,
                "VALIDATION_ERROR",
                "packageId must be an integer between 0 and 1000000000"
            );
        }

        const std::string priority = body.value("priority", std::string("STANDARD"));
        const std::string label = body.value("label", std::string(""));

        try {
            nlohmann::json result = service.arrivePackage(packageId, priority, label);
            broadcastEvent(nlohmann::json{
                {"type", "PACKAGE_ARRIVED"},
                {"timestamp", result["timestamp"]},
                {"eventId", result["eventId"]},
                {"arrival", result}
            });
            return makeJsonResponse(200, result);
        } catch (const std::exception& ex) {
            return makeErrorResponse(400, "ENGINE_ERROR", ex.what());
        }
    };

    CROW_ROUTE(app, "/api/packages").methods("POST"_method)(handlePackageArrival);
    CROW_ROUTE(app, "/api/packages/arrive").methods("POST"_method)(handlePackageArrival);

    CROW_ROUTE(app, "/api/intervals").methods("GET"_method)([&](const crow::request& req) {
        const std::size_t offset = parseQuerySize(req.url_params.get("offset"), 0);
        const std::size_t limit = parseQuerySize(req.url_params.get("limit"), 0);
        const char* allFlag = req.url_params.get("all");
        const bool includeAll = (allFlag != nullptr && std::string(allFlag) == "true");
        return makeJsonResponse(200, service.getIntervals(offset, limit, includeAll));
    });

    CROW_ROUTE(app, "/api/gaps").methods("GET"_method)([&](const crow::request& req) {
        int64_t start = 0;
        int64_t end = 0;
        if (!parseQueryInt64(req.url_params.get("start"), start) ||
            !parseQueryInt64(req.url_params.get("end"), end)) {
            return makeErrorResponse(
                400,
                "VALIDATION_ERROR",
                "Query parameters 'start' and 'end' are required integers"
            );
        }
        if (!rangex::BackendService::isValidPackageId(start) ||
            !rangex::BackendService::isValidPackageId(end) ||
            start > end) {
            return makeErrorResponse(
                400,
                "VALIDATION_ERROR",
                "Query range must satisfy 0 <= start <= end <= 1000000000"
            );
        }
        const std::size_t limit = parseQuerySize(req.url_params.get("limit"), 500);
        return makeJsonResponse(200, service.getGaps(start, end, limit));
    });

    CROW_ROUTE(app, "/api/stats").methods("GET"_method)([&]() {
        return makeJsonResponse(200, service.getStats());
    });
    CROW_ROUTE(app, "/api/analytics").methods("GET"_method)([&]() {
        return makeJsonResponse(200, service.getStats());
    });

    auto handleTree = [&](const crow::request& req) {
        const std::size_t limit = parseQuerySize(req.url_params.get("limit"), 250);
        return makeJsonResponse(200, service.getTreeSnapshot(limit));
    };
    CROW_ROUTE(app, "/api/tree").methods("GET"_method)(handleTree);
    CROW_ROUTE(app, "/api/avl/snapshot").methods("GET"_method)(handleTree);

    CROW_ROUTE(app, "/api/events").methods("GET"_method)([&](const crow::request& req) {
        const std::size_t offset = parseQuerySize(req.url_params.get("offset"), 0);
        const std::size_t limit = parseQuerySize(req.url_params.get("limit"), 250);
        return makeJsonResponse(200, service.getEvents(offset, limit));
    });

    CROW_ROUTE(app, "/api/simulate").methods("POST"_method)([&](const crow::request& req) {
        nlohmann::json body;
        try {
            body = req.body.empty() ? nlohmann::json::object() : nlohmann::json::parse(req.body);
        } catch (...) {
            return makeErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
        }

        const int64_t rawCount = body.value("count", int64_t{10});
        const std::string pattern = body.value("pattern", std::string("random"));
        const int64_t minId = body.value("minId", int64_t{0});
        const int64_t maxId = body.value("maxId", int64_t{250});

        if (rawCount <= 0 || rawCount > 1000) {
            return makeErrorResponse(400, "VALIDATION_ERROR", "count must be between 1 and 1000");
        }

        try {
            nlohmann::json res = service.simulateArrivals(
                static_cast<std::size_t>(rawCount),
                pattern,
                minId,
                maxId
            );
            broadcastEvent(nlohmann::json{
                {"type", "INTERVALS_UPDATED"},
                {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                {"intervals", res["intervals"]}
            });
            broadcastEvent(nlohmann::json{
                {"type", "AVL_SNAPSHOT_UPDATED"},
                {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                {"avlSnapshot", res["avlSnapshot"]}
            });
            broadcastEvent(nlohmann::json{
                {"type", "ANALYTICS_UPDATED"},
                {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                {"analytics", res["analytics"]}
            });
            return makeJsonResponse(200, res);
        } catch (const std::exception& ex) {
            return makeErrorResponse(400, "VALIDATION_ERROR", ex.what());
        }
    });

    CROW_ROUTE(app, "/api/bulk-arrivals").methods("POST"_method)([&](const crow::request& req) {
        nlohmann::json body;
        try {
            body = nlohmann::json::parse(req.body);
        } catch (...) {
            return makeErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
        }

        try {
            nlohmann::json res = service.bulkArrivals(body);
            if (!res.value("benchmarkOnly", false)) {
                broadcastEvent(nlohmann::json{
                    {"type", "INTERVALS_UPDATED"},
                    {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                    {"intervals", res["intervals"]}
                });
                broadcastEvent(nlohmann::json{
                    {"type", "AVL_SNAPSHOT_UPDATED"},
                    {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                    {"avlSnapshot", res["avlSnapshot"]}
                });
                broadcastEvent(nlohmann::json{
                    {"type", "ANALYTICS_UPDATED"},
                    {"timestamp", rangex::BackendService::currentIsoTimestamp()},
                    {"analytics", res["analytics"]}
                });
            }
            return makeJsonResponse(200, res);
        } catch (const std::exception& ex) {
            return makeErrorResponse(400, "VALIDATION_ERROR", ex.what());
        }
    });

    CROW_ROUTE(app, "/api/reset").methods("POST"_method)([&]() {
        nlohmann::json res = service.reset();
        broadcastEvent(nlohmann::json{
            {"type", "INTERVALS_UPDATED"},
            {"timestamp", res["timestamp"]},
            {"intervals", res["intervals"]}
        });
        broadcastEvent(nlohmann::json{
            {"type", "AVL_SNAPSHOT_UPDATED"},
            {"timestamp", res["timestamp"]},
            {"avlSnapshot", res["avlSnapshot"]}
        });
        broadcastEvent(nlohmann::json{
            {"type", "ANALYTICS_UPDATED"},
            {"timestamp", res["timestamp"]},
            {"analytics", res["analytics"]}
        });
        return makeJsonResponse(200, res);
    });

    std::cout << "[RangeX] C++17 Crow REST & WebSocket server listening on http://127.0.0.1:" << port << "\n";
    app.port(port).multithreaded().run();
    return 0;
}
