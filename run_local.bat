@echo off
echo ===================================================
echo Starting EchoSphere AI Live Unified Dashboard
echo ===================================================

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "EchoSphere Backend" cmd /k "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting React Frontend on http://localhost:5173 ...
cd frontend
start "EchoSphere Frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"
cd ..

timeout /t 3 >nul
echo Opening Dashboard in your browser...
start http://localhost:5173

echo ===================================================
echo EchoSphere is now running live!
echo Dashboard: http://localhost:5173
echo API / WS:  http://localhost:8000
echo ===================================================
