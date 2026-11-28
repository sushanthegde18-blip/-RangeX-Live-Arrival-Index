cmake_minimum_required(VERSION 3.16)
project(RangeXLiveArrivalIndex VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MINGW OR CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

option(RANGEX_BUILD_TESTS "Build RangeX C++ core unit tests" ON)
option(RANGEX_BUILD_BACKEND "Build RangeX Crow REST API backend" ON)

if(RANGEX_BUILD_TESTS)
    enable_testing()
endif()

add_subdirectory(core)

if(RANGEX_BUILD_BACKEND)
    add_subdirectory(backend)
endif()
