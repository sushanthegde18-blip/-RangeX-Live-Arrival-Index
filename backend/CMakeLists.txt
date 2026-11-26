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

# Crow Framework
find_package(Crow QUIET)
if(NOT Crow_FOUND)
    include(FetchContent)
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
)

target_link_libraries(rangex_core PUBLIC
    Threads::Threads
    $<$<TARGET_EXISTS:Crow::Crow>:Crow::Crow>
)

if(WIN32)
    target_link_libraries(rangex_core PUBLIC ws2_32 wsock32)
endif()

# Full Web Backend & WebSocket Server
add_executable(rangex_server
    src/API.cpp
    src/main.cpp
)
target_link_libraries(rangex_server PRIVATE
    rangex_core
    $<$<TARGET_EXISTS:Crow::Crow>:Crow::Crow>
)

# Test Suite
enable_testing()

add_executable(rangex_test_avl
    tests/test_avl.cpp
)
target_link_libraries(rangex_test_avl PRIVATE rangex_core)
add_test(NAME AVLCoreTests COMMAND rangex_test_avl)

add_executable(rangex_test_backend
    tests/test_backend.cpp
)
target_link_libraries(rangex_test_backend PRIVATE rangex_core)
add_test(NAME BackendAPITests COMMAND rangex_test_backend)
