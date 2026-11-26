#include "WarehouseManager.h"
#include "EventManager.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <thread>
#include <future>
#include <random>

using namespace rangex;

void testArrivalAndEnrichedEvents() {
    std::cout << "[Backend Test 1] Package Arrival and Event Enrichment..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    ArrivalResult r1 = wm.processPackageArrival(10);
    assert(r1.success);
    assert(r1.status == "inserted");
    assert(r1.packageId == 10);
    assert(!r1.events.empty());

    // Check enriched event properties
    const auto& ev = r1.events[0];
    assert(!ev.eventId.empty());
    assert(!ev.operationId.empty());
    assert(ev.sequenceNumber >= 1);
    assert(ev.packageId == 10);

    // Verify intervals
    assert(r1.intervals.size() == 1);
    assert(r1.intervals[0] == Interval(10, 10));

    std::cout << "  Passed!" << std::endl;
}

void testBridgeMergeAndRotations() {
    std::cout << "[Backend Test 2] Bridge Merge Tracking and Statistics..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    wm.processPackageArrival(1);
    wm.processPackageArrival(2);
    wm.processPackageArrival(3);
    wm.processPackageArrival(5);
    wm.processPackageArrival(6);

    // Bridge merge with 4
    ArrivalResult rBridge = wm.processPackageArrival(4);
    assert(rBridge.success);
    assert(rBridge.status == "inserted");
    assert(rBridge.intervals.size() == 1);
    assert(rBridge.intervals[0] == Interval(1, 6));

    // Verify bridge merge event was captured
    bool foundMergeEvent = false;
    for (const auto& event : rBridge.events) {
        if (event.eventType == "INTERVAL_MERGED") {
            foundMergeEvent = true;
            assert(event.nodeStart.has_value() && *event.nodeStart == 1);
            assert(event.nodeEnd.has_value() && *event.nodeEnd == 6);
        }
    }
    assert(foundMergeEvent);

    // Verify statistics
    WarehouseStatistics stats = wm.getStatistics(1, 10);
    assert(stats.totalUniquePackages == 6);
    assert(stats.totalIntervals == 1);
    assert(stats.intervalMerges == 1);
    assert(stats.successfulInsertions == 6);

    std::cout << "  Passed!" << std::endl;
}

void testDuplicateHandling() {
    std::cout << "[Backend Test 3] Duplicate Package Detection & Non-Corruption..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    ArrivalResult r1 = wm.processPackageArrival(42);
    assert(r1.success);

    // Duplicate arrival
    ArrivalResult rDup = wm.processPackageArrival(42);
    assert(!rDup.success);
    assert(rDup.status == "duplicate");
    assert(rDup.packageId == 42);

    WarehouseStatistics stats = wm.getStatistics();
    assert(stats.duplicateArrivals == 1);
    assert(stats.totalUniquePackages == 1);

    std::cout << "  Passed!" << std::endl;
}

void testMissingRangesAndSparseIDs() {
    std::cout << "[Backend Test 4] Sparse Intervals & Missing Ranges ($10^9)..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    wm.processPackageArrival(10);
    wm.processPackageArrival(11);
    wm.processPackageArrival(12);

    // Missing in [1, 20]
    auto missing = wm.getMissingIntervals(1, 20);
    assert(missing.size() == 2);
    assert(missing[0] == Interval(1, 9));
    assert(missing[1] == Interval(13, 20));

    // Sparse check up to 10^9
    wm.processPackageArrival(1000000000LL);
    auto searchFound = wm.searchPackage(1000000000LL);
    assert(searchFound.exists);
    assert(searchFound.interval.has_value());
    assert(searchFound.interval->start == 1000000000LL);

    std::cout << "  Passed!" << std::endl;
}

void testConcurrentThreadSafety() {
    std::cout << "[Backend Test 5] Concurrent Thread-Safety Stress Test..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    constexpr int NUM_THREADS = 8;
    constexpr int PACKAGES_PER_THREAD = 200;
    std::vector<std::thread> threads;

    // Concurrently insert packages across disjoint ranges
    for (int t = 0; t < NUM_THREADS; ++t) {
        threads.emplace_back([&wm, t]() {
            long long base = (t + 1) * 10000LL;
            for (int i = 0; i < PACKAGES_PER_THREAD; ++i) {
                wm.processPackageArrival(base + i);
                // Interleave search and statistics reads
                if (i % 20 == 0) {
                    wm.searchPackage(base + i);
                    wm.getStatistics(1, 100000);
                }
            }
        });
    }

    for (auto& th : threads) {
        th.join();
    }

    WarehouseStatistics finalStats = wm.getStatistics();
    assert(finalStats.totalUniquePackages == NUM_THREADS * PACKAGES_PER_THREAD);
    assert(finalStats.successfulInsertions == NUM_THREADS * PACKAGES_PER_THREAD);
    assert(finalStats.totalIntervals == NUM_THREADS);

    std::cout << "  Passed! Multi-threaded access completed without corruption." << std::endl;
}

void testResetApi() {
    std::cout << "[Backend Test 6] Reset Functionality..." << std::endl;
    EventManager em;
    WarehouseManager wm(em);

    wm.processPackageArrival(100);
    wm.processPackageArrival(200);
    assert(wm.getAllIntervals().size() == 2);

    wm.reset();
    assert(wm.getAllIntervals().empty());
    assert(wm.getTreeSnapshotJson() == "null");
    WarehouseStatistics stats = wm.getStatistics();
    assert(stats.totalUniquePackages == 0);
    assert(stats.successfulInsertions == 0);

    std::cout << "  Passed!" << std::endl;
}

int main() {
    std::cout << "======================================================" << std::endl;
    std::cout << "   RANGEX BACKEND API & WAREHOUSE MANAGER TEST SUITE  " << std::endl;
    std::cout << "======================================================" << std::endl;

    testArrivalAndEnrichedEvents();
    testBridgeMergeAndRotations();
    testDuplicateHandling();
    testMissingRangesAndSparseIDs();
    testConcurrentThreadSafety();
    testResetApi();

    std::cout << "\n======================================================" << std::endl;
    std::cout << "   ALL BACKEND & THREAD SAFETY TESTS PASSED!          " << std::endl;
    std::cout << "======================================================" << std::endl;

    return 0;
}
