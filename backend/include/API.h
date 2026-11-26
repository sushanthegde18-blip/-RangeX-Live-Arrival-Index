#ifndef RANGEX_API_H
#define RANGEX_API_H

#include "WarehouseManager.h"
#include "EventManager.h"
#include <string>
#include <memory>
#include <thread>

#if __has_include("../thirdparty/crow/crow_all.h")
#include "../thirdparty/crow/crow_all.h"
#elif __has_include("crow.h")
#include "crow.h"
#elif __has_include("crow/app.h")
#include "crow/app.h"
#endif

namespace rangex {

/**
 * @brief REST API and WebSocket Server for RANGEX.
 * Exposes Member 1's AVL tree warehouse engine to the React frontend.
 */
class API {
public:
    API(WarehouseManager& wm, EventManager& em, int port = 8080);
    ~API();

    // Disable copy
    API(const API&) = delete;
    API& operator=(const API&) = delete;

    /**
     * @brief Configure all REST endpoints, WebSocket routes, and CORS middleware.
     */
    void setupRoutes();

    /**
     * @brief Run the server on the configured port (blocking call).
     */
    void run();

    /**
     * @brief Run the server in a dedicated background thread (non-blocking).
     */
    void runAsync();

    /**
     * @brief Stop the server gracefully.
     */
    void stop();

    int getPort() const { return port; }
    crow::SimpleApp& getApp() { return app; }

private:
    WarehouseManager& warehouseManager;
    EventManager& eventManager;
    int port;
    crow::SimpleApp app;
    std::unique_ptr<std::thread> serverThread;

    static void setCorsHeaders(crow::response& res);
    static crow::response makeJsonResponse(int statusCode, const std::string& body);
    static crow::response makeErrorResponse(int statusCode, const std::string& error, const std::string& message);
};

} // namespace rangex

#endif // RANGEX_API_H
