add_library(rangex_backend_lib STATIC
    src/backend_service.cpp
)

target_include_directories(rangex_backend_lib
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    SYSTEM PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/json
)

target_link_libraries(rangex_backend_lib
    PUBLIC
        rangex_core
)

target_compile_features(rangex_backend_lib PUBLIC cxx_std_17)

add_executable(rangex_backend
    src/main.cpp
)

target_include_directories(rangex_backend
    SYSTEM PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/crow
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/asio
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/json
)

target_compile_definitions(rangex_backend
    PRIVATE
        ASIO_STANDALONE
        CROW_DISABLE_STATIC_DIR
)

if(WIN32)
    target_compile_definitions(rangex_backend
        PRIVATE
            WIN32_LEAN_AND_MEAN
            NOMINMAX
            _WIN32_WINNT=0x0601
    )
    target_link_libraries(rangex_backend
        PRIVATE
            rangex_backend_lib
            ws2_32
            mswsock
    )
else()
    find_package(Threads REQUIRED)
    target_link_libraries(rangex_backend
        PRIVATE
            rangex_backend_lib
            Threads::Threads
    )
endif()

if(RANGEX_BUILD_TESTS)
    add_executable(rangex_backend_tests
        tests/backend_service_tests.cpp
    )
    target_link_libraries(rangex_backend_tests PRIVATE rangex_backend_lib)
    add_test(NAME rangex_backend_tests COMMAND rangex_backend_tests)
endif()
