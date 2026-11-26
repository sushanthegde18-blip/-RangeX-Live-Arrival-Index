#ifndef RANGEX_EVENT_H
#define RANGEX_EVENT_H

#include <string>
#include <vector>
#include <optional>
#include <sstream>
#include <functional>

namespace rangex {

/**
 * @brief Discrete event types emitted during AVL Tree package arrival and rebalancing.
 */
enum class EventType {
    PACKAGE_RECEIVED,
    SEARCH_STARTED,
    NODE_VISITED,
    INTERVAL_FOUND,
    PREDECESSOR_FOUND,
    SUCCESSOR_FOUND,
    NEW_INTERVAL_CREATED,
    INTERVAL_EXTENDED,
    INTERVAL_MERGED,
    AVL_NODE_INSERTED,
    AVL_NODE_DELETED,
    LEFT_ROTATION,
    RIGHT_ROTATION,
    TREE_UPDATED,
    INSERTION_COMPLETED,
    DUPLICATE_IGNORED
};

inline std::string eventTypeToString(EventType type) {
    switch (type) {
        case EventType::PACKAGE_RECEIVED:      return "PACKAGE_RECEIVED";
        case EventType::SEARCH_STARTED:        return "SEARCH_STARTED";
        case EventType::NODE_VISITED:          return "NODE_VISITED";
        case EventType::INTERVAL_FOUND:        return "INTERVAL_FOUND";
        case EventType::PREDECESSOR_FOUND:     return "PREDECESSOR_FOUND";
        case EventType::SUCCESSOR_FOUND:       return "SUCCESSOR_FOUND";
        case EventType::NEW_INTERVAL_CREATED:  return "NEW_INTERVAL_CREATED";
        case EventType::INTERVAL_EXTENDED:     return "INTERVAL_EXTENDED";
        case EventType::INTERVAL_MERGED:       return "INTERVAL_MERGED";
        case EventType::AVL_NODE_INSERTED:     return "AVL_NODE_INSERTED";
        case EventType::AVL_NODE_DELETED:      return "AVL_NODE_DELETED";
        case EventType::LEFT_ROTATION:         return "LEFT_ROTATION";
        case EventType::RIGHT_ROTATION:        return "RIGHT_ROTATION";
        case EventType::TREE_UPDATED:          return "TREE_UPDATED";
        case EventType::INSERTION_COMPLETED:   return "INSERTION_COMPLETED";
        case EventType::DUPLICATE_IGNORED:     return "DUPLICATE_IGNORED";
        default:                               return "UNKNOWN";
    }
}

/**
 * @brief Represents a single visualizable step in the AVL Tree algorithm.
 */
struct AlgorithmEvent {
    EventType type;
    long long packageId;
    std::optional<long long> nodeStart;
    std::optional<long long> nodeEnd;
    std::string message;

    // Additional context for rotations and rebalancing
    std::optional<long long> pivotStart;
    std::optional<long long> childStart;
    std::optional<long long> parentStart;

    AlgorithmEvent(EventType t,
                   long long pid,
                   std::optional<long long> nStart,
                   std::optional<long long> nEnd,
                   std::string msg,
                   std::optional<long long> pStart = std::nullopt,
                   std::optional<long long> cStart = std::nullopt,
                   std::optional<long long> parStart = std::nullopt)
        : type(t),
          packageId(pid),
          nodeStart(nStart),
          nodeEnd(nEnd),
          message(std::move(msg)),
          pivotStart(pStart),
          childStart(cStart),
          parentStart(parStart) {}

    std::string toJson() const {
        std::ostringstream ss;
        ss << "{";
        ss << "\"type\":\"" << eventTypeToString(type) << "\",";
        ss << "\"packageId\":" << packageId << ",";

        if (nodeStart.has_value()) {
            ss << "\"nodeStart\":" << *nodeStart << ",";
        }
        if (nodeEnd.has_value()) {
            ss << "\"nodeEnd\":" << *nodeEnd << ",";
        }
        if (pivotStart.has_value()) {
            ss << "\"pivotStart\":" << *pivotStart << ",";
        }
        if (childStart.has_value()) {
            ss << "\"childStart\":" << *childStart << ",";
        }
        if (parentStart.has_value()) {
            ss << "\"parentStart\":" << *parentStart << ",";
        }

        // Escape message string if needed
        ss << "\"message\":\"";
        for (char c : message) {
            if (c == '"') ss << "\\\"";
            else if (c == '\\') ss << "\\\\";
            else if (c == '\n') ss << "\\n";
            else ss << c;
        }
        ss << "\"}";
        return ss.str();
    }
};

/**
 * @brief Records algorithm events for frontend visualization or test assertions.
 */
class EventLogger {
public:
    using EventCallback = std::function<void(const AlgorithmEvent&)>;

    EventLogger() : recording(true), callback(nullptr) {}

    void setRecording(bool enable) {
        recording = enable;
    }

    bool isRecording() const {
        return recording;
    }

    void setCallback(EventCallback cb) {
        callback = cb;
    }

    void record(const AlgorithmEvent& event) {
        if (!recording) return;
        events.push_back(event);
        if (callback) {
            callback(event);
        }
    }

    const std::vector<AlgorithmEvent>& getEvents() const {
        return events;
    }

    void clear() {
        events.clear();
    }

    size_t size() const {
        return events.size();
    }

    std::string toJson() const {
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < events.size(); ++i) {
            if (i > 0) ss << ",";
            ss << events[i].toJson();
        }
        ss << "]";
        return ss.str();
    }

private:
    bool recording;
    std::vector<AlgorithmEvent> events;
    EventCallback callback;
};

} // namespace rangex

#endif // RANGEX_EVENT_H
