#include "WarehouseManager.h"
#include <sstream>
#include <stdexcept>
#include <algorithm>

namespace rangex {

std::string ArrivalResult::toJson() const {
    std::ostringstream ss;
    ss << "{";
    ss << "\"success\":" << (success ? "true" : "false") << ",";
    ss << "\"status\":\"" << status << "\",";
    ss << "\"packageId\":" << packageId << ",";

    // Escape message string
    ss << "\"message\":\"";
    for (char c : message) {
        if (c == '"') ss << "\\\"";
        else if (c == '\\') ss << "\\\\";
        else ss << c;
    }
    ss << "\",";

    ss << "\"intervals\":[";
    for (size_t i = 0; i < intervals.size(); ++i) {
        if (i > 0) ss << ",";
        ss << intervals[i].toJson();
    }
    ss << "],";

    ss << "\"treeSnapshot\":";
    if (!treeSnapshotJson.empty() && treeSnapshotJson != "null") {
        ss << treeSnapshotJson;
    } else {
        ss << "null";
    }
    ss << ",";

    ss << "\"events\":[";
    for (size_t i = 0; i < events.size(); ++i) {
        if (i > 0) ss << ",";
        ss << events[i].toJson();
    }
    ss << "]";

    ss << "}";
    return ss.str();
}

std::string SearchResult::toJson() const {
    std::ostringstream ss;
    ss << "{";
    ss << "\"exists\":" << (exists ? "true" : "false") << ",";
    ss << "\"packageId\":" << packageId << ",";
    ss << "\"interval\":";
    if (interval.has_value()) {
        ss << interval->toJson();
    } else {
        ss << "null";
    }
    ss << "}";
    return ss.str();
}

std::string WarehouseStatistics::toJson() const {
    std::ostringstream ss;
    ss << "{";
    ss << "\"totalUniquePackages\":" << totalUniquePackages << ",";
    ss << "\"totalIntervals\":" << totalIntervals << ",";
    ss << "\"avlTreeHeight\":" << avlTreeHeight << ",";
    ss << "\"successfulInsertions\":" << successfulInsertions << ",";
    ss << "\"duplicateArrivals\":" << duplicateArrivals << ",";
    ss << "\"intervalMerges\":" << intervalMerges << ",";
    ss << "\"avlRotations\":" << avlRotations << ",";
    ss << "\"boundedRange\":{";
    ss << "\"low\":" << boundedRangeLow << ",";
    ss << "\"high\":" << boundedRangeHigh;
    ss << "},";
    ss << "\"missingRangesInBound\":" << missingRangesInBound;
    ss << "}";
    return ss.str();
}

WarehouseManager::WarehouseManager(EventManager& em)
    : eventManager(em),
      successfulInsertions(0),
      duplicateArrivals(0),
      intervalMerges(0),
      avlRotations(0) {
    // Connect Member 1's AVL Tree logger to our event stream handler
    tree.getLogger().setCallback([this](const AlgorithmEvent& ev) {
        this->handleTreeAlgorithmEvent(ev);
    });
}

void WarehouseManager::handleTreeAlgorithmEvent(const AlgorithmEvent& event) {
    // Track stats from discrete AVL events
    switch (event.type) {
        case EventType::LEFT_ROTATION:
        case EventType::RIGHT_ROTATION:
            avlRotations++;
            break;
        case EventType::INTERVAL_MERGED:
            intervalMerges++;
            break;
        case EventType::DUPLICATE_IGNORED:
            duplicateArrivals++;
            break;
        default:
            break;
    }

    // Attach tree snapshot for major structural updates so visualizer can update view
    std::string snapshotJson = "";
    if (event.type == EventType::TREE_UPDATED ||
        event.type == EventType::INSERTION_COMPLETED ||
        event.type == EventType::LEFT_ROTATION ||
        event.type == EventType::RIGHT_ROTATION) {
        snapshotJson = tree.getTreeSnapshotJson();
    }

    eventManager.publishAlgorithmEvent(event, snapshotJson);
}

ArrivalResult WarehouseManager::processPackageArrival(long long packageId) {
    // Input validation
    if (packageId < MIN_PACKAGE_ID || packageId > MAX_PACKAGE_ID) {
        return ArrivalResult{
            false,
            "error",
            packageId,
            "Package ID " + std::to_string(packageId) + " is invalid. Must be between 1 and 1,000,000,000.",
            {},
            "null",
            {}
        };
    }

    std::unique_lock<std::shared_mutex> lock(rwMutex);

    std::string opId = eventManager.startOperation(packageId);
    tree.clearEvents();

    bool added = tree.processPackageArrival(packageId);
    if (added) {
        successfulInsertions++;
    }

    std::vector<Interval> currentIntervals = tree.getAllIntervals();
    std::string currentSnapshot = tree.getTreeSnapshotJson();
    std::vector<EnrichedEvent> opEvents = eventManager.finishOperation();

    std::string status = added ? "inserted" : "duplicate";
    std::string msg = added
        ? ("Package " + std::to_string(packageId) + " successfully integrated into arrival index")
        : ("Duplicate package ID " + std::to_string(packageId) + " ignored; already indexed");

    return ArrivalResult{
        added,
        status,
        packageId,
        msg,
        std::move(currentIntervals),
        std::move(currentSnapshot),
        std::move(opEvents)
    };
}

SearchResult WarehouseManager::searchPackage(long long packageId) const {
    if (packageId < MIN_PACKAGE_ID || packageId > MAX_PACKAGE_ID) {
        return SearchResult{false, packageId, std::nullopt};
    }

    std::shared_lock<std::shared_mutex> lock(rwMutex);
    AVLNode* node = tree.findIntervalContaining(packageId);
    if (node) {
        return SearchResult{true, packageId, Interval(node->intervalStart, node->intervalEnd)};
    }
    return SearchResult{false, packageId, std::nullopt};
}

std::vector<Interval> WarehouseManager::getAllIntervals() const {
    std::shared_lock<std::shared_mutex> lock(rwMutex);
    return tree.getAllIntervals();
}

std::vector<Interval> WarehouseManager::getMissingIntervals(long long low, long long high) const {
    if (low < 0 || high > MAX_PACKAGE_ID || low > high) {
        return {};
    }

    std::shared_lock<std::shared_mutex> lock(rwMutex);
    return tree.getMissingIntervals(low, high);
}

std::string WarehouseManager::getTreeSnapshotJson() const {
    std::shared_lock<std::shared_mutex> lock(rwMutex);
    return tree.getTreeSnapshotJson();
}

WarehouseStatistics WarehouseManager::getStatistics(long long missingLow, long long missingHigh) const {
    std::shared_lock<std::shared_mutex> lock(rwMutex);

    long long validLow = std::max(0LL, missingLow);
    long long validHigh = std::min(MAX_PACKAGE_ID, std::max(validLow, missingHigh));

    std::vector<Interval> missing = tree.getMissingIntervals(validLow, validHigh);
    int height = tree.getHeight(tree.getRoot());

    return WarehouseStatistics{
        tree.getTotalPackageCount(),
        tree.getIntervalCount(),
        height,
        successfulInsertions,
        duplicateArrivals,
        intervalMerges,
        avlRotations,
        validLow,
        validHigh,
        missing.size()
    };
}

void WarehouseManager::reset() {
    std::unique_lock<std::shared_mutex> lock(rwMutex);
    tree.clear();
    successfulInsertions = 0;
    duplicateArrivals = 0;
    intervalMerges = 0;
    avlRotations = 0;

    eventManager.clearHistory();
    eventManager.publishSystemEvent("RESET", 0, "Warehouse index and statistics reset to empty initial state", "null");
}

} // namespace rangex
