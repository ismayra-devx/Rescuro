@echo off
echo =========================================================
echo Starting RESCURO Command Center (Standalone Full-Stack)
echo =========================================================

echo [1/2] Launching FastAPI Backend on http://localhost:8080 ...
start "RESCURO Backend" cmd /k "cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"

echo [2/2] Launching React Vite Frontend on http://localhost:5174 ...
start "RESCURO Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 3 >nul
echo Opening RESCURO Command Center in browser...
start http://localhost:5174

echo =========================================================
echo RESCURO Command Center is live:
echo Frontend: http://localhost:5174
echo Backend:  http://localhost:8080
echo =========================================================
