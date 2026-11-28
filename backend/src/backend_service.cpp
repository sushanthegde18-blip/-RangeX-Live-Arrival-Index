#include "rangex/backend_service.hpp"

#include <algorithm>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace rangex {

namespace {
constexpr std::size_t MAX_STORED_EVENTS = 1000;
constexpr std::size_t MAX_THROUGHPUT_BUCKETS = 12;
constexpr std::size_t DEFAULT_INTERVAL_LIMIT = 1000;

std::string formatTimeShort() {
    const auto now = std::chrono::system_clock::now();
    const std::time_t tt = std::chrono::system_clock::to_time_t(now);
    std::tm tmBuf{};
#if defined(_WIN32)
    localtime_s(&tmBuf, &tt);
#else
    localtime_r(&tt, &tmBuf);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tmBuf, "%H:%M:%S");
    return oss.str();
}

nlohmann::json serializeNodeIds(const std::vector<uint64_t>& ids) {
    nlohmann::json arr = nlohmann::json::array();
    for (uint64_t id : ids) {
        arr.push_back(std::to_string(id));
    }
    return arr;
}
}  // namespace

BackendService::BackendService()
    : startedAt_(std::chrono::steady_clock::now()),
      rng_(std::random_device{}()) {}

bool BackendService::isValidPackageId(int64_t id) noexcept {
    return id >= MIN_PACKAGE_ID && id <= MAX_PACKAGE_ID;
}

std::string BackendService::currentIsoTimestamp() {
    const auto now = std::chrono::system_clock::now();
    const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
    const std::time_t tt = std::chrono::system_clock::to_time_t(now);
    std::tm tmBuf{};
#if defined(_WIN32)
    gmtime_s(&tmBuf, &tt);
#else
    gmtime_r(&tt, &tmBuf);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tmBuf, "%Y-%m-%dT%H:%M:%S")
        << '.' << std::setw(3) << std::setfill('0') << ms.count() << 'Z';
    return oss.str();
}

nlohmann::json BackendService::serializeInterval(const Interval& iv) {
    return nlohmann::json{
        {"id", std::to_string(iv.start) + "-" + std::to_string(iv.end)},
        {"nodeId", std::to_string(iv.nodeId)},
        {"start", iv.start},
        {"end", iv.end},
        {"zone", iv.zone.empty() ? "BAY-A1" : iv.zone},
        {"packageCount", iv.packageCount()}
    };
}

nlohmann::json BackendService::serializeSnapshot(const AvlTreeSnapshot& snap) {
    nlohmann::json nodesArr = nlohmann::json::array();
    for (const auto& n : snap.nodes) {
        nodesArr.push_back(nlohmann::json{
            {"id", std::to_string(n.id)},
            {"interval", nlohmann::json{
                {"id", std::to_string(n.start) + "-" + std::to_string(n.end)},
                {"nodeId", std::to_string(n.id)},
                {"start", n.start},
                {"end", n.end},
                {"zone", n.zone},
                {"packageCount", n.end - n.start + 1}
            }},
            {"height", n.height},
            {"balanceFactor", n.balanceFactor},
            {"leftId", n.leftId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(n.leftId))},
            {"rightId", n.rightId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(n.rightId))},
            {"parentId", n.parentId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(n.parentId))},
            {"depth", n.depth}
        });
    }

    return nlohmann::json{
        {"rootId", snap.rootId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(snap.rootId))},
        {"nodes", std::move(nodesArr)},
        {"height", snap.height},
        {"nodeCount", snap.nodeCount},
        {"truncated", snap.nodes.size() < snap.nodeCount},
        {"revision", snap.revision},
        {"updatedAt", currentIsoTimestamp()}
    };
}

nlohmann::json BackendService::serializeOperationResult(
    const OperationResult& res,
    const AvlTreeSnapshot* snapOverride,
    const nlohmann::json& analyticsJson,
    const std::string& timestampIso,
    const std::string& eventId
) {
    nlohmann::json prevArr = nlohmann::json::array();
    for (const auto& iv : res.previousIntervals) {
        prevArr.push_back(serializeInterval(iv));
    }

    nlohmann::json afterArr = nlohmann::json::array();
    for (const auto& iv : res.intervalsAfter) {
        afterArr.push_back(serializeInterval(iv));
    }

    nlohmann::json mergedArr = nlohmann::json::array();
    for (const auto& iv : res.mergedFrom) {
        mergedArr.push_back(serializeInterval(iv));
    }

    nlohmann::json rotationJson;
    if (res.primaryRotation == RotationType::NONE) {
        rotationJson = nlohmann::json{{"type", "NONE"}};
    } else {
        rotationJson = nlohmann::json{
            {"type", AvlIntervalTree::toString(res.primaryRotation)},
            {"pivotNodeId", res.primaryPivotNodeId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(res.primaryPivotNodeId))},
            {"affectedNodeIds", serializeNodeIds(res.primaryAffectedNodeIds)},
            {"reason", res.rotationReason}
        };
    }

    nlohmann::json stepsArr = nlohmann::json::array();
    for (const auto& step : res.rotationSteps) {
        nlohmann::json s{
            {"type", AvlIntervalTree::toString(step.type)},
            {"pivotNodeId", step.pivotNodeId == 0 ? nlohmann::json(nullptr) : nlohmann::json(std::to_string(step.pivotNodeId))},
            {"pivotBalanceFactor", step.pivotBalanceFactor},
            {"affectedNodeIds", serializeNodeIds(step.affectedNodeIds)},
            {"reason", step.reason},
            {"preRotationSnapshot", step.preRotationSnapshot.has_value() ? serializeSnapshot(*step.preRotationSnapshot) : nlohmann::json(nullptr)},
            {"intermediateSnapshot", step.intermediateSnapshot.has_value() ? serializeSnapshot(*step.intermediateSnapshot) : nlohmann::json(nullptr)},
            {"afterSnapshot", step.afterSnapshot.has_value() ? serializeSnapshot(*step.afterSnapshot) : nlohmann::json(nullptr)}
        };
        stepsArr.push_back(std::move(s));
    }

    nlohmann::json snapJson = nlohmann::json(nullptr);
    if (snapOverride) {
        snapJson = serializeSnapshot(*snapOverride);
    } else if (res.finalSnapshot.has_value()) {
        snapJson = serializeSnapshot(*res.finalSnapshot);
    }

    nlohmann::json traceJson{
        {"beforeSnapshot", res.beforeSnapshot.has_value() ? serializeSnapshot(*res.beforeSnapshot) : nlohmann::json(nullptr)},
        {"preBalanceSnapshot", res.preBalanceSnapshot.has_value() ? serializeSnapshot(*res.preBalanceSnapshot) : nlohmann::json(nullptr)},
        {"rotationSteps", std::move(stepsArr)},
        {"finalSnapshot", snapJson},
        {"elapsedMicros", res.elapsedMicros}
    };

    nlohmann::json payload{
        {"eventId", eventId},
        {"packageId", res.packageId},
        {"mutationType", AvlIntervalTree::toString(res.mutationType)},
        {"targetInterval", serializeInterval(res.targetInterval)},
        {"previousIntervals", std::move(prevArr)},
        {"intervals", std::move(afterArr)},
        {"searchPath", serializeNodeIds(res.searchPath)},
        {"highlightedNodeIds", serializeNodeIds(res.highlightedNodeIds)},
        {"rotation", std::move(rotationJson)},
        {"trace", std::move(traceJson)},
        {"avlSnapshot", std::move(snapJson)},
        {"analytics", analyticsJson},
        {"timestamp", timestampIso},
        {"isFixture", false}
    };

    if (!mergedArr.empty()) {
        payload["mergedFrom"] = std::move(mergedArr);
    }
    return payload;
}

void BackendService::recordThroughputLocked(int64_t arrivalsDelta, int64_t mergesDelta) {
    const std::string label = formatTimeShort();
    if (!throughput_.empty() && throughput_.back().label == label) {
        throughput_.back().arrivals += arrivalsDelta;
        throughput_.back().merges += mergesDelta;
    } else {
        throughput_.push_back(ThroughputBucket{label, arrivalsDelta, mergesDelta});
        while (throughput_.size() > MAX_THROUGHPUT_BUCKETS) {
            throughput_.pop_front();
        }
    }
}

void BackendService::appendEventHistoryLocked(const nlohmann::json& eventEntry) {
    eventHistory_.push_back(eventEntry);
    if (eventHistory_.size() > MAX_STORED_EVENTS) {
        eventHistory_.erase(
            eventHistory_.begin(),
            eventHistory_.begin() + static_cast<std::ptrdiff_t>(eventHistory_.size() - MAX_STORED_EVENTS)
        );
    }
}

nlohmann::json BackendService::buildAnalyticsLocked() const {
    const TreeMetrics m = tree_.getMetrics();
    nlohmann::json throughputArr = nlohmann::json::array();
    for (const auto& bucket : throughput_) {
        throughputArr.push_back(nlohmann::json{
            {"timestamp", bucket.label},
            {"arrivals", bucket.arrivals},
            {"merges", bucket.merges}
        });
    }

    const std::string status = (m.activeIntervals == 0)
                                   ? "READY"
                                   : (m.avlHeight <= 24 ? "OPTIMAL" : "BALANCED_HIGH_VOLUME");

    return nlohmann::json{
        {"totalPackages", m.totalUniquePackages},
        {"totalUniquePackages", m.totalUniquePackages},
        {"activeIntervals", m.activeIntervals},
        {"totalIntervals", m.activeIntervals},
        {"missingCount", m.missingInActiveSpan},
        {"duplicateCount", m.duplicateCount},
        {"mergedCount", m.mergedCount},
        {"extendedCount", m.extendedCount},
        {"createdCount", m.createdCount},
        {"compressionRatio", m.compressionRatio},
        {"avlHeight", m.avlHeight},
        {"rotationCount", m.rotationCount},
        {"llRotations", m.llRotationCount},
        {"rrRotations", m.rrRotationCount},
        {"lrRotations", m.lrRotationCount},
        {"rlRotations", m.rlRotationCount},
        {"avgLookupMicros", m.avgLookupMicros},
        {"avgInsertMicros", m.avgInsertMicros},
        {"minId", m.minId.has_value() ? nlohmann::json(*m.minId) : nlohmann::json(nullptr)},
        {"maxId", m.maxId.has_value() ? nlohmann::json(*m.maxId) : nlohmann::json(nullptr)},
        {"latestPackageId", m.latestPackageId.has_value() ? nlohmann::json(*m.latestPackageId) : nlohmann::json(nullptr)},
        {"systemStatus", status},
        {"recentThroughput", std::move(throughputArr)},
        {"revision", m.revision},
        {"updatedAt", currentIsoTimestamp()}
    };
}

nlohmann::json BackendService::getHealth() const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto uptime = std::chrono::duration<double>(std::chrono::steady_clock::now() - startedAt_).count();
    const TreeMetrics m = tree_.getMetrics();
    return nlohmann::json{
        {"status", "ok"},
        {"service", "rangex-cpp-backend"},
        {"version", "1.0.0"},
        {"engine", "custom-avl-interval-tree"},
        {"uptimeSeconds", uptime},
        {"totalPackages", m.totalUniquePackages},
        {"activeIntervals", m.activeIntervals},
        {"avlHeight", m.avlHeight},
        {"revision", m.revision}
    };
}

nlohmann::json BackendService::arrivePackage(
    int64_t packageId,
    const std::string& priority,
    const std::string& label
) {
    if (!isValidPackageId(packageId)) {
        throw std::invalid_argument("packageId must be between 0 and 1000000000");
    }

    std::lock_guard<std::mutex> lock(mutex_);
    const OperationResult res = tree_.insert(packageId, true);
    recordThroughputLocked(1, res.mutationType == MutationType::MERGED ? 1 : 0);

    const uint64_t seq = ++eventSeq_;
    const std::string eventId = "evt-" + std::to_string(seq);
    const std::string ts = currentIsoTimestamp();
    const nlohmann::json analyticsJson = buildAnalyticsLocked();

    nlohmann::json payload = serializeOperationResult(res, nullptr, analyticsJson, ts, eventId);
    payload["priority"] = priority.empty() ? "STANDARD" : priority;
    if (!label.empty()) {
        payload["label"] = label;
    }

    nlohmann::json replayEntry{
        {"seq", seq},
        {"eventId", eventId},
        {"timestamp", ts},
        {"packageId", res.packageId},
        {"mutationType", AvlIntervalTree::toString(res.mutationType)},
        {"targetInterval", serializeInterval(res.targetInterval)},
        {"previousIntervals", payload["previousIntervals"]},
        {"intervals", payload["intervals"]},
        {"mergedFrom", payload.contains("mergedFrom") ? payload["mergedFrom"] : nlohmann::json::array()},
        {"rotation", payload["rotation"]},
        {"searchPath", payload["searchPath"]},
        {"avlSnapshot", payload["avlSnapshot"]},
        {"analytics", analyticsJson}
    };
    appendEventHistoryLocked(replayEntry);

    return payload;
}

nlohmann::json BackendService::getIntervals(std::size_t offset, std::size_t limit, bool includeAll) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const TreeMetrics m = tree_.getMetrics();
    const std::size_t effectiveLimit = includeAll ? 0 : (limit == 0 ? DEFAULT_INTERVAL_LIMIT : limit);
    const auto ivs = tree_.getIntervals(offset, effectiveLimit);

    nlohmann::json arr = nlohmann::json::array();
    for (const auto& iv : ivs) {
        arr.push_back(serializeInterval(iv));
    }

    return nlohmann::json{
        {"intervals", std::move(arr)},
        {"totalCount", m.activeIntervals},
        {"offset", offset},
        {"truncated", (offset + ivs.size()) < m.activeIntervals},
        {"missingCount", m.missingInActiveSpan},
        {"minId", m.minId.has_value() ? nlohmann::json(*m.minId) : nlohmann::json(nullptr)},
        {"maxId", m.maxId.has_value() ? nlohmann::json(*m.maxId) : nlohmann::json(nullptr)},
        {"revision", m.revision},
        {"updatedAt", currentIsoTimestamp()}
    };
}

nlohmann::json BackendService::getGaps(int64_t start, int64_t end, std::size_t limit) const {
    if (!isValidPackageId(start) || !isValidPackageId(end) || start > end) {
        throw std::invalid_argument("Query range must satisfy 0 <= start <= end <= 1000000000");
    }

    std::lock_guard<std::mutex> lock(mutex_);
    const GapsResult gaps = tree_.findMissingRanges(start, end);
    const std::size_t cap = (limit == 0) ? gaps.missingIntervals.size() : std::min(limit, gaps.missingIntervals.size());

    nlohmann::json arr = nlohmann::json::array();
    for (std::size_t i = 0; i < cap; ++i) {
        const auto& g = gaps.missingIntervals[i];
        arr.push_back(nlohmann::json{
            {"start", g.start},
            {"end", g.end},
            {"count", g.count()}
        });
    }

    return nlohmann::json{
        {"start", gaps.queryStart},
        {"end", gaps.queryEnd},
        {"missingIntervals", std::move(arr)},
        {"totalMissingIntervals", gaps.missingIntervals.size()},
        {"truncated", cap < gaps.missingIntervals.size()},
        {"missingCount", gaps.missingCount},
        {"presentCount", gaps.presentCount},
        {"updatedAt", currentIsoTimestamp()}
    };
}

nlohmann::json BackendService::getStats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return buildAnalyticsLocked();
}

nlohmann::json BackendService::getTreeSnapshot(std::size_t limit) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const std::size_t effectiveLimit = (limit == 0) ? 250 : limit;
    return serializeSnapshot(tree_.getSnapshot(effectiveLimit));
}

nlohmann::json BackendService::getEvents(std::size_t offset, std::size_t limit) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const std::size_t total = eventHistory_.size();
    nlohmann::json arr = nlohmann::json::array();
    if (offset < total) {
        const std::size_t endIdx = (limit == 0) ? total : std::min(total, offset + limit);
        for (std::size_t i = offset; i < endIdx; ++i) {
            arr.push_back(eventHistory_[i]);
        }
    }
    return nlohmann::json{
        {"events", std::move(arr)},
        {"totalCount", total},
        {"offset", offset}
    };
}

std::vector<int64_t> BackendService::generateIdsLocked(
    std::size_t count,
    const std::string& pattern,
    int64_t rangeMin,
    int64_t rangeMax
) {
    std::vector<int64_t> ids;
    ids.reserve(count);

    if (pattern == "sequential") {
        const int64_t base = std::max<int64_t>(0, rangeMin);
        for (std::size_t i = 0; i < count; ++i) {
            ids.push_back(std::min<int64_t>(MAX_PACKAGE_ID, base + static_cast<int64_t>(i)));
        }
        return ids;
    }

    if (pattern == "spaced") {
        const int64_t step = std::max<int64_t>(2, MAX_PACKAGE_ID / static_cast<int64_t>(std::max<std::size_t>(1, count)));
        for (std::size_t i = 0; i < count; ++i) {
            ids.push_back(std::min<int64_t>(MAX_PACKAGE_ID, static_cast<int64_t>(i) * step));
        }
        std::shuffle(ids.begin(), ids.end(), rng_);
        return ids;
    }

    if (pattern == "duplicate-heavy") {
        const int64_t poolSpan = std::max<int64_t>(10, static_cast<int64_t>(count / 8));
        std::uniform_int_distribution<int64_t> dist(rangeMin, std::min<int64_t>(MAX_PACKAGE_ID, rangeMin + poolSpan));
        for (std::size_t i = 0; i < count; ++i) {
            ids.push_back(dist(rng_));
        }
        return ids;
    }

    const int64_t lo = std::max<int64_t>(MIN_PACKAGE_ID, rangeMin);
    const int64_t hi = std::min<int64_t>(MAX_PACKAGE_ID, std::max(lo, rangeMax));
    std::uniform_int_distribution<int64_t> dist(lo, hi);
    for (std::size_t i = 0; i < count; ++i) {
        ids.push_back(dist(rng_));
    }
    return ids;
}

nlohmann::json BackendService::simulateArrivals(
    std::size_t count,
    const std::string& pattern,
    int64_t rangeMin,
    int64_t rangeMax
) {
    if (count == 0 || count > 1000) {
        throw std::invalid_argument("simulate count must be between 1 and 1000");
    }
    if (!isValidPackageId(rangeMin) || !isValidPackageId(rangeMax) || rangeMin > rangeMax) {
        throw std::invalid_argument("simulate minId/maxId must satisfy 0 <= minId <= maxId <= 1000000000");
    }

    std::lock_guard<std::mutex> lock(mutex_);
    const std::vector<int64_t> ids = generateIdsLocked(count, pattern, rangeMin, rangeMax);

    int64_t uniqueAdded = 0;
    int64_t duplicates = 0;
    int64_t merges = 0;
    nlohmann::json latestPayload;

    for (std::size_t i = 0; i < ids.size(); ++i) {
        const bool isLast = (i + 1 == ids.size());
        const bool captureTrace = isLast || (count <= 25);
        const OperationResult res = tree_.insert(ids[i], captureTrace);

        if (res.mutationType == MutationType::DUPLICATE) {
            ++duplicates;
        } else {
            ++uniqueAdded;
        }
        if (res.mutationType == MutationType::MERGED) {
            ++merges;
        }

        const uint64_t seq = ++eventSeq_;
        const std::string eventId = "evt-" + std::to_string(seq);
        const std::string ts = currentIsoTimestamp();

        if (count <= 100 || isLast) {
            const nlohmann::json analyticsJson = buildAnalyticsLocked();
            const AvlTreeSnapshot snap = tree_.getSnapshot(250);
            const nlohmann::json payload = serializeOperationResult(res, &snap, analyticsJson, ts, eventId);

            if (count <= 50 || isLast) {
                nlohmann::json replayEntry{
                    {"seq", seq},
                    {"eventId", eventId},
                    {"timestamp", ts},
                    {"packageId", res.packageId},
                    {"mutationType", AvlIntervalTree::toString(res.mutationType)},
                    {"targetInterval", serializeInterval(res.targetInterval)},
                    {"previousIntervals", payload["previousIntervals"]},
                    {"intervals", payload["intervals"]},
                    {"mergedFrom", payload.contains("mergedFrom") ? payload["mergedFrom"] : nlohmann::json::array()},
                    {"rotation", payload["rotation"]},
                    {"searchPath", payload["searchPath"]},
                    {"avlSnapshot", payload["avlSnapshot"]},
                    {"analytics", analyticsJson}
                };
                appendEventHistoryLocked(replayEntry);
            }
            if (isLast) {
                latestPayload = payload;
            }
        }
    }

    recordThroughputLocked(static_cast<int64_t>(count), merges);
    const nlohmann::json analyticsJson = buildAnalyticsLocked();

    nlohmann::json sampleIds = nlohmann::json::array();
    const std::size_t idCap = std::min<std::size_t>(ids.size(), 100);
    for (std::size_t i = 0; i < idCap; ++i) {
        sampleIds.push_back(ids[i]);
    }

    const auto ivs = tree_.getIntervals(0, DEFAULT_INTERVAL_LIMIT);
    nlohmann::json ivArr = nlohmann::json::array();
    for (const auto& iv : ivs) {
        ivArr.push_back(serializeInterval(iv));
    }

    return nlohmann::json{
        {"simulatedCount", count},
        {"pattern", pattern},
        {"uniqueAdded", uniqueAdded},
        {"duplicates", duplicates},
        {"merges", merges},
        {"generatedIds", std::move(sampleIds)},
        {"latestArrival", latestPayload},
        {"intervals", std::move(ivArr)},
        {"avlSnapshot", serializeSnapshot(tree_.getSnapshot(250))},
        {"analytics", analyticsJson}
    };
}

nlohmann::json BackendService::bulkArrivals(const nlohmann::json& payload) {
    const bool hasExplicitIds = payload.contains("packageIds") && payload["packageIds"].is_array();
    const bool benchmarkOnly = payload.value("benchmarkOnly", !hasExplicitIds);

    std::vector<int64_t> ids;
    std::string pattern = payload.value("pattern", std::string("random"));

    if (hasExplicitIds) {
        const auto& arr = payload["packageIds"];
        if (arr.empty() || arr.size() > 100000) {
            throw std::invalid_argument("packageIds array must contain 1 to 100000 integers");
        }
        ids.reserve(arr.size());
        for (const auto& item : arr) {
            if (!item.is_number_integer()) {
                throw std::invalid_argument("All elements of packageIds must be integers");
            }
            const int64_t val = item.get<int64_t>();
            if (!isValidPackageId(val)) {
                throw std::invalid_argument("Every packageId must be between 0 and 1000000000");
            }
            ids.push_back(val);
        }
        pattern = "explicit";
    } else {
        if (!payload.contains("count") || !payload["count"].is_number_integer()) {
            throw std::invalid_argument("Provide either packageIds[] or integer count");
        }
        const int64_t rawCount = payload["count"].get<int64_t>();
        if (rawCount <= 0 || rawCount > 100000) {
            throw std::invalid_argument("count must be between 1 and 100000");
        }
        const int64_t rangeMin = payload.value("minId", int64_t{0});
        const int64_t rangeMax = payload.value("maxId", std::max<int64_t>(rawCount * 4, 1000));
        if (!isValidPackageId(rangeMin) || !isValidPackageId(rangeMax) || rangeMin > rangeMax) {
            throw std::invalid_argument("minId/maxId out of bounds");
        }
        std::lock_guard<std::mutex> lock(mutex_);
        ids = generateIdsLocked(static_cast<std::size_t>(rawCount), pattern, rangeMin, rangeMax);
    }

    if (benchmarkOnly) {
        AvlIntervalTree benchTree;
        const auto tInsertStart = std::chrono::steady_clock::now();
        for (int64_t id : ids) {
            benchTree.insert(id, false);
        }
        const auto tInsertEnd = std::chrono::steady_clock::now();

        const std::size_t queryCount = std::min<std::size_t>(ids.size(), 5000);
        std::size_t foundCount = 0;
        const auto tLookupStart = std::chrono::steady_clock::now();
        for (std::size_t i = 0; i < queryCount; ++i) {
            if (benchTree.contains(ids[(i * 997) % ids.size()])) {
                ++foundCount;
            }
        }
        const auto tLookupEnd = std::chrono::steady_clock::now();

        const double insertTotalMs = std::chrono::duration<double, std::milli>(tInsertEnd - tInsertStart).count();
        const double lookupTotalMs = std::chrono::duration<double, std::milli>(tLookupEnd - tLookupStart).count();
        const TreeMetrics m = benchTree.getMetrics();
        const InvariantReport inv = benchTree.verifyInvariants();

        return nlohmann::json{
            {"mode", "isolated-benchmark"},
            {"benchmarkOnly", true},
            {"count", ids.size()},
            {"pattern", pattern},
            {"uniqueIds", m.totalUniquePackages},
            {"duplicateCount", m.duplicateCount},
            {"activeIntervals", m.activeIntervals},
            {"avlHeight", m.avlHeight},
            {"rotationCount", m.rotationCount},
            {"llRotations", m.llRotationCount},
            {"rrRotations", m.rrRotationCount},
            {"lrRotations", m.lrRotationCount},
            {"rlRotations", m.rlRotationCount},
            {"insertTotalMs", insertTotalMs},
            {"avgInsertMicros", ids.empty() ? 0.0 : (insertTotalMs * 1000.0) / static_cast<double>(ids.size())},
            {"insertThroughputOpsSec", insertTotalMs > 0.0 ? (static_cast<double>(ids.size()) / (insertTotalMs / 1000.0)) : 0.0},
            {"lookupQueries", queryCount},
            {"lookupHits", foundCount},
            {"lookupTotalMs", lookupTotalMs},
            {"avgLookupMicros", queryCount == 0 ? 0.0 : (lookupTotalMs * 1000.0) / static_cast<double>(queryCount)},
            {"compressionRatio", m.compressionRatio},
            {"invariantsValid", inv.valid},
            {"timestamp", currentIsoTimestamp()}
        };
    }

    std::lock_guard<std::mutex> lock(mutex_);
    const auto tInsertStart = std::chrono::steady_clock::now();
    int64_t merges = 0;
    OperationResult lastRes;
    for (std::size_t i = 0; i < ids.size(); ++i) {
        const bool isLast = (i + 1 == ids.size());
        const OperationResult res = tree_.insert(ids[i], isLast && ids.size() <= 500);
        if (res.mutationType == MutationType::MERGED) ++merges;
        if (ids.size() <= 100 || isLast) {
            const uint64_t seq = ++eventSeq_;
            const std::string eventId = "evt-" + std::to_string(seq);
            const std::string ts = currentIsoTimestamp();
            const AvlTreeSnapshot snap = tree_.getSnapshot(250);
            const nlohmann::json analyticsJson = buildAnalyticsLocked();
            const auto ivsNow = (tree_.getMetrics().activeIntervals <= 250) ? tree_.getIntervals() : std::vector<Interval>{};
            nlohmann::json ivJsonArr = nlohmann::json::array();
            for (const auto& iv : ivsNow) ivJsonArr.push_back(serializeInterval(iv));
            appendEventHistoryLocked(nlohmann::json{
                {"seq", seq},
                {"eventId", eventId},
                {"timestamp", ts},
                {"packageId", res.packageId},
                {"mutationType", AvlIntervalTree::toString(res.mutationType)},
                {"targetInterval", serializeInterval(res.targetInterval)},
                {"intervals", std::move(ivJsonArr)},
                {"rotation", nlohmann::json{{"type", AvlIntervalTree::toString(res.primaryRotation)}}},
                {"avlSnapshot", serializeSnapshot(snap)},
                {"analytics", analyticsJson}
            });
        }
        if (isLast) lastRes = res;
    }
    const auto tInsertEnd = std::chrono::steady_clock::now();
    recordThroughputLocked(static_cast<int64_t>(ids.size()), merges);

    const double insertTotalMs = std::chrono::duration<double, std::milli>(tInsertEnd - tInsertStart).count();
    const nlohmann::json analyticsJson = buildAnalyticsLocked();
    const auto ivs = tree_.getIntervals(0, DEFAULT_INTERVAL_LIMIT);
    nlohmann::json ivArr = nlohmann::json::array();
    for (const auto& iv : ivs) ivArr.push_back(serializeInterval(iv));

    return nlohmann::json{
        {"mode", "live-mutation"},
        {"benchmarkOnly", false},
        {"count", ids.size()},
        {"pattern", pattern},
        {"insertTotalMs", insertTotalMs},
        {"avgInsertMicros", ids.empty() ? 0.0 : (insertTotalMs * 1000.0) / static_cast<double>(ids.size())},
        {"intervals", std::move(ivArr)},
        {"avlSnapshot", serializeSnapshot(tree_.getSnapshot(250))},
        {"analytics", analyticsJson},
        {"latestTargetInterval", serializeInterval(lastRes.targetInterval)}
    };
}

nlohmann::json BackendService::reset() {
    std::lock_guard<std::mutex> lock(mutex_);
    tree_.clear();
    eventHistory_.clear();
    throughput_.clear();
    eventSeq_ = 0;
    return nlohmann::json{
        {"status", "reset"},
        {"intervals", nlohmann::json::array()},
        {"avlSnapshot", serializeSnapshot(tree_.getSnapshot(250))},
        {"analytics", buildAnalyticsLocked()},
        {"timestamp", currentIsoTimestamp()}
    };
}

}  // namespace rangex
