#include "API.h"
#include "WarehouseManager.h"
#include "EventManager.h"
#include <iostream>
#include <string>
#include <vector>
#include <sstream>

using namespace rangex;

void printServerBanner(int port) {
    std::cout << "================================================================\n";
    std::cout << "   RANGEX - INTELLIGENT WAREHOUSE ARRIVAL INDEX BACKEND         \n";
    std::cout << "   C++17 AVL Tree Engine | Crow Framework | WebSockets          \n";
    std::cout << "================================================================\n";
    std::cout << "  HTTP REST API:    http://localhost:" << port << "/api\n";
    std::cout << "  WebSocket Stream: ws://localhost:" << port << "/ws/events\n";
    std::cout << "  SSE Stream:       http://localhost:" << port << "/api/events\n";
    std::cout << "  Arrival Endpoint: POST http://localhost:" << port << "/api/packages/arrival\n";
    std::cout << "  Tree Snapshot:    GET  http://localhost:" << port << "/api/tree\n";
    std::cout << "  Intervals API:    GET  http://localhost:" << port << "/api/intervals\n";
    std::cout << "  Missing API:      GET  http://localhost:" << port << "/api/missing?low=1&high=100\n";
    std::cout << "  Search API:       GET  http://localhost:" << port << "/api/packages/search?id=5\n";
    std::cout << "  Statistics API:   GET  http://localhost:" << port << "/api/statistics\n";
    std::cout << "  Reset API:        POST http://localhost:" << port << "/api/reset\n";
    std::cout << "================================================================\n";
    std::cout << "  Ready to accept connections from React frontend visualizer...\n\n";
}

void runDemo(WarehouseManager& wm) {
    wm.reset();
    std::cout << "\n--- DEMO: RANGEX Problem Scenario & Bridge Merge ---\n";
    std::cout << "Step 1: Warehouse receives packages 1, 2, 3, 6, 7, 8\n";
    std::vector<long long> initial = {1, 2, 3, 6, 7, 8};
    for (long long id : initial) {
        wm.processPackageArrival(id);
    }
    std::cout << "Current Intervals: ";
    for (const auto& iv : wm.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 3] [6, 8]\n\n";

    std::cout << "Step 2: Incoming package 4 arrives\n";
    ArrivalResult r4 = wm.processPackageArrival(4);
    std::cout << "Status: " << r4.status << " - " << r4.message << "\n";
    std::cout << "Events captured: " << r4.events.size() << "\n";
    std::cout << "Current Intervals: ";
    for (const auto& iv : wm.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 4] [6, 8]\n\n";

    std::cout << "Step 3: Incoming package 5 arrives (BRIDGE MERGE)\n";
    ArrivalResult r5 = wm.processPackageArrival(5);
    std::cout << "Status: " << r5.status << " - " << r5.message << "\n";
    std::cout << "Algorithm Events for package 5:\n";
    for (const auto& ev : r5.events) {
        std::cout << "  [" << ev.sequenceNumber << "] " << ev.eventType << ": " << ev.message << "\n";
    }
    std::cout << "Current Intervals: ";
    for (const auto& iv : wm.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 8]\n";
    std::cout << "Tree Snapshot JSON:\n" << wm.getTreeSnapshotJson() << "\n\n";

    auto stats = wm.getStatistics(1, 10);
    std::cout << "Statistics:\n" << stats.toJson() << "\n\n";
}

int main(int argc, char* argv[]) {
    int port = 8080;
    bool demoMode = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--demo") {
            demoMode = true;
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: rangex_server [options]\n"
                      << "  --port <port>   Specify server port (default: 8080)\n"
                      << "  --demo          Run offline demonstration and exit\n"
                      << "  --help, -h      Display this help message\n";
            return 0;
        }
    }

    EventManager eventManager;
    WarehouseManager warehouseManager(eventManager);

    if (demoMode) {
        runDemo(warehouseManager);
        return 0;
    }

    printServerBanner(port);

    API api(warehouseManager, eventManager, port);
    api.run();

    return 0;
}
