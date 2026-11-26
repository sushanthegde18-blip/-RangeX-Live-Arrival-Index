cmake_minimum_required(VERSION 3.15)
project(RangeX_Backend VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /O2 /permissive-)
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -O3)
endif()

find_package(Threads REQUIRED)

include(FetchContent)

# Provide standalone Asio (header-only) for Crow
FetchContent_Declare(
    asio
    GIT_REPOSITORY https://github.com/chriskohlhoff/asio.git
    GIT_TAG asio-1-28-0
)
FetchContent_GetProperties(asio)
if(NOT asio_POPULATED)
    FetchContent_Populate(asio)
    add_library(asio INTERFACE)
    add_library(asio::asio ALIAS asio)
    target_include_directories(asio INTERFACE ${asio_SOURCE_DIR}/asio/include)
    target_compile_definitions(asio INTERFACE ASIO_STANDALONE)
    set(ASIO_INCLUDE_DIR "${asio_SOURCE_DIR}/asio/include" CACHE PATH "asio include dir" FORCE)
endif()

# Crow Framework options
set(CROW_INSTALL OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_TESTS OFF CACHE BOOL "" FORCE)

find_package(Crow QUIET)
if(NOT Crow_FOUND)
    FetchContent_Declare(
        Crow
        GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
        GIT_TAG v1.2.0
    )
    FetchContent_MakeAvailable(Crow)
endif()

# Core AVL, Warehouse, and Event Library
add_library(rangex_core
    src/AVLTree.cpp
    src/EventManager.cpp
    src/WarehouseManager.cpp
)

target_include_directories(rangex_core PUBLIC
    include
    thirdparty
    ${ASIO_INCLUDE_DIR}
)

target_compile_definitions(rangex_core PUBLIC ASIO_STANDALONE)

target_link_libraries(rangex_core PUBLIC
    Threads::Threads
    asio
    $<$<TARGET_EXISTS:Crow::Crow>:Crow::Crow>
)

if(WIN32)
    target_link_libraries(rangex_core PUBLIC ws2_32 wsock32)
endif()

# Member 1: Interactive CLI Application
add_executable(rangex_cli
    src/cli.cpp
)
target_link_libraries(rangex_cli PRIVATE rangex_core)

# Member 2: Full Web Backend & WebSocket Server
add_executable(rangex_server
    src/API.cpp
    src/main.cpp
)
target_link_libraries(rangex_server PRIVATE
    rangex_core
    $<$<TARGET_EXISTS:Crow::Crow>:Crow::Crow>
)

# Test Suites
enable_testing()

# Member 1 AVL Test Suite (both rangex_test and rangex_test_avl for backward compatibility)
add_executable(rangex_test
    tests/test_avl.cpp
)
target_link_libraries(rangex_test PRIVATE rangex_core)
add_test(NAME AVLCoreTests COMMAND rangex_test)

add_executable(rangex_test_avl
    tests/test_avl.cpp
)
target_link_libraries(rangex_test_avl PRIVATE rangex_core)

# Member 2 Backend API & Concurrency Test Suite
add_executable(rangex_test_backend
    tests/test_backend.cpp
)
target_link_libraries(rangex_test_backend PRIVATE rangex_core)
add_test(NAME BackendAPITests COMMAND rangex_test_backend)
