#include "EventManager.h"
#include <sstream>
#include <iomanip>
#include <iostream>

#if __has_include("../thirdparty/crow/crow_all.h")
#include "../thirdparty/crow/crow_all.h"
#elif __has_include("crow.h")
#include "crow.h"
#elif __has_include("crow/websocket.h")
#include "crow/websocket.h"
#endif

namespace rangex {

std::string EnrichedEvent::toJson() const {
    std::ostringstream ss;
    ss << "{";
    ss << "\"eventId\":\"" << eventId << "\",";
    ss << "\"operationId\":\"" << operationId << "\",";
    ss << "\"sequenceNumber\":" << sequenceNumber << ",";
    ss << "\"eventType\":\"" << eventType << "\",";
    ss << "\"packageId\":" << packageId << ",";

    // Escape message string
    ss << "\"message\":\"";
    for (char c : message) {
        if (c == '"') ss << "\\\"";
        else if (c == '\\') ss << "\\\\";
        else if (c == '\n') ss << "\\n";
        else if (c == '\r') ss << "\\r";
        else if (c == '\t') ss << "\\t";
        else ss << c;
    }
    ss << "\",";

    ss << "\"timestamp\":" << timestampMs << ",";

    // Node Information object
    ss << "\"nodeInfo\":{";
    bool first = true;
    if (nodeStart.has_value()) {
        ss << "\"nodeStart\":" << *nodeStart;
        first = false;
    }
    if (nodeEnd.has_value()) {
        if (!first) ss << ",";
        ss << "\"nodeEnd\":" << *nodeEnd;
        first = false;
    }
    if (pivotStart.has_value()) {
        if (!first) ss << ",";
        ss << "\"pivotStart\":" << *pivotStart;
        first = false;
    }
    if (childStart.has_value()) {
        if (!first) ss << ",";
        ss << "\"childStart\":" << *childStart;
        first = false;
    }
    if (parentStart.has_value()) {
        if (!first) ss << ",";
        ss << "\"parentStart\":" << *parentStart;
        first = false;
    }
    ss << "},";

    // Tree snapshot JSON (embedded directly if available, otherwise null)
    ss << "\"treeSnapshot\":";
    if (!treeSnapshotJson.empty() && treeSnapshotJson != "null") {
        ss << treeSnapshotJson;
    } else {
        ss << "null";
    }

    ss << "}";
    return ss.str();
}

EventManager::EventManager()
    : nextSubscriberId(1),
      globalEventCounter(0),
      currentOperationId("init"),
      currentSequence(0) {}

EventManager::~EventManager() {
    std::lock_guard<std::mutex> lock(wsMutex);
    wsConnections.clear();
}

long long EventManager::getCurrentTimestampMs() const {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

std::string EventManager::generateEventId() {
    long long count = ++globalEventCounter;
    return "ev_" + std::to_string(count);
}

std::string EventManager::startOperation(long long packageId) {
    std::lock_guard<std::mutex> lock(opMutex);
    long long now = getCurrentTimestampMs();
    currentOperationId = "op_pkg_" + std::to_string(packageId) + "_" + std::to_string(now);
    currentSequence = 0;
    currentBatch.clear();
    return currentOperationId;
}

EnrichedEvent EventManager::publishAlgorithmEvent(const AlgorithmEvent& rawEvent,
                                                  const std::string& snapshotJson) {
    EnrichedEvent enriched;
    {
        std::lock_guard<std::mutex> lock(opMutex);
        enriched.eventId = generateEventId();
        enriched.operationId = currentOperationId;
        enriched.sequenceNumber = ++currentSequence;
        enriched.eventType = eventTypeToString(rawEvent.type);
        enriched.packageId = rawEvent.packageId;
        enriched.message = rawEvent.message;
        enriched.timestampMs = getCurrentTimestampMs();
        enriched.nodeStart = rawEvent.nodeStart;
        enriched.nodeEnd = rawEvent.nodeEnd;
        enriched.pivotStart = rawEvent.pivotStart;
        enriched.childStart = rawEvent.childStart;
        enriched.parentStart = rawEvent.parentStart;
        enriched.treeSnapshotJson = snapshotJson;

        currentBatch.push_back(enriched);
    }

    broadcast(enriched);
    return enriched;
}

EnrichedEvent EventManager::publishSystemEvent(const std::string& type,
                                               long long packageId,
                                               const std::string& message,
                                               const std::string& snapshotJson) {
    EnrichedEvent enriched;
    {
        std::lock_guard<std::mutex> lock(opMutex);
        enriched.eventId = generateEventId();
        enriched.operationId = currentOperationId;
        enriched.sequenceNumber = ++currentSequence;
        enriched.eventType = type;
        enriched.packageId = packageId;
        enriched.message = message;
        enriched.timestampMs = getCurrentTimestampMs();
        enriched.nodeStart = std::nullopt;
        enriched.nodeEnd = std::nullopt;
        enriched.pivotStart = std::nullopt;
        enriched.childStart = std::nullopt;
        enriched.parentStart = std::nullopt;
        enriched.treeSnapshotJson = snapshotJson;

        currentBatch.push_back(enriched);
    }

    broadcast(enriched);
    return enriched;
}

std::vector<EnrichedEvent> EventManager::finishOperation() {
    std::lock_guard<std::mutex> lock(opMutex);
    return currentBatch;
}

void EventManager::addConnection(crow::websocket::connection* conn) {
    std::lock_guard<std::mutex> lock(wsMutex);
    wsConnections.insert(conn);
}

void EventManager::removeConnection(crow::websocket::connection* conn) {
    std::lock_guard<std::mutex> lock(wsMutex);
    wsConnections.erase(conn);
}

size_t EventManager::getConnectionCount() const {
    std::lock_guard<std::mutex> lock(wsMutex);
    return wsConnections.size();
}

size_t EventManager::subscribe(EventSubscriber subscriber) {
    std::lock_guard<std::mutex> lock(subMutex);
    size_t id = nextSubscriberId++;
    subscribers.emplace_back(id, std::move(subscriber));
    return id;
}

void EventManager::unsubscribe(size_t subscriberId) {
    std::lock_guard<std::mutex> lock(subMutex);
    for (auto it = subscribers.begin(); it != subscribers.end(); ++it) {
        if (it->first == subscriberId) {
            subscribers.erase(it);
            break;
        }
    }
}

void EventManager::broadcast(const EnrichedEvent& event) {
    std::string jsonPayload = event.toJson();

    // 1. WebSocket broadcast
    {
        std::lock_guard<std::mutex> lock(wsMutex);
        for (auto* conn : wsConnections) {
            if (conn) {
                try {
                    conn->send_text(jsonPayload);
                } catch (const std::exception& e) {
                    std::cerr << "[EventManager] WebSocket broadcast error: " << e.what() << std::endl;
                }
            }
        }
    }

    // 2. Local Subscribers (SSE streams, testing callbacks)
    {
        std::lock_guard<std::mutex> lock(subMutex);
        for (const auto& subPair : subscribers) {
            try {
                subPair.second(event);
            } catch (...) {
                // Prevent subscriber exceptions from breaking algorithm execution
            }
        }
    }

    // 3. Append to history buffer
    {
        std::lock_guard<std::mutex> lock(historyMutex);
        recentHistory.push_back(event);
        if (recentHistory.size() > MAX_HISTORY) {
            recentHistory.pop_front();
        }
    }
}

std::vector<EnrichedEvent> EventManager::getRecentEvents(size_t limit) const {
    std::lock_guard<std::mutex> lock(historyMutex);
    size_t count = std::min(limit, recentHistory.size());
    std::vector<EnrichedEvent> result;
    result.reserve(count);

    auto startIt = recentHistory.end() - static_cast<long long>(count);
    for (auto it = startIt; it != recentHistory.end(); ++it) {
        result.push_back(*it);
    }
    return result;
}

void EventManager::clearHistory() {
    std::lock_guard<std::mutex> lock(historyMutex);
    recentHistory.clear();
}

} // namespace rangex
