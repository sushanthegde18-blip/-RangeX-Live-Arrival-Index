@echo off
setlocal
set "PATH=C:\Program Files\CMake\bin;C:\TDM-GCC-64\bin;%PATH%"
cd /d "%~dp0"

if not exist "build\backend\rangex_backend.exe" (
    echo [RangeX] Building C++17 core and Crow backend...
    cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release || exit /b 1
    cmake --build build -j4 || exit /b 1
)

echo [RangeX] Starting C++17 Crow backend on http://127.0.0.1:8080 ...
"%~dp0build\backend\rangex_backend.exe"
