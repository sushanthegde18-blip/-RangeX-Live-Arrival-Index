#include "AVLTree.h"
#include <algorithm>
#include <sstream>

namespace rangex {

AVLTree::AVLTree()
    : root(nullptr),
      nodeCount(0),
      totalPackages(0) {}

AVLTree::~AVLTree() {
    clear();
}

AVLTree::AVLTree(AVLTree&& other) noexcept
    : root(other.root),
      nodeCount(other.nodeCount),
      totalPackages(other.totalPackages),
      logger(std::move(other.logger)) {
    other.root = nullptr;
    other.nodeCount = 0;
    other.totalPackages = 0;
}

AVLTree& AVLTree::operator=(AVLTree&& other) noexcept {
    if (this != &other) {
        clear();
        root = other.root;
        nodeCount = other.nodeCount;
        totalPackages = other.totalPackages;
        logger = std::move(other.logger);

        other.root = nullptr;
        other.nodeCount = 0;
        other.totalPackages = 0;
    }
    return *this;
}

void AVLTree::destroyRecursive(AVLNode* node) {
    if (node) {
        destroyRecursive(node->left);
        destroyRecursive(node->right);
        delete node;
    }
}

void AVLTree::clear() {
    destroyRecursive(root);
    root = nullptr;
    nodeCount = 0;
    totalPackages = 0;
    logger.clear();
}

bool AVLTree::isEmpty() const {
    return root == nullptr;
}

size_t AVLTree::getIntervalCount() const {
    return nodeCount;
}

long long AVLTree::getTotalPackageCount() const {
    return totalPackages;
}

EventLogger& AVLTree::getLogger() {
    return logger;
}

const EventLogger& AVLTree::getLogger() const {
    return logger;
}

void AVLTree::clearEvents() {
    logger.clear();
}

AVLNode* AVLTree::getRoot() const {
    return root;
}

int AVLTree::getHeight(AVLNode* node) const {
    return node ? node->height : 0;
}

void AVLTree::updateHeight(AVLNode* node) {
    if (node) {
        node->height = 1 + std::max(getHeight(node->left), getHeight(node->right));
    }
}

int AVLTree::getBalanceFactor(AVLNode* node) const {
    return node ? (getHeight(node->left) - getHeight(node->right)) : 0;
}

AVLNode* AVLTree::rotateLeft(AVLNode* x, long long currentPackageId) {
    AVLNode* y = x->right;
    AVLNode* T2 = y->left;

    // Perform rotation
    y->left = x;
    x->right = T2;

    // Update heights
    updateHeight(x);
    updateHeight(y);

    logger.record({
        EventType::LEFT_ROTATION,
        currentPackageId,
        x->intervalStart,
        x->intervalEnd,
        "Left rotation on node [" + std::to_string(x->intervalStart) + ", " + std::to_string(x->intervalEnd) +
            "] with pivot [" + std::to_string(y->intervalStart) + ", " + std::to_string(y->intervalEnd) + "]",
        y->intervalStart,
        x->intervalStart,
        std::nullopt
    });

    return y;
}

AVLNode* AVLTree::rotateRight(AVLNode* y, long long currentPackageId) {
    AVLNode* x = y->left;
    AVLNode* T2 = x->right;

    // Perform rotation
    x->right = y;
    y->left = T2;

    // Update heights
    updateHeight(y);
    updateHeight(x);

    logger.record({
        EventType::RIGHT_ROTATION,
        currentPackageId,
        y->intervalStart,
        y->intervalEnd,
        "Right rotation on node [" + std::to_string(y->intervalStart) + ", " + std::to_string(y->intervalEnd) +
            "] with pivot [" + std::to_string(x->intervalStart) + ", " + std::to_string(x->intervalEnd) + "]",
        x->intervalStart,
        y->intervalStart,
        std::nullopt
    });

    return x;
}

AVLNode* AVLTree::rotateLeftRight(AVLNode* z, long long currentPackageId) {
    z->left = rotateLeft(z->left, currentPackageId);
    return rotateRight(z, currentPackageId);
}

AVLNode* AVLTree::rotateRightLeft(AVLNode* z, long long currentPackageId) {
    z->right = rotateRight(z->right, currentPackageId);
    return rotateLeft(z, currentPackageId);
}

AVLNode* AVLTree::balance(AVLNode* node, long long currentPackageId) {
    if (!node) return nullptr;

    updateHeight(node);
    int bf = getBalanceFactor(node);

    // Left heavy: BF > 1
    if (bf > 1) {
        if (getBalanceFactor(node->left) >= 0) {
            // LL Case -> Single Right Rotation
            return rotateRight(node, currentPackageId);
        } else {
            // LR Case -> Left-Right Double Rotation
            return rotateLeftRight(node, currentPackageId);
        }
    }

    // Right heavy: BF < -1
    if (bf < -1) {
        if (getBalanceFactor(node->right) <= 0) {
            // RR Case -> Single Left Rotation
            return rotateLeft(node, currentPackageId);
        } else {
            // RL Case -> Right-Left Double Rotation
            return rotateRightLeft(node, currentPackageId);
        }
    }

    return node;
}

AVLNode* AVLTree::insertRecursive(AVLNode* node, long long start, long long end, long long currentPackageId) {
    if (!node) {
        AVLNode* newNode = new AVLNode(start, end);
        logger.record({
            EventType::AVL_NODE_INSERTED,
            currentPackageId,
            start,
            end,
            "Inserted AVL node [" + std::to_string(start) + ", " + std::to_string(end) + "]"
        });
        return newNode;
    }

    if (start < node->intervalStart) {
        node->left = insertRecursive(node->left, start, end, currentPackageId);
    } else if (start > node->intervalStart) {
        node->right = insertRecursive(node->right, start, end, currentPackageId);
    } else {
        // Key already exists; update end boundary
        node->intervalEnd = end;
        return node;
    }

    return balance(node, currentPackageId);
}

AVLNode* AVLTree::deleteRecursive(AVLNode* node, long long start, long long currentPackageId) {
    if (!node) return nullptr;

    if (start < node->intervalStart) {
        node->left = deleteRecursive(node->left, start, currentPackageId);
    } else if (start > node->intervalStart) {
        node->right = deleteRecursive(node->right, start, currentPackageId);
    } else {
        // Node found
        logger.record({
            EventType::AVL_NODE_DELETED,
            currentPackageId,
            node->intervalStart,
            node->intervalEnd,
            "Deleted AVL node [" + std::to_string(node->intervalStart) + ", " + std::to_string(node->intervalEnd) + "]"
        });

        if (!node->left || !node->right) {
            AVLNode* temp = node->left ? node->left : node->right;
            if (!temp) {
                // No child
                delete node;
                node = nullptr;
            } else {
                // One child
                AVLNode* toDelete = node;
                node = temp;
                delete toDelete;
            }
        } else {
            // Node with two children: replace with in-order successor (min of right subtree)
            AVLNode* temp = findMin(node->right);
            node->intervalStart = temp->intervalStart;
            node->intervalEnd = temp->intervalEnd;
            node->right = deleteRecursive(node->right, temp->intervalStart, currentPackageId);
        }
    }

    if (!node) return nullptr;
    return balance(node, currentPackageId);
}

AVLNode* AVLTree::insertInterval(long long start, long long end) {
    root = insertRecursive(root, start, end, start);
    nodeCount++;
    totalPackages += (end >= start) ? (end - start + 1) : 0;
    return root;
}

AVLNode* AVLTree::deleteInterval(long long start) {
    AVLNode* existing = search(start);
    if (existing) {
        totalPackages -= existing->packageCount();
        nodeCount--;
        root = deleteRecursive(root, start, start);
    }
    return root;
}

AVLNode* AVLTree::findMin(AVLNode* node) const {
    if (!node) return nullptr;
    while (node->left) {
        node = node->left;
    }
    return node;
}

AVLNode* AVLTree::findMax(AVLNode* node) const {
    if (!node) return nullptr;
    while (node->right) {
        node = node->right;
    }
    return node;
}

AVLNode* AVLTree::search(long long start) const {
    AVLNode* curr = root;
    while (curr) {
        if (start < curr->intervalStart) {
            curr = curr->left;
        } else if (start > curr->intervalStart) {
            curr = curr->right;
        } else {
            return curr;
        }
    }
    return nullptr;
}

AVLNode* AVLTree::findPredecessor(long long packageId) const {
    AVLNode* curr = root;
    AVLNode* candidate = nullptr;

    while (curr) {
        if (curr->intervalStart <= packageId) {
            candidate = curr;
            curr = curr->right;
        } else {
            curr = curr->left;
        }
    }
    return candidate;
}

AVLNode* AVLTree::findSuccessor(long long packageId) const {
    AVLNode* curr = root;
    AVLNode* candidate = nullptr;

    while (curr) {
        if (curr->intervalStart > packageId) {
            candidate = curr;
            curr = curr->left;
        } else {
            curr = curr->right;
        }
    }
    return candidate;
}

AVLNode* AVLTree::findIntervalContaining(long long packageId) const {
    AVLNode* curr = root;

    while (curr) {
        // Record node visited event during search
        const_cast<EventLogger&>(logger).record({
            EventType::NODE_VISITED,
            packageId,
            curr->intervalStart,
            curr->intervalEnd,
            "Visited node [" + std::to_string(curr->intervalStart) + ", " + std::to_string(curr->intervalEnd) + "]"
        });

        if (packageId < curr->intervalStart) {
            curr = curr->left;
        } else if (packageId > curr->intervalEnd) {
            curr = curr->right;
        } else {
            return curr;
        }
    }
    return nullptr;
}

bool AVLTree::containsPackage(long long packageId) const {
    AVLNode* curr = root;
    while (curr) {
        if (packageId < curr->intervalStart) {
            curr = curr->left;
        } else if (packageId > curr->intervalEnd) {
            curr = curr->right;
        } else {
            return true;
        }
    }
    return false;
}

bool AVLTree::processPackageArrival(long long packageId) {
    logger.record({
        EventType::PACKAGE_RECEIVED,
        packageId,
        std::nullopt,
        std::nullopt,
        "Package ID " + std::to_string(packageId) + " received at warehouse"
    });

    logger.record({
        EventType::SEARCH_STARTED,
        packageId,
        std::nullopt,
        std::nullopt,
        "Searching for interval containing package " + std::to_string(packageId)
    });

    AVLNode* existing = findIntervalContaining(packageId);
    if (existing) {
        logger.record({
            EventType::INTERVAL_FOUND,
            packageId,
            existing->intervalStart,
            existing->intervalEnd,
            "Package ID " + std::to_string(packageId) + " is already present in interval [" +
                std::to_string(existing->intervalStart) + ", " + std::to_string(existing->intervalEnd) + "]"
        });
        logger.record({
            EventType::DUPLICATE_IGNORED,
            packageId,
            existing->intervalStart,
            existing->intervalEnd,
            "Duplicate package ID " + std::to_string(packageId) + " ignored"
        });
        return false;
    }

    AVLNode* pred = findPredecessor(packageId);
    if (pred) {
        logger.record({
            EventType::PREDECESSOR_FOUND,
            packageId,
            pred->intervalStart,
            pred->intervalEnd,
            "Predecessor interval identified: [" + std::to_string(pred->intervalStart) + ", " +
                std::to_string(pred->intervalEnd) + "]"
        });
    }

    AVLNode* succ = findSuccessor(packageId);
    if (succ) {
        logger.record({
            EventType::SUCCESSOR_FOUND,
            packageId,
            succ->intervalStart,
            succ->intervalEnd,
            "Successor interval identified: [" + std::to_string(succ->intervalStart) + ", " +
                std::to_string(succ->intervalEnd) + "]"
        });
    }

    bool extendsPred = (pred && pred->intervalEnd == packageId - 1);
    bool extendsSucc = (succ && succ->intervalStart == packageId + 1);

    if (extendsPred && extendsSucc) {
        // --- BRIDGE MERGE ---
        long long newStart = pred->intervalStart;
        long long newEnd = succ->intervalEnd;
        long long succStart = succ->intervalStart;

        logger.record({
            EventType::INTERVAL_MERGED,
            packageId,
            newStart,
            newEnd,
            "Bridge merge: package " + std::to_string(packageId) + " bridges [" +
                std::to_string(pred->intervalStart) + ", " + std::to_string(pred->intervalEnd) +
                "] and [" + std::to_string(succStart) + ", " + std::to_string(newEnd) +
                "] into [" + std::to_string(newStart) + ", " + std::to_string(newEnd) + "]"
        });

        // Remove the successor interval from AVL tree
        root = deleteRecursive(root, succStart, packageId);
        nodeCount--;

        // Update predecessor's end boundary (intervalStart key is unchanged)
        AVLNode* targetPred = search(newStart);
        if (targetPred) {
            targetPred->intervalEnd = newEnd;
        }

        totalPackages++;

        logger.record({
            EventType::TREE_UPDATED,
            packageId,
            newStart,
            newEnd,
            "AVL Tree rebalanced after bridge merge"
        });
        logger.record({
            EventType::INSERTION_COMPLETED,
            packageId,
            newStart,
            newEnd,
            "Package " + std::to_string(packageId) + " integrated via bridge merge"
        });
        return true;
    }
    else if (extendsPred) {
        // --- EXTEND PREDECESSOR ---
        long long oldEnd = pred->intervalEnd;
        pred->intervalEnd = packageId;
        totalPackages++;

        logger.record({
            EventType::INTERVAL_EXTENDED,
            packageId,
            pred->intervalStart,
            pred->intervalEnd,
            "Extended predecessor interval [" + std::to_string(pred->intervalStart) + ", " +
                std::to_string(oldEnd) + "] to [" + std::to_string(pred->intervalStart) + ", " +
                std::to_string(packageId) + "]"
        });
        logger.record({
            EventType::TREE_UPDATED,
            packageId,
            pred->intervalStart,
            pred->intervalEnd,
            "AVL Tree updated after extending interval"
        });
        logger.record({
            EventType::INSERTION_COMPLETED,
            packageId,
            pred->intervalStart,
            pred->intervalEnd,
            "Package " + std::to_string(packageId) + " extended existing interval"
        });
        return true;
    }
    else if (extendsSucc) {
        // --- EXTEND SUCCESSOR (LEFT EXTENSION) ---
        long long oldStart = succ->intervalStart;
        long long oldEnd = succ->intervalEnd;

        // Key changes from oldStart to packageId: safely re-insert
        root = deleteRecursive(root, oldStart, packageId);
        root = insertRecursive(root, packageId, oldEnd, packageId);
        totalPackages++;

        logger.record({
            EventType::INTERVAL_EXTENDED,
            packageId,
            packageId,
            oldEnd,
            "Extended successor interval [" + std::to_string(oldStart) + ", " + std::to_string(oldEnd) +
                "] to [" + std::to_string(packageId) + ", " + std::to_string(oldEnd) + "]"
        });
        logger.record({
            EventType::TREE_UPDATED,
            packageId,
            packageId,
            oldEnd,
            "AVL Tree rebalanced after extending successor interval"
        });
        logger.record({
            EventType::INSERTION_COMPLETED,
            packageId,
            packageId,
            oldEnd,
            "Package " + std::to_string(packageId) + " extended existing interval"
        });
        return true;
    }
    else {
        // --- NEW ISOLATED INTERVAL ---
        root = insertRecursive(root, packageId, packageId, packageId);
        nodeCount++;
        totalPackages++;

        logger.record({
            EventType::NEW_INTERVAL_CREATED,
            packageId,
            packageId,
            packageId,
            "Created new interval [" + std::to_string(packageId) + ", " + std::to_string(packageId) + "]"
        });
        logger.record({
            EventType::TREE_UPDATED,
            packageId,
            packageId,
            packageId,
            "AVL Tree rebalanced after inserting new interval"
        });
        logger.record({
            EventType::INSERTION_COMPLETED,
            packageId,
            packageId,
            packageId,
            "Package " + std::to_string(packageId) + " stored as new interval"
        });
        return true;
    }
}

void AVLTree::inOrderRecursive(AVLNode* node, std::vector<Interval>& result) const {
    if (!node) return;
    inOrderRecursive(node->left, result);
    result.emplace_back(node->intervalStart, node->intervalEnd);
    inOrderRecursive(node->right, result);
}

std::vector<Interval> AVLTree::getAllIntervals() const {
    std::vector<Interval> result;
    result.reserve(nodeCount);
    inOrderRecursive(root, result);
    return result;
}

std::vector<Interval> AVLTree::getMissingIntervals(long long queryStart, long long queryEnd) const {
    std::vector<Interval> missing;
    if (queryStart > queryEnd) return missing;

    std::vector<Interval> intervals = getAllIntervals();
    long long current = queryStart;

    for (const auto& iv : intervals) {
        if (iv.end < current) {
            continue;
        }
        if (iv.start > queryEnd) {
            break;
        }
        if (iv.start > current) {
            missing.emplace_back(current, std::min(iv.start - 1, queryEnd));
        }
        current = std::max(current, iv.end + 1);
        if (current > queryEnd) {
            break;
        }
    }

    if (current <= queryEnd) {
        missing.emplace_back(current, queryEnd);
    }

    return missing;
}

void AVLTree::buildSnapshotJson(AVLNode* node, std::ostringstream& ss) const {
    if (!node) {
        ss << "null";
        return;
    }

    ss << "{";
    ss << "\"intervalStart\":" << node->intervalStart << ",";
    ss << "\"intervalEnd\":" << node->intervalEnd << ",";
    ss << "\"height\":" << node->height << ",";
    ss << "\"balanceFactor\":" << getBalanceFactor(node) << ",";
    ss << "\"left\":";
    buildSnapshotJson(node->left, ss);
    ss << ",";
    ss << "\"right\":";
    buildSnapshotJson(node->right, ss);
    ss << "}";
}

std::string AVLTree::getTreeSnapshotJson() const {
    std::ostringstream ss;
    buildSnapshotJson(root, ss);
    return ss.str();
}

} // namespace rangex
