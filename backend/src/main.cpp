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

int runCliMode(WarehouseManager& wm) {
    std::cout << "========================================================\n";
    std::cout << "   RANGEX - INTELLIGENT WAREHOUSE ARRIVAL INDEX         \n";
    std::cout << "   Custom AVL Tree Core Engine (C++17)                  \n";
    std::cout << "========================================================\n";
    std::cout << "Commands:\n";
    std::cout << "  insert <id>           - Process package arrival\n";
    std::cout << "  contains <id>         - Query if package exists\n";
    std::cout << "  intervals             - Display all consecutive intervals\n";
    std::cout << "  missing <start> <end> - Query missing intervals in range\n";
    std::cout << "  snapshot              - Output AVL tree JSON snapshot\n";
    std::cout << "  stats                 - Show package and interval statistics\n";
    std::cout << "  demo                  - Run problem demonstration\n";
    std::cout << "  clear                 - Reset tree index\n";
    std::cout << "  exit / quit           - Terminate engine\n";
    std::cout << "========================================================\n\n";

    std::string line;
    std::cout << "rangex> ";
    while (std::getline(std::cin, line)) {
        if (line.empty()) {
            std::cout << "rangex> ";
            continue;
        }

        std::istringstream iss(line);
        std::string cmd;
        iss >> cmd;

        if (cmd == "exit" || cmd == "quit") {
            std::cout << "Exiting RANGEX Engine.\n";
            break;
        } else if (cmd == "insert") {
            long long id;
            if (iss >> id) {
                auto res = wm.processPackageArrival(id);
                std::cout << (res.success ? " [✓] Package ID " : " [!] Duplicate/Invalid package ID ")
                          << id << " " << res.status << ": " << res.message << "\n";
            } else {
                std::cout << "Usage: insert <id>\n";
            }
        } else if (cmd == "contains") {
            long long id;
            if (iss >> id) {
                auto s = wm.searchPackage(id);
                std::cout << (s.exists ? "Package " + std::to_string(id) + " is PRESENT."
                                       : "Package " + std::to_string(id) + " is NOT present.") << "\n";
            } else {
                std::cout << "Usage: contains <id>\n";
            }
        } else if (cmd == "intervals") {
            auto intervals = wm.getAllIntervals();
            std::cout << "Consecutive Intervals (" << intervals.size() << "):\n";
            for (const auto& iv : intervals) {
                std::cout << "  " << iv.toString() << " (length: " << iv.length() << ")\n";
            }
        } else if (cmd == "missing") {
            long long qStart, qEnd;
            if (iss >> qStart >> qEnd) {
                auto missing = wm.getMissingIntervals(qStart, qEnd);
                std::cout << "Missing Intervals in [" << qStart << ", " << qEnd << "] (" << missing.size() << "):\n";
                for (const auto& iv : missing) {
                    std::cout << "  " << iv.toString() << "\n";
                }
            } else {
                std::cout << "Usage: missing <start> <end>\n";
            }
        } else if (cmd == "snapshot") {
            std::cout << wm.getTreeSnapshotJson() << "\n";
        } else if (cmd == "stats") {
            std::cout << wm.getStatistics().toJson() << "\n";
        } else if (cmd == "demo") {
            runDemo(wm);
        } else if (cmd == "clear") {
            wm.reset();
            std::cout << "Warehouse index cleared.\n";
        } else {
            std::cout << "Unknown command: " << cmd << ". Type 'demo', 'insert <id>', 'intervals', etc.\n";
        }

        std::cout << "rangex> ";
    }
    return 0;
}

int main(int argc, char* argv[]) {
    int port = 8080;
    bool demoMode = false;
    bool cliMode = false;
    bool snapshotMode = false;
    bool batchMode = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--demo") {
            demoMode = true;
        } else if (arg == "--cli") {
            cliMode = true;
        } else if (arg == "--snapshot") {
            snapshotMode = true;
        } else if (arg == "--batch") {
            batchMode = true;
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: rangex_server [options]\n"
                      << "  --port <port>   Specify server port (default: 8080)\n"
                      << "  --demo          Run offline demonstration and exit\n"
                      << "  --cli           Run interactive CLI terminal interface\n"
                      << "  --snapshot      Output AVL tree JSON snapshot and exit\n"
                      << "  --batch         Run JSON pipe API mode for stdin/stdout\n"
                      << "  --help, -h      Display this help message\n";
            return 0;
        }
    }

    EventManager eventManager;
    WarehouseManager warehouseManager(eventManager);

    if (snapshotMode) {
        std::cout << warehouseManager.getTreeSnapshotJson() << std::endl;
        return 0;
    }

    if (demoMode) {
        runDemo(warehouseManager);
        return 0;
    }

    if (cliMode) {
        return runCliMode(warehouseManager);
    }

    if (batchMode) {
        std::string line;
        while (std::getline(std::cin, line)) {
            if (line.empty()) continue;
            std::istringstream iss(line);
            std::string cmd;
            iss >> cmd;
            if (cmd == "insert") {
                long long id;
                iss >> id;
                auto res = warehouseManager.processPackageArrival(id);
                std::cout << res.toJson() << "\n" << std::flush;
            } else if (cmd == "contains") {
                long long id;
                iss >> id;
                auto s = warehouseManager.searchPackage(id);
                std::cout << s.toJson() << "\n" << std::flush;
            } else if (cmd == "snapshot") {
                std::cout << warehouseManager.getTreeSnapshotJson() << "\n" << std::flush;
            } else if (cmd == "clear") {
                warehouseManager.reset();
                std::cout << "{\"status\":\"cleared\"}\n" << std::flush;
            } else if (cmd == "exit" || cmd == "quit") {
                break;
            }
        }
        return 0;
    }

    printServerBanner(port);

    API api(warehouseManager, eventManager, port);
    api.run();

    return 0;
}
