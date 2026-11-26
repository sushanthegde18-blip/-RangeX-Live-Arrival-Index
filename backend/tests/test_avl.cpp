#include "AVLTree.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <random>
#include <chrono>
#include <algorithm>

using namespace rangex;

void testBasicExample() {
    std::cout << "[Test 1] Basic Warehouse Example..." << std::endl;
    AVLTree tree;

    // Insert 1, 2, 3, 6, 7, 8
    std::vector<long long> initial = {1, 2, 3, 6, 7, 8};
    for (long long id : initial) {
        tree.processPackageArrival(id);
    }

    auto intervals = tree.getAllIntervals();
    assert(intervals.size() == 2);
    assert(intervals[0] == Interval(1, 3));
    assert(intervals[1] == Interval(6, 8));
    assert(tree.getIntervalCount() == 2);
    assert(tree.getTotalPackageCount() == 6);

    // Insert 4 -> [1,4] [6,8]
    tree.processPackageArrival(4);
    intervals = tree.getAllIntervals();
    assert(intervals.size() == 2);
    assert(intervals[0] == Interval(1, 4));
    assert(intervals[1] == Interval(6, 8));
    assert(tree.getTotalPackageCount() == 7);

    // Insert 5 -> Bridge merge -> [1,8]
    tree.processPackageArrival(5);
    intervals = tree.getAllIntervals();
    assert(intervals.size() == 1);
    assert(intervals[0] == Interval(1, 8));
    assert(tree.getIntervalCount() == 1);
    assert(tree.getTotalPackageCount() == 8);

    std::cout << "  Passed!" << std::endl;
}

void testIncreasingOrder() {
    std::cout << "[Test 2] Increasing Insertion Order..." << std::endl;
    AVLTree tree;
    for (long long i = 1; i <= 1000; ++i) {
        bool added = tree.processPackageArrival(i);
        assert(added);
    }
    assert(tree.getIntervalCount() == 1);
    assert(tree.getTotalPackageCount() == 1000);
    auto intervals = tree.getAllIntervals();
    assert(intervals.size() == 1);
    assert(intervals[0] == Interval(1, 1000));
    std::cout << "  Passed!" << std::endl;
}

void testDecreasingOrder() {
    std::cout << "[Test 3] Decreasing Insertion Order..." << std::endl;
    AVLTree tree;
    for (long long i = 1000; i >= 1; --i) {
        bool added = tree.processPackageArrival(i);
        assert(added);
    }
    assert(tree.getIntervalCount() == 1);
    assert(tree.getTotalPackageCount() == 1000);
    auto intervals = tree.getAllIntervals();
    assert(intervals.size() == 1);
    assert(intervals[0] == Interval(1, 1000));
    std::cout << "  Passed!" << std::endl;
}

void testDuplicates() {
    std::cout << "[Test 4] Duplicate Package Handling..." << std::endl;
    AVLTree tree;
    assert(tree.processPackageArrival(10));
    assert(tree.processPackageArrival(11));
    assert(tree.processPackageArrival(12));

    // Duplicates inside interval
    assert(!tree.processPackageArrival(10));
    assert(!tree.processPackageArrival(11));
    assert(!tree.processPackageArrival(12));

    assert(tree.getIntervalCount() == 1);
    assert(tree.getTotalPackageCount() == 3);

    // Verify event log recorded DUPLICATE_IGNORED
    bool duplicateEventFound = false;
    for (const auto& ev : tree.getLogger().getEvents()) {
        if (ev.type == EventType::DUPLICATE_IGNORED) {
            duplicateEventFound = true;
            break;
        }
    }
    assert(duplicateEventFound);
    std::cout << "  Passed!" << std::endl;
}

void testBridgeMergingComplex() {
    std::cout << "[Test 5] Complex Bridge Merging..." << std::endl;
    AVLTree tree;
    // Create [1, 2], [4, 5], [7, 8], [10, 11]
    tree.processPackageArrival(1);
    tree.processPackageArrival(2);
    tree.processPackageArrival(4);
    tree.processPackageArrival(5);
    tree.processPackageArrival(7);
    tree.processPackageArrival(8);
    tree.processPackageArrival(10);
    tree.processPackageArrival(11);

    assert(tree.getIntervalCount() == 4);

    // Bridge 3: connects [1, 2] and [4, 5] -> [1, 5]
    tree.processPackageArrival(3);
    assert(tree.getIntervalCount() == 3);
    auto ivs = tree.getAllIntervals();
    assert(ivs[0] == Interval(1, 5));
    assert(ivs[1] == Interval(7, 8));
    assert(ivs[2] == Interval(10, 11));

    // Bridge 9: connects [7, 8] and [10, 11] -> [7, 11]
    tree.processPackageArrival(9);
    assert(tree.getIntervalCount() == 2);
    ivs = tree.getAllIntervals();
    assert(ivs[0] == Interval(1, 5));
    assert(ivs[1] == Interval(7, 11));

    // Bridge 6: connects [1, 5] and [7, 11] -> [1, 11]
    tree.processPackageArrival(6);
    assert(tree.getIntervalCount() == 1);
    ivs = tree.getAllIntervals();
    assert(ivs[0] == Interval(1, 11));
    assert(tree.getTotalPackageCount() == 11);
    std::cout << "  Passed!" << std::endl;
}

void testRotations() {
    std::cout << "[Test 6] Explicit AVL Rotations (LL, RR, LR, RL)..." << std::endl;

    // Test Right Rotation (LL Case)
    {
        AVLTree tree;
        tree.insertInterval(30, 30);
        tree.insertInterval(20, 20);
        tree.insertInterval(10, 10); // Causes LL imbalance at 30

        AVLNode* root = tree.getRoot();
        assert(root->intervalStart == 20);
        assert(root->left->intervalStart == 10);
        assert(root->right->intervalStart == 30);

        bool hasRightRot = false;
        for (const auto& ev : tree.getLogger().getEvents()) {
            if (ev.type == EventType::RIGHT_ROTATION) hasRightRot = true;
        }
        assert(hasRightRot);
    }

    // Test Left Rotation (RR Case)
    {
        AVLTree tree;
        tree.insertInterval(10, 10);
        tree.insertInterval(20, 20);
        tree.insertInterval(30, 30); // Causes RR imbalance at 10

        AVLNode* root = tree.getRoot();
        assert(root->intervalStart == 20);
        assert(root->left->intervalStart == 10);
        assert(root->right->intervalStart == 30);

        bool hasLeftRot = false;
        for (const auto& ev : tree.getLogger().getEvents()) {
            if (ev.type == EventType::LEFT_ROTATION) hasLeftRot = true;
        }
        assert(hasLeftRot);
    }

    // Test Left-Right Rotation (LR Case)
    {
        AVLTree tree;
        tree.insertInterval(30, 30);
        tree.insertInterval(10, 10);
        tree.insertInterval(20, 20); // Causes LR imbalance at 30

        AVLNode* root = tree.getRoot();
        assert(root->intervalStart == 20);
        assert(root->left->intervalStart == 10);
        assert(root->right->intervalStart == 30);

        bool hasLeftRot = false;
        bool hasRightRot = false;
        for (const auto& ev : tree.getLogger().getEvents()) {
            if (ev.type == EventType::LEFT_ROTATION) hasLeftRot = true;
            if (ev.type == EventType::RIGHT_ROTATION) hasRightRot = true;
        }
        assert(hasLeftRot && hasRightRot);
    }

    // Test Right-Left Rotation (RL Case)
    {
        AVLTree tree;
        tree.insertInterval(10, 10);
        tree.insertInterval(30, 30);
        tree.insertInterval(20, 20); // Causes RL imbalance at 10

        AVLNode* root = tree.getRoot();
        assert(root->intervalStart == 20);
        assert(root->left->intervalStart == 10);
        assert(root->right->intervalStart == 30);

        bool hasLeftRot = false;
        bool hasRightRot = false;
        for (const auto& ev : tree.getLogger().getEvents()) {
            if (ev.type == EventType::LEFT_ROTATION) hasLeftRot = true;
            if (ev.type == EventType::RIGHT_ROTATION) hasRightRot = true;
        }
        assert(hasLeftRot && hasRightRot);
    }

    std::cout << "  Passed!" << std::endl;
}

void testLargeSparseIDs() {
    std::cout << "[Test 7] Large Sparse IDs (up to 10^9)..." << std::endl;
    AVLTree tree;

    tree.processPackageArrival(1);
    tree.processPackageArrival(500000000LL);
    tree.processPackageArrival(1000000000LL);

    assert(tree.getIntervalCount() == 3);
    assert(tree.containsPackage(500000000LL));
    assert(tree.containsPackage(1000000000LL));
    assert(!tree.containsPackage(2));
    assert(!tree.containsPackage(999999999LL));

    // Bridge merge around 500M
    tree.processPackageArrival(499999999LL);
    tree.processPackageArrival(500000001LL);
    auto ivs = tree.getAllIntervals();
    assert(ivs[1] == Interval(499999999LL, 500000001LL));

    std::cout << "  Passed!" << std::endl;
}

void testMissingIntervals() {
    std::cout << "[Test 8] Missing Interval Queries..." << std::endl;
    AVLTree tree;

    // Warehouse has [10, 20] and [30, 40]
    for (long long i = 10; i <= 20; ++i) tree.processPackageArrival(i);
    for (long long i = 30; i <= 40; ++i) tree.processPackageArrival(i);

    // Query [1, 50]
    auto missing = tree.getMissingIntervals(1, 50);
    // Gaps: [1, 9], [21, 29], [41, 50]
    assert(missing.size() == 3);
    assert(missing[0] == Interval(1, 9));
    assert(missing[1] == Interval(21, 29));
    assert(missing[2] == Interval(41, 50));

    // Query within existing interval [12, 18] -> no missing
    auto noneMissing = tree.getMissingIntervals(12, 18);
    assert(noneMissing.empty());

    // Query inside gap [22, 28] -> entire range is missing
    auto allMissing = tree.getMissingIntervals(22, 28);
    assert(allMissing.size() == 1);
    assert(allMissing[0] == Interval(22, 28));

    std::cout << "  Passed!" << std::endl;
}

void testTreeSnapshot() {
    std::cout << "[Test 9] Tree Snapshot Generation..." << std::endl;
    AVLTree tree;
    tree.processPackageArrival(10);
    tree.processPackageArrival(20);
    tree.processPackageArrival(30);

    std::string snapshot = tree.getTreeSnapshotJson();
    assert(!snapshot.empty());
    assert(snapshot.find("\"intervalStart\":20") != std::string::npos);
    assert(snapshot.find("\"height\":") != std::string::npos);
    assert(snapshot.find("\"balanceFactor\":") != std::string::npos);

    std::cout << "  Snapshot JSON: " << snapshot << std::endl;
    std::cout << "  Passed!" << std::endl;
}

void testFiftyThousandPackages() {
    std::cout << "[Test 10] Performance & Stress Test: 50,000 Random Packages..." << std::endl;
    AVLTree tree;
    tree.getLogger().setRecording(false); // disable detailed per-event allocation for 50k run

    constexpr int NUM_PACKAGES = 50000;
    std::vector<long long> packages;
    packages.reserve(NUM_PACKAGES);

    std::mt19937_64 rng(42);
    std::uniform_int_distribution<long long> dist(1, 500000);

    for (int i = 0; i < NUM_PACKAGES; ++i) {
        packages.push_back(dist(rng));
    }

    auto start = std::chrono::high_resolution_clock::now();

    size_t uniqueCount = 0;
    for (long long id : packages) {
        if (tree.processPackageArrival(id)) {
            uniqueCount++;
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    std::cout << "  Inserted " << NUM_PACKAGES << " packages (" << uniqueCount << " unique) in "
              << durationMs << " ms (" << (durationMs > 0 ? (NUM_PACKAGES * 1000 / durationMs) : NUM_PACKAGES * 1000)
              << " ops/sec)" << std::endl;
    std::cout << "  Final interval count: " << tree.getIntervalCount() << std::endl;
    std::cout << "  Total packages accounted for: " << tree.getTotalPackageCount() << std::endl;
    assert(tree.getTotalPackageCount() == static_cast<long long>(uniqueCount));

    // Verify AVL tree balance property holds across every single node
    std::function<void(AVLNode*)> verifyAVL = [&](AVLNode* node) {
        if (!node) return;
        int bf = tree.getBalanceFactor(node);
        assert(bf >= -1 && bf <= 1);
        verifyAVL(node->left);
        verifyAVL(node->right);
    };
    verifyAVL(tree.getRoot());

    // Verify intervals are sorted and non-overlapping
    auto intervals = tree.getAllIntervals();
    for (size_t i = 1; i < intervals.size(); ++i) {
        assert(intervals[i - 1].end < intervals[i].start - 1);
    }

    std::cout << "  AVL balance factor and interval invariants verified across all nodes!" << std::endl;
    std::cout << "  Passed!" << std::endl;
}

int main() {
    std::cout << "======================================================" << std::endl;
    std::cout << "   RANGEX AVL TREE CORE ALGORITHM VERIFICATION SUITE   " << std::endl;
    std::cout << "======================================================" << std::endl;

    testBasicExample();
    testIncreasingOrder();
    testDecreasingOrder();
    testDuplicates();
    testBridgeMergingComplex();
    testRotations();
    testLargeSparseIDs();
    testMissingIntervals();
    testTreeSnapshot();
    testFiftyThousandPackages();

    std::cout << "\n======================================================" << std::endl;
    std::cout << "   ALL 10 TEST SUITES PASSED PERFECTLY!                " << std::endl;
    std::cout << "======================================================" << std::endl;

    return 0;
}
