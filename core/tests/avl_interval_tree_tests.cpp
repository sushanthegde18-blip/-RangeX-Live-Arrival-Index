#include "rangex/avl_interval_tree.hpp"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <iostream>
#include <random>
#include <vector>

using namespace rangex;

namespace {

void require(bool cond, const std::string& msg) {
    if (!cond) {
        std::cerr << "[FAIL] " << msg << "\n";
        std::exit(1);
    }
}

void assertTreeValid(const AvlIntervalTree& tree, const std::string& context) {
    auto report = tree.verifyInvariants();
    require(report.valid, context + ": " + report.errorMessage);
}

void testPromptWorkedExample() {
    AvlIntervalTree tree;
    auto r1 = tree.insert(1);
    require(r1.mutationType == MutationType::CREATED, "1 should CREATE");
    auto r3 = tree.insert(3);
    require(r3.mutationType == MutationType::CREATED, "3 should CREATE");
    auto r7 = tree.insert(7);
    require(r7.mutationType == MutationType::CREATED, "7 should CREATE");
    auto r2 = tree.insert(2);
    require(r2.mutationType == MutationType::MERGED, "2 should MERGE [1,1] and [3,3]");
    auto r6 = tree.insert(6);
    require(r6.mutationType == MutationType::EXTENDED, "6 should EXTEND [7,7] leftwards");

    auto ivs = tree.getIntervals();
    require(ivs.size() == 2, "Expected 2 intervals after 1,3,7,2,6");
    require(ivs[0].start == 1 && ivs[0].end == 3, "First interval should be [1,3]");
    require(ivs[1].start == 6 && ivs[1].end == 7, "Second interval should be [6,7]");

    auto gaps = tree.findMissingRanges(1, 7);
    require(gaps.missingIntervals.size() == 1, "Expected 1 missing range in [1,7]");
    require(gaps.missingIntervals[0].start == 4 && gaps.missingIntervals[0].end == 5, "Missing range should be [4,5]");
    require(gaps.missingCount == 2 && gaps.presentCount == 5, "Gap counts mismatch");

    assertTreeValid(tree, "Prompt worked example");
}

void testBridgeMergeExample() {
    AvlIntervalTree tree;
    for (int64_t x : {1, 2, 3, 5, 6, 7, 8}) {
        tree.insert(x);
    }
    auto before = tree.getIntervals();
    require(before.size() == 2, "Before 4, expected [1,3] and [5,8]");
    auto r4 = tree.insert(4);
    require(r4.mutationType == MutationType::MERGED, "4 must trigger MERGED");
    require(r4.mergedFrom.size() == 2, "mergedFrom should contain [1,3] and [5,8]");
    require(r4.targetInterval.start == 1 && r4.targetInterval.end == 8, "Merged target should be [1,8]");

    auto after = tree.getIntervals();
    require(after.size() == 1 && after[0].start == 1 && after[0].end == 8, "After 4, expected [1,8]");
    assertTreeValid(tree, "Bridge merge [1,3] + 4 + [5,8]");
}

void testExtensionsAndDuplicates() {
    AvlIntervalTree tree;
    tree.insert(10);
    auto rLeft = tree.insert(9);
    require(rLeft.mutationType == MutationType::EXTENDED, "Left extension failed");
    require(rLeft.targetInterval.start == 9 && rLeft.targetInterval.end == 10, "Expected [9,10]");

    auto rRight = tree.insert(11);
    require(rRight.mutationType == MutationType::EXTENDED, "Right extension failed");
    require(rRight.targetInterval.start == 9 && rRight.targetInterval.end == 11, "Expected [9,11]");

    auto d1 = tree.insert(10);
    auto d2 = tree.insert(9);
    auto d3 = tree.insert(11);
    require(d1.mutationType == MutationType::DUPLICATE, "10 should be DUPLICATE");
    require(d2.mutationType == MutationType::DUPLICATE, "9 should be DUPLICATE");
    require(d3.mutationType == MutationType::DUPLICATE, "11 should be DUPLICATE");

    auto metrics = tree.getMetrics();
    require(metrics.totalUniquePackages == 3, "Expected 3 unique packages");
    require(metrics.duplicateCount == 3, "Expected 3 duplicates");
    assertTreeValid(tree, "Extensions and duplicates");
}

void testAllFourRotations() {
    {
        AvlIntervalTree t;
        t.insert(30);
        t.insert(20);
        auto r = t.insert(10);
        require(r.primaryRotation == RotationType::LL, "Expected LL rotation on 30,20,10");
        require(r.preBalanceSnapshot.has_value(), "Expected preBalanceSnapshot for LL");
        auto snap = t.getSnapshot();
        require(snap.height == 2 && snap.nodeCount == 3, "Balanced LL tree height should be 2");
        assertTreeValid(t, "LL rotation");
    }

    {
        AvlIntervalTree t;
        t.insert(10);
        t.insert(20);
        auto r = t.insert(30);
        require(r.primaryRotation == RotationType::RR, "Expected RR rotation on 10,20,30");
        auto snap = t.getSnapshot();
        require(snap.height == 2 && snap.nodeCount == 3, "Balanced RR tree height should be 2");
        assertTreeValid(t, "RR rotation");
    }

    {
        AvlIntervalTree t;
        t.insert(30);
        t.insert(10);
        auto r = t.insert(20);
        require(r.primaryRotation == RotationType::LR, "Expected LR rotation on 30,10,20");
        require(!r.rotationSteps.empty() && r.rotationSteps[0].intermediateSnapshot.has_value(),
                "Expected intermediateSnapshot for LR double rotation");
        auto snap = t.getSnapshot();
        require(snap.height == 2 && snap.nodeCount == 3, "Balanced LR tree height should be 2");
        assertTreeValid(t, "LR rotation");
    }

    {
        AvlIntervalTree t;
        t.insert(10);
        t.insert(30);
        auto r = t.insert(20);
        require(r.primaryRotation == RotationType::RL, "Expected RL rotation on 10,30,20");
        require(!r.rotationSteps.empty() && r.rotationSteps[0].intermediateSnapshot.has_value(),
                "Expected intermediateSnapshot for RL double rotation");
        auto snap = t.getSnapshot();
        require(snap.height == 2 && snap.nodeCount == 3, "Balanced RL tree height should be 2");
        assertTreeValid(t, "RL rotation");
    }
}

void testMultipleIntervalMerge() {
    AvlIntervalTree t;
    for (int64_t x : {1, 3, 5, 7, 9}) {
        t.insert(x);
    }
    require(t.getIntervals().size() == 5, "Expected 5 isolated intervals");

    auto r = t.insertRange(2, 8);
    require(r.mutationType == MutationType::MERGED, "insertRange [2,8] should merge multiple intervals");
    auto ivs = t.getIntervals();
    require(ivs.size() == 1 && ivs[0].start == 1 && ivs[0].end == 9, "All 5 intervals should coalesce to [1,9]");
    require(t.getMetrics().totalUniquePackages == 9, "Unique packages should be 9");
    assertTreeValid(t, "Multiple interval merge");
}

void testBoundaryAndWidelySpacedIds() {
    AvlIntervalTree t;
    auto emptyGaps = t.findMissingRanges(1, 100);
    require(emptyGaps.missingCount == 100 && emptyGaps.missingIntervals.size() == 1, "Empty tree gap check failed");

    t.insert(MIN_PACKAGE_ID);
    t.insert(MAX_PACKAGE_ID);
    t.insert(500000000LL);

    require(t.contains(0), "Contains 0 failed");
    require(t.contains(1000000000LL), "Contains 10^9 failed");
    require(!t.contains(1), "Should not contain 1");

    auto pred = t.findPredecessor(500000000LL);
    auto succ = t.findSuccessor(500000000LL);
    require(pred.has_value() && pred->start == 0, "Predecessor of 5e8 should be [0,0]");
    require(succ.has_value() && succ->start == 1000000000LL, "Successor of 5e8 should be [1e9,1e9]");

    auto wideGaps = t.findMissingRanges(0, MAX_PACKAGE_ID);
    require(wideGaps.missingIntervals.size() == 2, "Expected 2 huge missing gaps across [0, 1e9]");
    require(wideGaps.presentCount == 3, "Present count should be 3");
    require(wideGaps.missingCount == (MAX_PACKAGE_ID + 1 - 3), "Missing count mismatch across 0..10^9");
    assertTreeValid(t, "Boundary 0 and 10^9");
}

void testScale50kAndSequential() {
    {
        AvlIntervalTree seq;
        for (int64_t i = 1; i <= 50000; ++i) {
            seq.insert(i, false);
        }
        auto m = seq.getMetrics();
        require(m.totalUniquePackages == 50000, "Seq 50k unique count mismatch");
        require(m.activeIntervals == 1, "Seq 50k should coalesce to 1 interval");
        assertTreeValid(seq, "Sequential 50k");
    }

    {
        AvlIntervalTree rndTree;
        std::vector<int64_t> ids;
        ids.reserve(50000);
        for (int64_t i = 0; i < 50000; ++i) {
            ids.push_back((i % 5 == 0) ? (i * 100LL) : (i * 2LL + 1));
        }
        std::mt19937_64 rng(42);
        std::shuffle(ids.begin(), ids.end(), rng);

        for (int64_t id : ids) {
            rndTree.insert(id, false);
        }
        for (int i = 0; i < 5000; ++i) {
            require(rndTree.contains(ids[static_cast<std::size_t>(i)]), "50k lookup failed");
        }

        auto m = rndTree.getMetrics();
        require(m.totalUniquePackages == 50000, "Random 50k unique count mismatch");
        require(m.rotationCount > 0, "Expected AVL rotations during 50k random arrivals");
        const double maxTheoreticalAvlHeight = 1.44 * std::log2(static_cast<double>(m.activeIntervals) + 2.0);
        require(static_cast<double>(m.avlHeight) <= maxTheoreticalAvlHeight + 1.0,
                "AVL height exceeded theoretical bound");
        assertTreeValid(rndTree, "Random 50k unique IDs");
        std::cout << "[INFO] 50k test -> intervals=" << m.activeIntervals
                  << ", height=" << m.avlHeight
                  << ", rotations=" << m.rotationCount
                  << ", avgInsertUs=" << m.avgInsertMicros
                  << ", avgLookupUs=" << m.avgLookupMicros << "\n";
    }
}

}  // namespace

int main() {
    testPromptWorkedExample();
    testBridgeMergeExample();
    testExtensionsAndDuplicates();
    testAllFourRotations();
    testMultipleIntervalMerge();
    testBoundaryAndWidelySpacedIds();
    testScale50kAndSequential();
    std::cout << "[PASS] All RangeX core AVL interval tree tests passed!\n";
    return 0;
}
