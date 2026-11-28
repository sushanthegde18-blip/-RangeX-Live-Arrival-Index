#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace rangex {

constexpr int64_t MIN_PACKAGE_ID = 0;
constexpr int64_t MAX_PACKAGE_ID = 1000000000LL;

struct Interval {
    uint64_t nodeId = 0;
    int64_t start = 0;
    int64_t end = 0;
    std::string zone;
    int64_t packageCount() const noexcept { return end - start + 1; }
};

enum class MutationType {
    CREATED,
    EXTENDED,
    MERGED,
    DUPLICATE
};

enum class RotationType {
    NONE,
    LL,
    RR,
    LR,
    RL
};

struct AvlNodeSnapshot {
    uint64_t id = 0;
    int64_t start = 0;
    int64_t end = 0;
    int height = 0;
    int balanceFactor = 0;
    uint64_t leftId = 0;
    uint64_t rightId = 0;
    uint64_t parentId = 0;
    int depth = 0;
    std::string zone;
};

struct AvlTreeSnapshot {
    uint64_t rootId = 0;
    int height = 0;
    std::size_t nodeCount = 0;
    uint64_t revision = 0;
    std::vector<AvlNodeSnapshot> nodes;
};

struct RotationStep {
    RotationType type = RotationType::NONE;
    uint64_t pivotNodeId = 0;
    int pivotBalanceFactor = 0;
    std::vector<uint64_t> affectedNodeIds;
    std::string reason;
    std::optional<AvlTreeSnapshot> preRotationSnapshot;
    std::optional<AvlTreeSnapshot> intermediateSnapshot;
    std::optional<AvlTreeSnapshot> afterSnapshot;
};

struct OperationResult {
    int64_t packageId = 0;
    MutationType mutationType = MutationType::CREATED;
    Interval targetInterval;
    std::vector<Interval> previousIntervals;
    std::vector<Interval> intervalsAfter;
    std::vector<Interval> mergedFrom;
    std::vector<uint64_t> searchPath;
    std::vector<uint64_t> highlightedNodeIds;
    RotationType primaryRotation = RotationType::NONE;
    uint64_t primaryPivotNodeId = 0;
    std::vector<uint64_t> primaryAffectedNodeIds;
    std::string rotationReason;
    std::vector<RotationStep> rotationSteps;
    std::optional<AvlTreeSnapshot> beforeSnapshot;
    std::optional<AvlTreeSnapshot> preBalanceSnapshot;
    std::optional<AvlTreeSnapshot> finalSnapshot;
    double elapsedMicros = 0.0;
};

struct MissingRange {
    int64_t start = 0;
    int64_t end = 0;
    int64_t count() const noexcept { return end - start + 1; }
};

struct GapsResult {
    int64_t queryStart = 0;
    int64_t queryEnd = 0;
    int64_t missingCount = 0;
    int64_t presentCount = 0;
    std::vector<MissingRange> missingIntervals;
};

struct TreeMetrics {
    int64_t totalUniquePackages = 0;
    std::size_t activeIntervals = 0;
    int64_t missingInActiveSpan = 0;
    int avlHeight = 0;
    int64_t duplicateCount = 0;
    int64_t createdCount = 0;
    int64_t extendedCount = 0;
    int64_t mergedCount = 0;
    int64_t rotationCount = 0;
    int64_t llRotationCount = 0;
    int64_t rrRotationCount = 0;
    int64_t lrRotationCount = 0;
    int64_t rlRotationCount = 0;
    double avgInsertMicros = 0.0;
    double avgLookupMicros = 0.0;
    double compressionRatio = 1.0;
    std::optional<int64_t> minId;
    std::optional<int64_t> maxId;
    std::optional<int64_t> latestPackageId;
    uint64_t revision = 0;
};

struct InvariantReport {
    bool valid = true;
    std::string errorMessage;
};

class AvlIntervalTree {
public:
    AvlIntervalTree() = default;
    ~AvlIntervalTree();

    AvlIntervalTree(const AvlIntervalTree&) = delete;
    AvlIntervalTree& operator=(const AvlIntervalTree&) = delete;
    AvlIntervalTree(AvlIntervalTree&& other) noexcept;
    AvlIntervalTree& operator=(AvlIntervalTree&& other) noexcept;

    void clear() noexcept;

    OperationResult insert(int64_t packageId, bool captureTrace = true);
    OperationResult insertRange(int64_t rangeStart, int64_t rangeEnd, bool captureTrace = true);

    bool contains(
        int64_t packageId,
        std::vector<uint64_t>* outSearchPath = nullptr,
        Interval* outInterval = nullptr
    ) const;

    std::optional<Interval> findPredecessor(int64_t packageId) const;
    std::optional<Interval> findSuccessor(int64_t packageId) const;

    std::vector<Interval> getIntervals(std::size_t offset = 0, std::size_t limit = 0) const;
    GapsResult findMissingRanges(int64_t queryStart, int64_t queryEnd) const;
    AvlTreeSnapshot getSnapshot(std::size_t maxNodes = 0) const;
    TreeMetrics getMetrics() const;
    InvariantReport verifyInvariants() const;

    static const char* toString(MutationType t) noexcept;
    static const char* toString(RotationType r) noexcept;

private:
    struct Node {
        uint64_t id = 0;
        int64_t start = 0;
        int64_t end = 0;
        int height = 1;
        Node* left = nullptr;
        Node* right = nullptr;
    };

    struct TraceContext {
        bool captureSnapshots = false;
        std::vector<RotationStep>* rotationSteps = nullptr;
        std::optional<AvlTreeSnapshot>* preBalanceSnapshot = nullptr;
    };

    Node* root_ = nullptr;
    uint64_t nextNodeId_ = 1;
    uint64_t revision_ = 0;

    std::size_t nodeCount_ = 0;
    int64_t totalUniquePackages_ = 0;
    int64_t duplicateCount_ = 0;
    int64_t createdCount_ = 0;
    int64_t extendedCount_ = 0;
    int64_t mergedCount_ = 0;
    int64_t rotationCount_ = 0;
    int64_t llRotationCount_ = 0;
    int64_t rrRotationCount_ = 0;
    int64_t lrRotationCount_ = 0;
    int64_t rlRotationCount_ = 0;

    mutable double totalLookupMicros_ = 0.0;
    mutable int64_t lookupOps_ = 0;
    double totalInsertMicros_ = 0.0;
    int64_t insertOps_ = 0;

    std::optional<int64_t> minId_;
    std::optional<int64_t> maxId_;
    std::optional<int64_t> latestPackageId_;

    static void destroySubtree(Node* node) noexcept;
    static int nodeHeight(const Node* node) noexcept;
    static int balanceFactor(const Node* node) noexcept;
    static void updateHeight(Node* node) noexcept;
    static std::string assignZone(uint64_t nodeId);
    static Interval toInterval(const Node* node);

    Node* rotateLeft(Node* x) noexcept;
    Node* rotateRight(Node* y) noexcept;

    void rebalanceNode(Node*& node, TraceContext& trace);
    void insertNewNodeRec(Node*& node, uint64_t newId, int64_t start, int64_t end, TraceContext& trace);
    void removeByStartRec(Node*& node, int64_t targetStart, TraceContext& trace);
    void removeMinNodeRec(Node*& node, Node*& extractedMin, TraceContext& trace);

    void inorderCollect(const Node* node, std::vector<Interval>& out) const;
    void collectIntersecting(const Node* node, int64_t qStart, int64_t qEnd, std::vector<Interval>& out) const;
    void findGapsRec(const Node* node, int64_t qStart, int64_t qEnd, int64_t& cursor, GapsResult& res) const;
    AvlTreeSnapshot buildSnapshot(std::size_t maxNodes = 0) const;

    void verifyNodeInvariant(
        const Node* node,
        std::optional<int64_t>& prevEnd,
        std::size_t& visitedCount,
        InvariantReport& report
    ) const;
};

}  // namespace rangex
