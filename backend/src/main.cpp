#include "AVLTree.h"
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <chrono>

using namespace rangex;

void printBanner() {
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
    std::cout << "  events                - Output recorded algorithm events (JSON)\n";
    std::cout << "  stats                 - Show package and interval statistics\n";
    std::cout << "  demo                  - Run problem demonstration\n";
    std::cout << "  clear                 - Reset tree index\n";
    std::cout << "  exit / quit           - Terminate engine\n";
    std::cout << "========================================================\n\n";
}

void runDemo(AVLTree& tree) {
    tree.clear();
    std::cout << "\n--- DEMO: RANGEX Problem Scenario ---\n";
    std::cout << "Step 1: Warehouse receives packages 1, 2, 3, 6, 7, 8\n";
    std::vector<long long> initial = {1, 2, 3, 6, 7, 8};
    for (long long id : initial) {
        tree.clearEvents();
        tree.processPackageArrival(id);
    }
    std::cout << "Current Intervals: ";
    for (const auto& iv : tree.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 3] [6, 8]\n\n";

    std::cout << "Step 2: Incoming package 4 arrives\n";
    tree.clearEvents();
    tree.processPackageArrival(4);
    std::cout << "Algorithm Events for package 4:\n";
    for (const auto& ev : tree.getLogger().getEvents()) {
        std::cout << "  - " << eventTypeToString(ev.type) << ": " << ev.message << "\n";
    }
    std::cout << "Current Intervals: ";
    for (const auto& iv : tree.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 4] [6, 8]\n\n";

    std::cout << "Step 3: Incoming package 5 arrives (BRIDGE MERGE)\n";
    tree.clearEvents();
    tree.processPackageArrival(5);
    std::cout << "Algorithm Events for package 5:\n";
    for (const auto& ev : tree.getLogger().getEvents()) {
        std::cout << "  - " << eventTypeToString(ev.type) << ": " << ev.message << "\n";
    }
    std::cout << "Current Intervals: ";
    for (const auto& iv : tree.getAllIntervals()) std::cout << iv.toString() << " ";
    std::cout << "\nExpected: [1, 8]\n";
    std::cout << "Tree Snapshot JSON:\n" << tree.getTreeSnapshotJson() << "\n\n";
}

int main(int argc, char* argv[]) {
    AVLTree tree;

    // Check for CLI flags
    if (argc > 1) {
        std::string arg = argv[1];
        if (arg == "--demo") {
            runDemo(tree);
            return 0;
        } else if (arg == "--snapshot") {
            std::cout << tree.getTreeSnapshotJson() << std::endl;
            return 0;
        } else if (arg == "--batch") {
            // JSON pipe API mode for frontend integrations
            std::string line;
            while (std::getline(std::cin, line)) {
                if (line.empty()) continue;
                std::istringstream iss(line);
                std::string cmd;
                iss >> cmd;
                if (cmd == "insert") {
                    long long id;
                    iss >> id;
                    tree.clearEvents();
                    bool added = tree.processPackageArrival(id);
                    std::cout << "{\"status\":\"ok\",\"added\":" << (added ? "true" : "false")
                              << ",\"events\":" << tree.getLogger().toJson()
                              << ",\"snapshot\":" << tree.getTreeSnapshotJson()
                              << ",\"intervals\":[";
                    auto ivs = tree.getAllIntervals();
                    for (size_t i = 0; i < ivs.size(); ++i) {
                        if (i > 0) std::cout << ",";
                        std::cout << ivs[i].toJson();
                    }
                    std::cout << "],\"totalPackages\":" << tree.getTotalPackageCount()
                              << ",\"intervalCount\":" << tree.getIntervalCount() << "}\n" << std::flush;
                } else if (cmd == "contains") {
                    long long id;
                    iss >> id;
                    std::cout << "{\"contains\":" << (tree.containsPackage(id) ? "true" : "false") << "}\n" << std::flush;
                } else if (cmd == "snapshot") {
                    std::cout << tree.getTreeSnapshotJson() << "\n" << std::flush;
                } else if (cmd == "clear") {
                    tree.clear();
                    std::cout << "{\"status\":\"cleared\"}\n" << std::flush;
                } else if (cmd == "exit" || cmd == "quit") {
                    break;
                }
            }
            return 0;
        }
    }

    printBanner();

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
                tree.clearEvents();
                bool added = tree.processPackageArrival(id);
                std::cout << (added ? " [✓] Package ID " : " [!] Duplicate package ID ")
                          << id << (added ? " processed." : " ignored.") << "\n";
                std::cout << " Events:\n";
                for (const auto& ev : tree.getLogger().getEvents()) {
                    std::cout << "   " << eventTypeToString(ev.type) << ": " << ev.message << "\n";
                }
            } else {
                std::cout << "Usage: insert <id>\n";
            }
        } else if (cmd == "contains") {
            long long id;
            if (iss >> id) {
                bool found = tree.containsPackage(id);
                std::cout << (found ? "Package " + std::to_string(id) + " is PRESENT."
                                    : "Package " + std::to_string(id) + " is NOT present.") << "\n";
            } else {
                std::cout << "Usage: contains <id>\n";
            }
        } else if (cmd == "intervals") {
            auto intervals = tree.getAllIntervals();
            std::cout << "Consecutive Intervals (" << intervals.size() << "):\n";
            for (const auto& iv : intervals) {
                std::cout << "  " << iv.toString() << " (length: " << iv.length() << ")\n";
            }
        } else if (cmd == "missing") {
            long long qStart, qEnd;
            if (iss >> qStart >> qEnd) {
                auto missing = tree.getMissingIntervals(qStart, qEnd);
                std::cout << "Missing Intervals in [" << qStart << ", " << qEnd << "] (" << missing.size() << "):\n";
                for (const auto& iv : missing) {
                    std::cout << "  " << iv.toString() << "\n";
                }
            } else {
                std::cout << "Usage: missing <start> <end>\n";
            }
        } else if (cmd == "snapshot") {
            std::cout << tree.getTreeSnapshotJson() << "\n";
        } else if (cmd == "events") {
            std::cout << tree.getLogger().toJson() << "\n";
        } else if (cmd == "stats") {
            std::cout << "Total Received Packages: " << tree.getTotalPackageCount() << "\n";
            std::cout << "Total Intervals:         " << tree.getIntervalCount() << "\n";
            std::cout << "Tree Root Height:        " << (tree.getRoot() ? tree.getHeight(tree.getRoot()) : 0) << "\n";
        } else if (cmd == "demo") {
            runDemo(tree);
        } else if (cmd == "clear") {
            tree.clear();
            std::cout << "Warehouse index cleared.\n";
        } else {
            std::cout << "Unknown command: " << cmd << ". Type 'demo' or 'insert <id>' or 'intervals'.\n";
        }

        std::cout << "rangex> ";
    }

    return 0;
}
