cmake_minimum_required(VERSION 3.15)
project(RangeX_Backend VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /O2)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -O3)
endif()

# Core AVL & Interval Library
add_library(rangex_core
    src/AVLTree.cpp
)

target_include_directories(rangex_core PUBLIC
    include
)

# CLI Application
add_executable(rangex_cli
    src/main.cpp
)
target_link_libraries(rangex_cli PRIVATE rangex_core)

# Test Suite
enable_testing()
add_executable(rangex_test
    tests/test_avl.cpp
)
target_link_libraries(rangex_test PRIVATE rangex_core)
add_test(NAME AVLCoreTests COMMAND rangex_test)
