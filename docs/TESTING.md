# RangeX Testing Guide

Run `run-tests.bat` or:
```powershell
$env:PATH = "C:\Program Files\CMake\bin;C:\TDM-GCC-64\bin;" + $env:PATH
cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build build -j4
ctest --test-dir build --output-on-failure -V
```
