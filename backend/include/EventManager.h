#ifndef RANGEX_EVENTMANAGER_H
#define RANGEX_EVENTMANAGER_H

#include "Event.h"
#include <string>
#include <vector>
#include <deque>
#include <unordered_set>
#include <functional>
#include <mutex>
#include <atomic>
#include <optional>
#include <chrono>

namespace crow {
namespace websocket {
    struct connection;
}
}

namespace rangex {

/**
 * @brief Rich frontend-facing event model agreed upon for visualization.
 * Encapsulates algorithm events originating from the custom AVL tree with
 * tracing IDs, sequence numbers, timestamps, and optional tree snapshots.
 */
struct EnrichedEvent {
    std::string eventId;
    std::string operationId;
    int sequenceNumber;
    std::string eventType;
    long long packageId;
    std::string message;
    long long timestampMs;

    // Node & rotation context
    std::optional<long long> nodeStart;
    std::optional<long long> nodeEnd;
    std::optional<long long> pivotStart;
    std::optional<long long> childStart;
    std::optional<long long> parentStart;

    // Snapshot of the AVL tree at this moment (if structural change occurred)
    std::string treeSnapshotJson;

    std::string toJson() const;
};

/**
 * @brief Thread-safe event bus and broadcast manager for real-time visualization.
 * Dispatches algorithm events from the AVL tree directly to WebSocket & SSE clients.
 */
class EventManager {
public:
    using EventSubscriber = std::function<void(const EnrichedEvent&)>;

    EventManager();
    ~EventManager();

    // Disable copy
    EventManager(const EventManager&) = delete;
    EventManager& operator=(const EventManager&) = delete;

    // --- Operation Lifecycle ---
    /**
     * @brief Begin a new insertion or search operation.
     * Generates a unique operation ID and resets sequence numbering.
     */
    std::string startOperation(long long packageId);

    /**
     * @brief Publish an algorithm event originating from the AVL tree.
     * Automatically assigns eventId, operationId, and sequenceNumber.
     */
    EnrichedEvent publishAlgorithmEvent(const AlgorithmEvent& rawEvent,
                                        const std::string& snapshotJson = "");

    /**
     * @brief Publish a custom system event (e.g. RESET, SYSTEM_CONNECTED).
     */
    EnrichedEvent publishSystemEvent(const std::string& type,
                                     long long packageId,
                                     const std::string& message,
                                     const std::string& snapshotJson = "");

    /**
     * @brief Finalize the active operation and return all events emitted during it.
     */
    std::vector<EnrichedEvent> finishOperation();

    // --- WebSocket Connection Management ---
    void addConnection(crow::websocket::connection* conn);
    void removeConnection(crow::websocket::connection* conn);
    size_t getConnectionCount() const;

    // --- SSE & In-Process Subscription ---
    size_t subscribe(EventSubscriber subscriber);
    void unsubscribe(size_t subscriberId);

    // --- Broadcast & History ---
    void broadcast(const EnrichedEvent& event);
    std::vector<EnrichedEvent> getRecentEvents(size_t limit = 100) const;
    void clearHistory();

private:
    mutable std::mutex wsMutex;
    std::unordered_set<crow::websocket::connection*> wsConnections;

    mutable std::mutex subMutex;
    std::vector<std::pair<size_t, EventSubscriber>> subscribers;
    size_t nextSubscriberId;

    mutable std::mutex opMutex;
    std::atomic<long long> globalEventCounter;
    std::string currentOperationId;
    int currentSequence;
    std::vector<EnrichedEvent> currentBatch;

    mutable std::mutex historyMutex;
    std::deque<EnrichedEvent> recentHistory;
    static constexpr size_t MAX_HISTORY = 500;

    std::string generateEventId();
    long long getCurrentTimestampMs() const;
};

} // namespace rangex

#endif // RANGEX_EVENTMANAGER_H
