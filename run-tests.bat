@echo off
setlocal
set "PATH=C:\Program Files\CMake\bin;C:\TDM-GCC-64\bin;%PATH%"
cd /d "%~dp0"

echo [RangeX] Configuring and building C++17 core + backend tests...
cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release || exit /b 1
cmake --build build -j4 || exit /b 1

echo [RangeX] Running CTest suite...
ctest --test-dir build --output-on-failure -V || exit /b 1

echo [RangeX] All C++ core and backend tests passed!
