#include "rangex/backend_service.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>

using namespace rangex;

namespace {

void require(bool cond, const std::string& msg) {
    if (!cond) {
        std::cerr << "[FAIL] " << msg << "\n";
        std::exit(1);
    }
}

void testServiceWorkflow() {
    BackendService svc;

    auto r1 = svc.arrivePackage(1);
    require(r1["mutationType"] == "CREATED", "1 should be CREATED");

    svc.arrivePackage(3);
    svc.arrivePackage(7);
    auto r2 = svc.arrivePackage(2);
    require(r2["mutationType"] == "MERGED", "2 should MERGE [1,1] and [3,3]");

    auto r6 = svc.arrivePackage(6);
    require(r6["mutationType"] == "EXTENDED", "6 should EXTEND [7,7]");

    auto intervals = svc.getIntervals();
    require(intervals["totalCount"] == 2, "Expected 2 intervals");
    require(intervals["intervals"][0]["start"] == 1 && intervals["intervals"][0]["end"] == 3, "Interval 0 [1,3]");
    require(intervals["intervals"][1]["start"] == 6 && intervals["intervals"][1]["end"] == 7, "Interval 1 [6,7]");

    auto gaps = svc.getGaps(1, 7);
    require(gaps["missingCount"] == 2, "Missing count should be 2");
    require(gaps["missingIntervals"].size() == 1, "Expected 1 missing interval [4,5]");
    require(gaps["missingIntervals"][0]["start"] == 4 && gaps["missingIntervals"][0]["end"] == 5, "Gap should be [4,5]");

    auto dup = svc.arrivePackage(2);
    require(dup["mutationType"] == "DUPLICATE", "2 again should be DUPLICATE");
    auto stats = svc.getStats();
    require(stats["totalPackages"] == 5, "Total unique packages should be 5");
    require(stats["duplicateCount"] == 1, "Duplicate count should be 1");

    auto events = svc.getEvents();
    require(events["totalCount"] == 6, "Expected 6 recorded events");

    bool caught = false;
    try {
        svc.arrivePackage(-1);
    } catch (const std::invalid_argument&) {
        caught = true;
    }
    require(caught, "Negative packageId must throw invalid_argument");

    auto bench = svc.bulkArrivals(nlohmann::json{
        {"count", 1000},
        {"pattern", "random"},
        {"benchmarkOnly", true}
    });
    require(bench["invariantsValid"] == true, "Benchmark invariants must pass");
    require(svc.getStats()["totalPackages"] == 5, "Isolated benchmark must not alter live index");

    svc.reset();
    require(svc.getStats()["totalPackages"] == 0, "Reset should clear packages");
    require(svc.getEvents()["totalCount"] == 0, "Reset should clear event history");
}

}  // namespace

int main() {
    testServiceWorkflow();
    std::cout << "[PASS] All RangeX BackendService integration tests passed!\n";
    return 0;
}
