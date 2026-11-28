#pragma once

#include "rangex/avl_interval_tree.hpp"

#include <nlohmann/json.hpp>

#include <chrono>
#include <cstdint>
#include <deque>
#include <mutex>
#include <random>
#include <string>
#include <vector>

namespace rangex {

struct ThroughputBucket {
    std::string label;
    int64_t arrivals = 0;
    int64_t merges = 0;
};

class BackendService {
public:
    BackendService();

    nlohmann::json getHealth() const;
    nlohmann::json arrivePackage(
        int64_t packageId,
        const std::string& priority = "STANDARD",
        const std::string& label = ""
    );
    nlohmann::json getIntervals(std::size_t offset = 0, std::size_t limit = 0, bool includeAll = false) const;
    nlohmann::json getGaps(int64_t start, int64_t end, std::size_t limit = 500) const;
    nlohmann::json getStats() const;
    nlohmann::json getTreeSnapshot(std::size_t limit = 250) const;
    nlohmann::json getEvents(std::size_t offset = 0, std::size_t limit = 200) const;
    nlohmann::json simulateArrivals(
        std::size_t count,
        const std::string& pattern,
        int64_t rangeMin = 0,
        int64_t rangeMax = 1000
    );
    nlohmann::json bulkArrivals(const nlohmann::json& payload);
    nlohmann::json reset();

    static nlohmann::json serializeInterval(const Interval& iv);
    static nlohmann::json serializeSnapshot(const AvlTreeSnapshot& snap);
    static nlohmann::json serializeOperationResult(
        const OperationResult& res,
        const AvlTreeSnapshot* snapOverride,
        const nlohmann::json& analyticsJson,
        const std::string& timestampIso,
        const std::string& eventId
    );
    static std::string currentIsoTimestamp();
    static bool isValidPackageId(int64_t id) noexcept;

private:
    mutable std::mutex mutex_;
    AvlIntervalTree tree_;
    std::vector<nlohmann::json> eventHistory_;
    std::deque<ThroughputBucket> throughput_;
    std::chrono::steady_clock::time_point startedAt_;
    uint64_t eventSeq_ = 0;
    std::mt19937_64 rng_;

    nlohmann::json buildAnalyticsLocked() const;
    void recordThroughputLocked(int64_t arrivalsDelta, int64_t mergesDelta);
    void appendEventHistoryLocked(const nlohmann::json& eventEntry);
    std::vector<int64_t> generateIdsLocked(
        std::size_t count,
        const std::string& pattern,
        int64_t rangeMin,
        int64_t rangeMax
    );
};

}  // namespace rangex
