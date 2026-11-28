add_library(rangex_core STATIC
    src/avl_interval_tree.cpp
)

target_include_directories(rangex_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_features(rangex_core PUBLIC cxx_std_17)

if(RANGEX_BUILD_TESTS)
    add_executable(rangex_core_tests
        tests/avl_interval_tree_tests.cpp
    )
    target_link_libraries(rangex_core_tests PRIVATE rangex_core)
    add_test(NAME rangex_core_tests COMMAND rangex_core_tests)
endif()
