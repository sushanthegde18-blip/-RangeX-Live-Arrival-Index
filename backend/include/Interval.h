#ifndef RANGEX_INTERVAL_H
#define RANGEX_INTERVAL_H

#include <string>
#include <sstream>

namespace rangex {

/**
 * @brief Represents a closed interval of consecutive package IDs: [start, end].
 * Both start and end are inclusive.
 */
struct Interval {
    long long start;
    long long end;

    Interval() : start(0), end(0) {}
    Interval(long long s, long long e) : start(s), end(e) {}

    /**
     * @brief Check whether a specific package ID falls inside this interval.
     */
    bool contains(long long packageId) const {
        return packageId >= start && packageId <= end;
    }

    /**
     * @brief Returns total count of packages contained in this interval.
     */
    long long length() const {
        return (end >= start) ? (end - start + 1) : 0;
    }

    bool operator==(const Interval& other) const {
        return start == other.start && end == other.end;
    }

    bool operator!=(const Interval& other) const {
        return !(*this == other);
    }

    std::string toString() const {
        return "[" + std::to_string(start) + ", " + std::to_string(end) + "]";
    }

    std::string toJson() const {
        return "{\"start\":" + std::to_string(start) + ",\"end\":" + std::to_string(end) + "}";
    }
};

} // namespace rangex

#endif // RANGEX_INTERVAL_H
