#include "rangex/avl_interval_tree.hpp"

#include <algorithm>
#include <chrono>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace rangex {

namespace {
constexpr std::size_t TRACE_SNAPSHOT_NODE_LIMIT = 250;
const char* BAY_ZONES[6] = {"BAY-A1", "BAY-A2", "BAY-A3", "BAY-B1", "BAY-B2", "BAY-B3"};
}  // namespace

AvlIntervalTree::~AvlIntervalTree() {
    clear();
}

AvlIntervalTree::AvlIntervalTree(AvlIntervalTree&& other) noexcept
    : root_(other.root_),
      nextNodeId_(other.nextNodeId_),
      revision_(other.revision_),
      nodeCount_(other.nodeCount_),
      totalUniquePackages_(other.totalUniquePackages_),
      duplicateCount_(other.duplicateCount_),
      createdCount_(other.createdCount_),
      extendedCount_(other.extendedCount_),
      mergedCount_(other.mergedCount_),
      rotationCount_(other.rotationCount_),
      llRotationCount_(other.llRotationCount_),
      rrRotationCount_(other.rrRotationCount_),
      lrRotationCount_(other.lrRotationCount_),
      rlRotationCount_(other.rlRotationCount_),
      totalLookupMicros_(other.totalLookupMicros_),
      lookupOps_(other.lookupOps_),
      totalInsertMicros_(other.totalInsertMicros_),
      insertOps_(other.insertOps_),
      minId_(other.minId_),
      maxId_(other.maxId_),
      latestPackageId_(other.latestPackageId_) {
    other.root_ = nullptr;
    other.nodeCount_ = 0;
}

AvlIntervalTree& AvlIntervalTree::operator=(AvlIntervalTree&& other) noexcept {
    if (this != &other) {
        clear();
        root_ = other.root_;
        nextNodeId_ = other.nextNodeId_;
        revision_ = other.revision_;
        nodeCount_ = other.nodeCount_;
        totalUniquePackages_ = other.totalUniquePackages_;
        duplicateCount_ = other.duplicateCount_;
        createdCount_ = other.createdCount_;
        extendedCount_ = other.extendedCount_;
        mergedCount_ = other.mergedCount_;
        rotationCount_ = other.rotationCount_;
        llRotationCount_ = other.llRotationCount_;
        rrRotationCount_ = other.rrRotationCount_;
        lrRotationCount_ = other.lrRotationCount_;
        rlRotationCount_ = other.rlRotationCount_;
        totalLookupMicros_ = other.totalLookupMicros_;
        lookupOps_ = other.lookupOps_;
        totalInsertMicros_ = other.totalInsertMicros_;
        insertOps_ = other.insertOps_;
        minId_ = other.minId_;
        maxId_ = other.maxId_;
        latestPackageId_ = other.latestPackageId_;

        other.root_ = nullptr;
        other.nodeCount_ = 0;
    }
    return *this;
}

void AvlIntervalTree::destroySubtree(Node* node) noexcept {
    if (!node) return;
    destroySubtree(node->left);
    destroySubtree(node->right);
    delete node;
}

void AvlIntervalTree::clear() noexcept {
    destroySubtree(root_);
    root_ = nullptr;
    nextNodeId_ = 1;
    revision_ = 0;
    nodeCount_ = 0;
    totalUniquePackages_ = 0;
    duplicateCount_ = 0;
    createdCount_ = 0;
    extendedCount_ = 0;
    mergedCount_ = 0;
    rotationCount_ = 0;
    llRotationCount_ = 0;
    rrRotationCount_ = 0;
    lrRotationCount_ = 0;
    rlRotationCount_ = 0;
    totalLookupMicros_ = 0.0;
    lookupOps_ = 0;
    totalInsertMicros_ = 0.0;
    insertOps_ = 0;
    minId_.reset();
    maxId_.reset();
    latestPackageId_.reset();
}

int AvlIntervalTree::nodeHeight(const Node* node) noexcept {
    return node ? node->height : 0;
}

int AvlIntervalTree::balanceFactor(const Node* node) noexcept {
    if (!node) return 0;
    return nodeHeight(node->left) - nodeHeight(node->right);
}

void AvlIntervalTree::updateHeight(Node* node) noexcept {
    if (!node) return;
    node->height = 1 + std::max(nodeHeight(node->left), nodeHeight(node->right));
}

std::string AvlIntervalTree::assignZone(uint64_t nodeId) {
    return BAY_ZONES[(nodeId > 0 ? (nodeId - 1) : 0) % 6];
}

Interval AvlIntervalTree::toInterval(const Node* node) {
    return Interval{
        node->id,
        node->start,
        node->end,
        assignZone(node->id),
    };
}

AvlIntervalTree::Node* AvlIntervalTree::rotateLeft(Node* x) noexcept {
    Node* y = x->right;
    Node* t2 = y->left;

    y->left = x;
    x->right = t2;

    updateHeight(x);
    updateHeight(y);
    return y;
}

AvlIntervalTree::Node* AvlIntervalTree::rotateRight(Node* y) noexcept {
    Node* x = y->left;
    Node* t2 = x->right;

    x->right = y;
    y->left = t2;

    updateHeight(y);
    updateHeight(x);
    return x;
}

void AvlIntervalTree::rebalanceNode(Node*& node, TraceContext& trace) {
    if (!node) return;
    updateHeight(node);
    const int bf = balanceFactor(node);

    if (bf > 1) {
        if (trace.captureSnapshots && trace.preBalanceSnapshot && !trace.preBalanceSnapshot->has_value()) {
            *trace.preBalanceSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        }
        const int leftBf = balanceFactor(node->left);
        if (leftBf >= 0) {
            RotationStep step;
            step.type = RotationType::LL;
            step.pivotNodeId = node->id;
            step.pivotBalanceFactor = bf;
            step.affectedNodeIds.push_back(node->id);
            if (node->left) {
                step.affectedNodeIds.push_back(node->left->id);
                if (node->left->left) {
                    step.affectedNodeIds.push_back(node->left->left->id);
                }
            }
            step.reason = "Left-heavy imbalance (BF=" + std::to_string(bf) + ") resolved via LL right rotation";
            if (trace.captureSnapshots) {
                step.preRotationSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }

            node = rotateRight(node);
            ++rotationCount_;
            ++llRotationCount_;

            if (trace.captureSnapshots) {
                step.afterSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            if (trace.rotationSteps) {
                trace.rotationSteps->push_back(std::move(step));
            }
        } else {
            RotationStep step;
            step.type = RotationType::LR;
            step.pivotNodeId = node->id;
            step.pivotBalanceFactor = bf;
            step.affectedNodeIds.push_back(node->id);
            if (node->left) {
                step.affectedNodeIds.push_back(node->left->id);
                if (node->left->right) {
                    step.affectedNodeIds.push_back(node->left->right->id);
                }
            }
            step.reason = "Left-Right imbalance (BF=" + std::to_string(bf) + ") resolved via LR double rotation";
            if (trace.captureSnapshots) {
                step.preRotationSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }

            node->left = rotateLeft(node->left);
            if (trace.captureSnapshots) {
                step.intermediateSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            node = rotateRight(node);
            ++rotationCount_;
            ++lrRotationCount_;

            if (trace.captureSnapshots) {
                step.afterSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            if (trace.rotationSteps) {
                trace.rotationSteps->push_back(std::move(step));
            }
        }
    } else if (bf < -1) {
        if (trace.captureSnapshots && trace.preBalanceSnapshot && !trace.preBalanceSnapshot->has_value()) {
            *trace.preBalanceSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        }
        const int rightBf = balanceFactor(node->right);
        if (rightBf <= 0) {
            RotationStep step;
            step.type = RotationType::RR;
            step.pivotNodeId = node->id;
            step.pivotBalanceFactor = bf;
            step.affectedNodeIds.push_back(node->id);
            if (node->right) {
                step.affectedNodeIds.push_back(node->right->id);
                if (node->right->right) {
                    step.affectedNodeIds.push_back(node->right->right->id);
                }
            }
            step.reason = "Right-heavy imbalance (BF=" + std::to_string(bf) + ") resolved via RR left rotation";
            if (trace.captureSnapshots) {
                step.preRotationSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }

            node = rotateLeft(node);
            ++rotationCount_;
            ++rrRotationCount_;

            if (trace.captureSnapshots) {
                step.afterSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            if (trace.rotationSteps) {
                trace.rotationSteps->push_back(std::move(step));
            }
        } else {
            RotationStep step;
            step.type = RotationType::RL;
            step.pivotNodeId = node->id;
            step.pivotBalanceFactor = bf;
            step.affectedNodeIds.push_back(node->id);
            if (node->right) {
                step.affectedNodeIds.push_back(node->right->id);
                if (node->right->left) {
                    step.affectedNodeIds.push_back(node->right->left->id);
                }
            }
            step.reason = "Right-Left imbalance (BF=" + std::to_string(bf) + ") resolved via RL double rotation";
            if (trace.captureSnapshots) {
                step.preRotationSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }

            node->right = rotateRight(node->right);
            if (trace.captureSnapshots) {
                step.intermediateSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            node = rotateLeft(node);
            ++rotationCount_;
            ++rlRotationCount_;

            if (trace.captureSnapshots) {
                step.afterSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
            if (trace.rotationSteps) {
                trace.rotationSteps->push_back(std::move(step));
            }
        }
    }
}

void AvlIntervalTree::insertNewNodeRec(
    Node*& node,
    uint64_t newId,
    int64_t start,
    int64_t end,
    TraceContext& trace
) {
    if (!node) {
        node = new Node{newId, start, end, 1, nullptr, nullptr};
        ++nodeCount_;
        return;
    }
    if (start < node->start) {
        insertNewNodeRec(node->left, newId, start, end, trace);
    } else {
        insertNewNodeRec(node->right, newId, start, end, trace);
    }
    rebalanceNode(node, trace);
}

void AvlIntervalTree::removeMinNodeRec(Node*& node, Node*& extractedMin, TraceContext& trace) {
    if (!node) return;
    if (!node->left) {
        extractedMin = node;
        node = node->right;
        --nodeCount_;
        return;
    }
    removeMinNodeRec(node->left, extractedMin, trace);
    rebalanceNode(node, trace);
}

void AvlIntervalTree::removeByStartRec(Node*& node, int64_t targetStart, TraceContext& trace) {
    if (!node) return;

    if (targetStart < node->start) {
        removeByStartRec(node->left, targetStart, trace);
    } else if (targetStart > node->start) {
        removeByStartRec(node->right, targetStart, trace);
    } else {
        if (!node->left || !node->right) {
            Node* child = node->left ? node->left : node->right;
            delete node;
            node = child;
            --nodeCount_;
            return;
        }
        Node* successor = node->right;
        while (successor->left) {
            successor = successor->left;
        }
        node->id = successor->id;
        node->start = successor->start;
        node->end = successor->end;

        Node* dummyRemoved = nullptr;
        removeMinNodeRec(node->right, dummyRemoved, trace);
        delete dummyRemoved;
    }

    rebalanceNode(node, trace);
}

OperationResult AvlIntervalTree::insert(int64_t packageId, bool captureTrace) {
    const auto t0 = std::chrono::steady_clock::now();

    OperationResult result;
    result.packageId = packageId;

    const bool detailedTrace = captureTrace && (nodeCount_ <= TRACE_SNAPSHOT_NODE_LIMIT);
    if (detailedTrace) {
        result.beforeSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        result.previousIntervals = getIntervals();
    }

    Node* cur = root_;
    Node* pred = nullptr;
    Node* succ = nullptr;
    Node* containing = nullptr;

    while (cur) {
        result.searchPath.push_back(cur->id);
        if (packageId >= cur->start && packageId <= cur->end) {
            containing = cur;
            break;
        }
        if (packageId < cur->start) {
            succ = cur;
            cur = cur->left;
        } else {
            pred = cur;
            cur = cur->right;
        }
    }

    if (containing) {
        ++duplicateCount_;
        ++revision_;
        latestPackageId_ = packageId;

        result.mutationType = MutationType::DUPLICATE;
        result.targetInterval = toInterval(containing);
        result.highlightedNodeIds.push_back(containing->id);
    } else {
        const bool touchesLeft = (pred != nullptr && pred->end + 1 == packageId);
        const bool touchesRight = (succ != nullptr && packageId + 1 == succ->start);

        if (!minId_.has_value() || packageId < *minId_) minId_ = packageId;
        if (!maxId_.has_value() || packageId > *maxId_) maxId_ = packageId;
        latestPackageId_ = packageId;
        ++totalUniquePackages_;
        ++revision_;

        TraceContext trace;
        trace.captureSnapshots = detailedTrace;
        trace.rotationSteps = &result.rotationSteps;
        trace.preBalanceSnapshot = &result.preBalanceSnapshot;

        if (!touchesLeft && !touchesRight) {
            const uint64_t newId = nextNodeId_++;
            insertNewNodeRec(root_, newId, packageId, packageId, trace);
            ++createdCount_;

            result.mutationType = MutationType::CREATED;
            result.targetInterval = Interval{newId, packageId, packageId, assignZone(newId)};
            result.highlightedNodeIds.push_back(newId);
            if (!result.preBalanceSnapshot.has_value() && detailedTrace) {
                result.preBalanceSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
        } else if (touchesLeft && !touchesRight) {
            if (!detailedTrace && captureTrace) {
                result.previousIntervals.push_back(toInterval(pred));
            }
            pred->end = packageId;
            ++extendedCount_;

            result.mutationType = MutationType::EXTENDED;
            result.targetInterval = toInterval(pred);
            result.highlightedNodeIds.push_back(pred->id);
        } else if (!touchesLeft && touchesRight) {
            if (!detailedTrace && captureTrace) {
                result.previousIntervals.push_back(toInterval(succ));
            }
            succ->start = packageId;
            ++extendedCount_;

            result.mutationType = MutationType::EXTENDED;
            result.targetInterval = toInterval(succ);
            result.highlightedNodeIds.push_back(succ->id);
        } else {
            const Interval predBefore = toInterval(pred);
            const Interval succBefore = toInterval(succ);
            result.mergedFrom.push_back(predBefore);
            result.mergedFrom.push_back(succBefore);
            if (!detailedTrace && captureTrace) {
                result.previousIntervals.push_back(predBefore);
                result.previousIntervals.push_back(succBefore);
            }

            const uint64_t survivingId = pred->id;
            const int64_t succStartToRemove = succ->start;
            pred->end = succ->end;
            removeByStartRec(root_, succStartToRemove, trace);
            ++mergedCount_;

            result.mutationType = MutationType::MERGED;
            result.targetInterval = Interval{survivingId, predBefore.start, succBefore.end, assignZone(survivingId)};
            result.highlightedNodeIds.push_back(survivingId);
            if (!result.preBalanceSnapshot.has_value() && detailedTrace) {
                result.preBalanceSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
            }
        }
    }

    if (!result.rotationSteps.empty()) {
        const auto& firstStep = result.rotationSteps.front();
        result.primaryRotation = firstStep.type;
        result.primaryPivotNodeId = firstStep.pivotNodeId;
        result.primaryAffectedNodeIds = firstStep.affectedNodeIds;
        result.rotationReason = firstStep.reason;
    }

    if (captureTrace) {
        if (nodeCount_ <= TRACE_SNAPSHOT_NODE_LIMIT) {
            result.intervalsAfter = getIntervals();
            result.finalSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        } else {
            result.intervalsAfter.push_back(result.targetInterval);
            result.finalSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        }
    }

    const auto t1 = std::chrono::steady_clock::now();
    const double micros = std::chrono::duration<double, std::micro>(t1 - t0).count();
    totalInsertMicros_ += micros;
    ++insertOps_;
    result.elapsedMicros = micros;
    return result;
}

void AvlIntervalTree::collectIntersecting(
    const Node* node,
    int64_t qStart,
    int64_t qEnd,
    std::vector<Interval>& out
) const {
    if (!node) return;
    if (node->start > qStart && node->left) {
        collectIntersecting(node->left, qStart, qEnd, out);
    }
    if (node->end >= qStart && node->start <= qEnd) {
        out.push_back(toInterval(node));
    }
    if (node->end < qEnd && node->right) {
        collectIntersecting(node->right, qStart, qEnd, out);
    }
}

OperationResult AvlIntervalTree::insertRange(int64_t rangeStart, int64_t rangeEnd, bool captureTrace) {
    if (rangeStart > rangeEnd) {
        throw std::invalid_argument("rangeStart must be <= rangeEnd");
    }
    if (rangeStart == rangeEnd) {
        return insert(rangeStart, captureTrace);
    }

    const auto t0 = std::chrono::steady_clock::now();
    OperationResult result;
    result.packageId = rangeStart;
    const bool detailedTrace = captureTrace && (nodeCount_ <= TRACE_SNAPSHOT_NODE_LIMIT);
    if (detailedTrace) {
        result.beforeSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        result.previousIntervals = getIntervals();
    }

    std::vector<Interval> touched;
    collectIntersecting(root_, rangeStart - 1, rangeEnd + 1, touched);

    int64_t overlapCount = 0;
    for (const auto& iv : touched) {
        const int64_t os = std::max(rangeStart, iv.start);
        const int64_t oe = std::min(rangeEnd, iv.end);
        if (os <= oe) {
            overlapCount += (oe - os + 1);
        }
    }

    const int64_t rangeLen = rangeEnd - rangeStart + 1;
    const int64_t addedUnique = rangeLen - overlapCount;
    totalUniquePackages_ += addedUnique;
    if (overlapCount > 0) {
        duplicateCount_ += overlapCount;
    }
    if (!minId_.has_value() || rangeStart < *minId_) minId_ = rangeStart;
    if (!maxId_.has_value() || rangeEnd > *maxId_) maxId_ = rangeEnd;
    latestPackageId_ = rangeEnd;
    ++revision_;

    TraceContext trace;
    trace.captureSnapshots = detailedTrace;
    trace.rotationSteps = &result.rotationSteps;
    trace.preBalanceSnapshot = &result.preBalanceSnapshot;

    if (addedUnique == 0 && touched.size() == 1) {
        result.mutationType = MutationType::DUPLICATE;
        result.targetInterval = touched.front();
        result.highlightedNodeIds.push_back(touched.front().nodeId);
    } else if (touched.empty()) {
        const uint64_t newId = nextNodeId_++;
        insertNewNodeRec(root_, newId, rangeStart, rangeEnd, trace);
        ++createdCount_;
        result.mutationType = MutationType::CREATED;
        result.targetInterval = Interval{newId, rangeStart, rangeEnd, assignZone(newId)};
        result.highlightedNodeIds.push_back(newId);
    } else {
        const int64_t mergedStart = std::min(rangeStart, touched.front().start);
        const int64_t mergedEnd = std::max(rangeEnd, touched.back().end);

        if (touched.size() == 1) {
            Node* cur = root_;
            while (cur) {
                result.searchPath.push_back(cur->id);
                if (cur->start == touched.front().start) {
                    cur->start = mergedStart;
                    cur->end = mergedEnd;
                    result.targetInterval = toInterval(cur);
                    result.highlightedNodeIds.push_back(cur->id);
                    break;
                }
                cur = (touched.front().start < cur->start) ? cur->left : cur->right;
            }
            ++extendedCount_;
            result.mutationType = MutationType::EXTENDED;
        } else {
            result.mergedFrom = touched;
            const int64_t survivorOldStart = touched.front().start;
            for (std::size_t i = 1; i < touched.size(); ++i) {
                removeByStartRec(root_, touched[i].start, trace);
            }
            Node* cur = root_;
            while (cur) {
                result.searchPath.push_back(cur->id);
                if (cur->start == survivorOldStart) {
                    cur->start = mergedStart;
                    cur->end = mergedEnd;
                    result.targetInterval = toInterval(cur);
                    result.highlightedNodeIds.push_back(cur->id);
                    break;
                }
                cur = (survivorOldStart < cur->start) ? cur->left : cur->right;
            }
            ++mergedCount_;
            result.mutationType = MutationType::MERGED;
        }
    }

    if (!result.rotationSteps.empty()) {
        const auto& firstStep = result.rotationSteps.front();
        result.primaryRotation = firstStep.type;
        result.primaryPivotNodeId = firstStep.pivotNodeId;
        result.primaryAffectedNodeIds = firstStep.affectedNodeIds;
        result.rotationReason = firstStep.reason;
    }

    if (captureTrace) {
        if (nodeCount_ <= TRACE_SNAPSHOT_NODE_LIMIT) {
            result.intervalsAfter = getIntervals();
            result.finalSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        } else {
            result.intervalsAfter.push_back(result.targetInterval);
            result.finalSnapshot = buildSnapshot(TRACE_SNAPSHOT_NODE_LIMIT);
        }
    }

    const auto t1 = std::chrono::steady_clock::now();
    const double micros = std::chrono::duration<double, std::micro>(t1 - t0).count();
    totalInsertMicros_ += micros;
    ++insertOps_;
    result.elapsedMicros = micros;
    return result;
}

bool AvlIntervalTree::contains(
    int64_t packageId,
    std::vector<uint64_t>* outSearchPath,
    Interval* outInterval
) const {
    const auto t0 = std::chrono::steady_clock::now();
    bool found = false;
    const Node* cur = root_;
    while (cur) {
        if (outSearchPath) outSearchPath->push_back(cur->id);
        if (packageId >= cur->start && packageId <= cur->end) {
            found = true;
            if (outInterval) *outInterval = toInterval(cur);
            break;
        }
        cur = (packageId < cur->start) ? cur->left : cur->right;
    }
    const auto t1 = std::chrono::steady_clock::now();
    totalLookupMicros_ += std::chrono::duration<double, std::micro>(t1 - t0).count();
    ++lookupOps_;
    return found;
}

std::optional<Interval> AvlIntervalTree::findPredecessor(int64_t packageId) const {
    const Node* cur = root_;
    const Node* pred = nullptr;
    while (cur) {
        if (cur->end < packageId) {
            pred = cur;
            cur = cur->right;
        } else if (packageId >= cur->start && packageId <= cur->end) {
            if (cur->left) {
                const Node* p = cur->left;
                while (p->right) p = p->right;
                return toInterval(p);
            }
            break;
        } else {
            cur = cur->left;
        }
    }
    if (pred) return toInterval(pred);
    return std::nullopt;
}

std::optional<Interval> AvlIntervalTree::findSuccessor(int64_t packageId) const {
    const Node* cur = root_;
    const Node* succ = nullptr;
    while (cur) {
        if (cur->start > packageId) {
            succ = cur;
            cur = cur->left;
        } else if (packageId >= cur->start && packageId <= cur->end) {
            if (cur->right) {
                const Node* s = cur->right;
                while (s->left) s = s->left;
                return toInterval(s);
            }
            break;
        } else {
            cur = cur->right;
        }
    }
    if (succ) return toInterval(succ);
    return std::nullopt;
}

void AvlIntervalTree::inorderCollect(const Node* node, std::vector<Interval>& out) const {
    if (!node) return;
    inorderCollect(node->left, out);
    out.push_back(toInterval(node));
    inorderCollect(node->right, out);
}

std::vector<Interval> AvlIntervalTree::getIntervals(std::size_t offset, std::size_t limit) const {
    std::vector<Interval> all;
    all.reserve(nodeCount_);
    inorderCollect(root_, all);

    if (offset >= all.size() && offset > 0) {
        return {};
    }
    if (offset == 0 && limit == 0) {
        return all;
    }
    const std::size_t endIdx = (limit == 0) ? all.size() : std::min(all.size(), offset + limit);
    return std::vector<Interval>(all.begin() + static_cast<std::ptrdiff_t>(offset),
                                 all.begin() + static_cast<std::ptrdiff_t>(endIdx));
}

void AvlIntervalTree::findGapsRec(
    const Node* node,
    int64_t qStart,
    int64_t qEnd,
    int64_t& cursor,
    GapsResult& res
) const {
    if (!node || cursor > qEnd) return;

    if (node->start > cursor && node->left) {
        findGapsRec(node->left, qStart, qEnd, cursor, res);
    }

    if (cursor <= qEnd && node->end >= cursor && node->start <= qEnd) {
        if (node->start > cursor) {
            const int64_t gapEnd = std::min(qEnd, node->start - 1);
            if (cursor <= gapEnd) {
                res.missingIntervals.push_back(MissingRange{cursor, gapEnd});
                res.missingCount += (gapEnd - cursor + 1);
            }
        }
        const int64_t coveredStart = std::max(cursor, node->start);
        const int64_t coveredEnd = std::min(qEnd, node->end);
        if (coveredStart <= coveredEnd) {
            res.presentCount += (coveredEnd - coveredStart + 1);
        }
        if (node->end >= qEnd) {
            cursor = qEnd + 1;
            return;
        }
        cursor = node->end + 1;
    }

    if (cursor <= qEnd && node->right) {
        findGapsRec(node->right, qStart, qEnd, cursor, res);
    }
}

GapsResult AvlIntervalTree::findMissingRanges(int64_t queryStart, int64_t queryEnd) const {
    GapsResult res;
    res.queryStart = queryStart;
    res.queryEnd = queryEnd;

    if (queryStart > queryEnd) {
        return res;
    }

    int64_t cursor = queryStart;
    findGapsRec(root_, queryStart, queryEnd, cursor, res);
    if (cursor <= queryEnd) {
        res.missingIntervals.push_back(MissingRange{cursor, queryEnd});
        res.missingCount += (queryEnd - cursor + 1);
    }
    return res;
}

AvlTreeSnapshot AvlIntervalTree::buildSnapshot(std::size_t maxNodes) const {
    AvlTreeSnapshot snap;
    snap.rootId = root_ ? root_->id : 0;
    snap.height = nodeHeight(root_);
    snap.nodeCount = nodeCount_;
    snap.revision = revision_;

    if (!root_) {
        return snap;
    }

    struct QueueEntry {
        const Node* node;
        uint64_t parentId;
        int depth;
    };

    std::queue<QueueEntry> q;
    q.push(QueueEntry{root_, 0, 0});

    while (!q.empty()) {
        if (maxNodes > 0 && snap.nodes.size() >= maxNodes) {
            break;
        }
        const auto item = q.front();
        q.pop();
        const Node* n = item.node;

        AvlNodeSnapshot ns;
        ns.id = n->id;
        ns.start = n->start;
        ns.end = n->end;
        ns.height = n->height;
        ns.balanceFactor = balanceFactor(n);
        ns.leftId = n->left ? n->left->id : 0;
        ns.rightId = n->right ? n->right->id : 0;
        ns.parentId = item.parentId;
        ns.depth = item.depth;
        ns.zone = assignZone(n->id);
        snap.nodes.push_back(std::move(ns));

        if (n->left) q.push(QueueEntry{n->left, n->id, item.depth + 1});
        if (n->right) q.push(QueueEntry{n->right, n->id, item.depth + 1});
    }

    return snap;
}

AvlTreeSnapshot AvlIntervalTree::getSnapshot(std::size_t maxNodes) const {
    return buildSnapshot(maxNodes);
}

TreeMetrics AvlIntervalTree::getMetrics() const {
    TreeMetrics m;
    m.totalUniquePackages = totalUniquePackages_;
    m.activeIntervals = nodeCount_;
    if (totalUniquePackages_ > 0 && minId_.has_value() && maxId_.has_value()) {
        m.missingInActiveSpan = (*maxId_ - *minId_ + 1) - totalUniquePackages_;
    } else {
        m.missingInActiveSpan = 0;
    }
    m.avlHeight = nodeHeight(root_);
    m.duplicateCount = duplicateCount_;
    m.createdCount = createdCount_;
    m.extendedCount = extendedCount_;
    m.mergedCount = mergedCount_;
    m.rotationCount = rotationCount_;
    m.llRotationCount = llRotationCount_;
    m.rrRotationCount = rrRotationCount_;
    m.lrRotationCount = lrRotationCount_;
    m.rlRotationCount = rlRotationCount_;
    m.avgInsertMicros = (insertOps_ > 0) ? (totalInsertMicros_ / static_cast<double>(insertOps_)) : 0.0;
    m.avgLookupMicros = (lookupOps_ > 0) ? (totalLookupMicros_ / static_cast<double>(lookupOps_)) : 0.0;
    m.compressionRatio = (nodeCount_ > 0)
                             ? (static_cast<double>(totalUniquePackages_) / static_cast<double>(nodeCount_))
                             : 1.0;
    m.minId = minId_;
    m.maxId = maxId_;
    m.latestPackageId = latestPackageId_;
    m.revision = revision_;
    return m;
}

void AvlIntervalTree::verifyNodeInvariant(
    const Node* node,
    std::optional<int64_t>& prevEnd,
    std::size_t& visitedCount,
    InvariantReport& report
) const {
    if (!node || !report.valid) return;

    verifyNodeInvariant(node->left, prevEnd, visitedCount, report);
    if (!report.valid) return;

    ++visitedCount;
    if (node->start > node->end) {
        report.valid = false;
        report.errorMessage = "Invalid interval bounds where start > end";
        return;
    }

    if (prevEnd.has_value()) {
        if (node->start <= *prevEnd) {
            report.valid = false;
            report.errorMessage = "Overlapping or unsorted intervals detected";
            return;
        }
        if (node->start == *prevEnd + 1) {
            report.valid = false;
            report.errorMessage = "Adjacent intervals failed to coalesce";
            return;
        }
    }
    prevEnd = node->end;

    const int expectedHeight = 1 + std::max(nodeHeight(node->left), nodeHeight(node->right));
    if (node->height != expectedHeight) {
        report.valid = false;
        report.errorMessage = "Height mismatch on node " + std::to_string(node->id);
        return;
    }

    const int bf = balanceFactor(node);
    if (bf < -1 || bf > 1) {
        report.valid = false;
        report.errorMessage = "AVL balance factor violation on node " + std::to_string(node->id);
        return;
    }

    verifyNodeInvariant(node->right, prevEnd, visitedCount, report);
}

InvariantReport AvlIntervalTree::verifyInvariants() const {
    InvariantReport report;
    std::optional<int64_t> prevEnd;
    std::size_t visited = 0;
    verifyNodeInvariant(root_, prevEnd, visited, report);
    if (report.valid && visited != nodeCount_) {
        report.valid = false;
        report.errorMessage = "nodeCount_ mismatch vs traversed nodes";
    }
    return report;
}

const char* AvlIntervalTree::toString(MutationType t) noexcept {
    switch (t) {
        case MutationType::CREATED:
            return "CREATED";
        case MutationType::EXTENDED:
            return "EXTENDED";
        case MutationType::MERGED:
            return "MERGED";
        case MutationType::DUPLICATE:
            return "DUPLICATE";
    }
    return "UNKNOWN";
}

const char* AvlIntervalTree::toString(RotationType r) noexcept {
    switch (r) {
        case RotationType::NONE:
            return "NONE";
        case RotationType::LL:
            return "LL";
        case RotationType::RR:
            return "RR";
        case RotationType::LR:
            return "LR";
        case RotationType::RL:
            return "RL";
    }
    return "NONE";
}

}  // namespace rangex
