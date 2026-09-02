# RESCURO — AI Emergency Command Center

RESCURO is a real-time AI emergency dispatch, voice triage, and telemetry command center designed for high-concurrency 911/112 emergency service networks. Built with React 18, Vite, GSAP physics animations, Tailwind CSS, and WebSockets.

---

## ⚡ Key Capabilities

- **Real-Time Telemetry Pipeline**: Live latency breakdown across Twilio SIP Trunk, Agora ANS, Deepgram Nova-2 STT, AI Triage LLM, and ElevenLabs TTS audio streaming.
- **GSAP Physics-Based Morphing**: Fluid card-to-page layout expansions with spring physics (`power3.out`), origin tracking (`getBoundingClientRect()`), and smooth exit morphing.
- **Role-Based Access Control (RBAC)**: Fine-grained security matrix (`SUPERVISOR`, `DISPATCHER`, `OPERATOR`, `GUEST`) safeguarding critical actions (Call Takeover, Whisper Prompt Injection, Multi-Agency Dispatch, Voice Engine Mute).
- **Live Stream Architecture**: Resilient WebSocket streaming service (`src/services/websocket.js`) with heartbeat monitoring, auto-reconnect, and fallback simulation.
- **Enterprise Design System**: Mission-critical aesthetics with SVG vector iconography, floating custom scrollbars, and high-density KPI monitoring.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Animation**: GSAP (GreenSock Animation Platform)
- **Real-Time Streaming**: WebSockets, Supabase State Synchronization
- **Telemetry & Audio**: WebRTC, Agora ANS, Deepgram STT, Opus Codec

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000/](http://localhost:3000/) in your browser.

### 3. Compile Production Bundle
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

---

## 📁 Project Architecture

```
rescuro/
├── css/
│   └── styles.css                  # Custom keyframes, floating scrollbars, radar pulse
├── src/
│   ├── components/
│   │   ├── AudioTimelineWidget.jsx # WebRTC waveform scrubber & audio player
│   │   ├── DataTables.jsx          # Live call queue & incident audit logs
│   │   ├── ExpansionModal.jsx      # GSAP physics-based card-to-page deep-dive modal
│   │   ├── Header.jsx              # Mission command header & telemetry ribbon
│   │   ├── PipelineTelemetryWidget.jsx # Real-time latency waterfall widget
│   │   ├── PrimaryCards.jsx        # Telemetry & workspace metric cards
│   │   ├── RBACGuard.jsx           # Component-level permission gate
│   │   ├── Sidebar.jsx             # Navigation sidebar with RBAC role simulator
│   │   ├── SupervisorControls.jsx  # Call intervention & override controls
│   │   └── Toast.jsx               # GSAP animated feedback notifications
│   ├── context/
│   │   ├── AuthContext.jsx         # RBAC roles, permissions, and active credentials
│   │   └── LiveStreamContext.jsx   # Live WebSocket pipeline latencies & chat deltas
│   ├── data/
│   │   └── mockData.js             # Initial emergency metrics & queue data
│   ├── services/
│   │   ├── supabase.js             # Supabase state synchronization & audit logger
│   │   └── websocket.js            # FastAPI WebSocket streaming service
│   ├── App.jsx                     # Root application container & modal coordinator
│   └── main.jsx                    # Vite React entry point & provider tree
├── index.html                      # Entry HTML with ambient glow washes
├── package.json                    # Dependencies & scripts
└── vite.config.js                  # Vite configuration
```
