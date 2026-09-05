# RESCURO Command Center — Standalone User-Facing Dashboard

A modern, standalone operational command center dashboard for RESCURO dispatch and tactical field personnel. Built using the **Ethereal Tactical Light / Clinical Enterprise Glassmorphism** design system with frosted glass panels, ambient glow depth, and hairline borders.

---

## ⚡ Core Features

- **Full-Stack Security & Auth**:
  - `POST /api/auth/signup` and `POST /api/auth/login`
  - 12-round `bcrypt` password hashing
  - HMAC-SHA256 JWT access tokens with 24-hour validity
  - Protected API routes and WebSocket handshake authentication
- **Tactical Design System**:
  - Canvas: `--bg-app: #EEF4FA` with radial ambient glows
  - Frosted glass cards: `--bg-card-glass: rgba(255, 255, 255, 0.86)` with `backdrop-filter: blur(24px)`
  - Typography: `Inter` ExtraBold headings, `JetBrains Mono` telemetry readouts
  - Color discipline: Blue for active/operational states, Green for secure sessions, Amber for paused/standby, Red strictly reserved for P1/emergency
- **Call RESCURO**:
  - Live microphone streaming via authenticated WebSocket (`/ws/call?token=...`)
  - Bidirectional audio bridge to the "agro" voice AI assistant
  - Real-time HTML5 Canvas audio oscilloscope visualizer in `--sky-500`
  - Persistent call activity logs (ID, timestamp, duration, status) stored in SQLite (`rescuro_command.db`)
- **Live Transcript**:
  - Web Speech API continuous speech recognition
  - Real-time distinction between interim (italic light) and final (bold primary) speech
  - One-click copy and clear controls
- **Mutual Exclusion**:
  - Hardware microphone channels are prioritized: only Call or Speech-to-Text can be active at one time. Inactive channel is automatically muted and disabled.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Lucide React
- **Backend**: Python, FastAPI, SQLite, Pydantic v2, PyJWT, Bcrypt, WebSockets, NumPy
- **Deployment Agnostic**:
  - Backend: Deploy to Render / Fly.io / AWS using `python -m uvicorn app.main:app --port $PORT`
  - Frontend: Deploy to Vercel / Netlify with `VITE_BACKEND_URL` and `VITE_WS_URL`

---

## 🚀 Running Locally

### 1. Launch Backend
```bash
cd command_center/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8080 --reload
```
API Documentation available at: `http://localhost:8080/docs`

### 2. Launch Frontend
```bash
cd command_center/frontend
npm install
npm run dev
```
Open [http://localhost:5174](http://localhost:5174) in your browser.

Or double-click `run_command_center.bat` on Windows.
