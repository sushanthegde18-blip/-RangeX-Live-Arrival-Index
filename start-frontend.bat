@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [RangeX] Installing frontend npm dependencies...
    call npm install || exit /b 1
)

echo [RangeX] Starting Vite dev server on http://localhost:5173 ...
call npm run dev
