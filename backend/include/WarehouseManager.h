#ifndef RANGEX_WAREHOUSEMANAGER_H
#define RANGEX_WAREHOUSEMANAGER_H

#include "AVLTree.h"
#include "EventManager.h"
#include <string>
#include <vector>
#include <shared_mutex>
#include <optional>
#include <cstdint>

namespace rangex {

/**
 * @brief Result returned after processing a package arrival.
 */
struct ArrivalResult {
    bool success;
    std::string status; // "inserted", "duplicate", "error"
    long long packageId;
    std::string message;
    std::vector<Interval> intervals;
    std::string treeSnapshotJson;
    std::vector<EnrichedEvent> events;

    std::string toJson() const;
};

/**
 * @brief Result returned when searching for a package ID.
 */
struct SearchResult {
    bool exists;
    long long packageId;
    std::optional<Interval> interval;

    std::string toJson() const;
};

/**
 * @brief Statistical metrics covering the warehouse AVL tree and operation history.
 */
struct WarehouseStatistics {
    long long totalUniquePackages;
    size_t totalIntervals;
    int avlTreeHeight;
    uint64_t successfulInsertions;
    uint64_t duplicateArrivals;
    uint64_t intervalMerges;
    uint64_t avlRotations;
    long long boundedRangeLow;
    long long boundedRangeHigh;
    size_t missingRangesInBound;

    std::string toJson() const;
};

/**
 * @brief Thread-safe manager coordinating warehouse index operations on Member 1's AVL tree.
 * Provides reader-writer synchronization (shared_mutex) to support high-concurrency queries
 * while preventing race conditions or tree corruption during write operations.
 */
class WarehouseManager {
public:
    static constexpr long long MIN_PACKAGE_ID = 1;
    static constexpr long long MAX_PACKAGE_ID = 1000000000LL; // 10^9

    explicit WarehouseManager(EventManager& em);
    ~WarehouseManager() = default;

    // Disable copy and move to guard the synchronization primitives and tree identity
    WarehouseManager(const WarehouseManager&) = delete;
    WarehouseManager& operator=(const WarehouseManager&) = delete;
    WarehouseManager(WarehouseManager&&) = delete;
    WarehouseManager& operator=(WarehouseManager&&) = delete;

    /**
     * @brief Process an incoming package arrival.
     * Validates ID, triggers AVL insertion/merge/extension, captures events, and returns updated state.
     * Thread-safe (acquires unique_lock).
     */
    ArrivalResult processPackageArrival(long long packageId);

    /**
     * @brief Search whether a package exists and retrieve the containing interval.
     * Thread-safe (acquires shared_lock).
     */
    SearchResult searchPackage(long long packageId) const;

    /**
     * @brief Get all sorted consecutive intervals currently in the AVL tree.
     * Thread-safe (acquires shared_lock).
     */
    std::vector<Interval> getAllIntervals() const;

    /**
     * @brief Compute all missing ranges of unarrived packages within [low, high].
     * Thread-safe (acquires shared_lock).
     */
    std::vector<Interval> getMissingIntervals(long long low, long long high) const;

    /**
     * @brief Get the current AVL tree structure as a hierarchical JSON snapshot.
     * Thread-safe (acquires shared_lock).
     */
    std::string getTreeSnapshotJson() const;

    /**
     * @brief Compute real-time statistics including rotations, merges, duplicates, and height.
     * Thread-safe (acquires shared_lock).
     */
    WarehouseStatistics getStatistics(long long missingLow = 1, long long missingHigh = 100) const;

    /**
     * @brief Reset the entire warehouse index, statistics counters, and event log.
     * Thread-safe (acquires unique_lock).
     */
    void reset();

    /**
     * @brief Directly access the underlying AVL Tree (for testing or direct inspection).
     */
    AVLTree& getTree() { return tree; }
    const AVLTree& getTree() const { return tree; }

private:
    AVLTree tree;
    EventManager& eventManager;
    mutable std::shared_mutex rwMutex;

    // Operation counters
    uint64_t successfulInsertions;
    uint64_t duplicateArrivals;
    uint64_t intervalMerges;
    uint64_t avlRotations;

    void handleTreeAlgorithmEvent(const AlgorithmEvent& event);
};

} // namespace rangex

#endif // RANGEX_WAREHOUSEMANAGER_H
