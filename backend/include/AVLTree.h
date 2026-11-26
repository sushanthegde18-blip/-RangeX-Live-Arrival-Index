#ifndef RANGEX_AVLTREE_H
#define RANGEX_AVLTREE_H

#include "Interval.h"
#include "Event.h"
#include <vector>
#include <string>
#include <memory>
#include <optional>
#include <functional>

namespace rangex {

/**
 * @brief Node in the custom AVL Tree.
 * Key is intervalStart.
 */
struct AVLNode {
    long long intervalStart;
    long long intervalEnd;
    int height;
    AVLNode* left;
    AVLNode* right;

    AVLNode(long long start, long long end)
        : intervalStart(start),
          intervalEnd(end),
          height(1),
          left(nullptr),
          right(nullptr) {}

    bool contains(long long packageId) const {
        return packageId >= intervalStart && packageId <= intervalEnd;
    }

    long long packageCount() const {
        return (intervalEnd >= intervalStart) ? (intervalEnd - intervalStart + 1) : 0;
    }
};

/**
 * @brief Custom AVL Tree maintaining sorted, non-overlapping consecutive package intervals.
 * 
 * Guarantees O(log n) search, insertion, and deletion.
 * Emits real-time algorithm events for tree visualization.
 */
class AVLTree {
public:
    AVLTree();
    ~AVLTree();

    // Disable copy to prevent accidental shallow copies of raw node pointers
    AVLTree(const AVLTree&) = delete;
    AVLTree& operator=(const AVLTree&) = delete;

    // Allow move semantics
    AVLTree(AVLTree&& other) noexcept;
    AVLTree& operator=(AVLTree&& other) noexcept;

    // --- Core Warehouse Arrival API ---
    /**
     * @brief Process an incoming package ID.
     * Automatically handles duplicates, extensions, and bridge merges.
     * @return true if new package added, false if duplicate ignored.
     */
    bool processPackageArrival(long long packageId);

    // --- Query API ---
    bool containsPackage(long long packageId) const;
    std::vector<Interval> getAllIntervals() const;
    std::vector<Interval> getMissingIntervals(long long queryStart, long long queryEnd) const;
    size_t getIntervalCount() const;
    long long getTotalPackageCount() const;
    bool isEmpty() const;
    void clear();

    // --- Visualization & Event API ---
    EventLogger& getLogger();
    const EventLogger& getLogger() const;
    void clearEvents();
    std::string getTreeSnapshotJson() const;

    // --- AVL Node-Level Operations (Exposed for Testing & Verification) ---
    AVLNode* getRoot() const;
    int getHeight(AVLNode* node) const;
    int getBalanceFactor(AVLNode* node) const;
    AVLNode* findMin(AVLNode* node) const;
    AVLNode* findMax(AVLNode* node) const;
    AVLNode* search(long long start) const;
    AVLNode* findPredecessor(long long packageId) const;
    AVLNode* findSuccessor(long long packageId) const;
    AVLNode* findIntervalContaining(long long packageId) const;

    // Manual tree modification methods (used by core algorithm and rotation tests)
    AVLNode* insertInterval(long long start, long long end);
    AVLNode* deleteInterval(long long start);

private:
    AVLNode* root;
    size_t nodeCount;
    long long totalPackages;
    EventLogger logger;

    // --- AVL Balancing Primitives ---
    void updateHeight(AVLNode* node);
    AVLNode* rotateLeft(AVLNode* x, long long currentPackageId = 0);
    AVLNode* rotateRight(AVLNode* y, long long currentPackageId = 0);
    AVLNode* rotateLeftRight(AVLNode* z, long long currentPackageId = 0);
    AVLNode* rotateRightLeft(AVLNode* z, long long currentPackageId = 0);
    AVLNode* balance(AVLNode* node, long long currentPackageId = 0);

    // --- Recursive AVL Insertion and Deletion ---
    AVLNode* insertRecursive(AVLNode* node, long long start, long long end, long long currentPackageId);
    AVLNode* deleteRecursive(AVLNode* node, long long start, long long currentPackageId);

    // --- Internal Helpers ---
    void destroyRecursive(AVLNode* node);
    void inOrderRecursive(AVLNode* node, std::vector<Interval>& result) const;
    void buildSnapshotJson(AVLNode* node, std::ostringstream& ss) const;
};

} // namespace rangex

#endif // RANGEX_AVLTREE_H
