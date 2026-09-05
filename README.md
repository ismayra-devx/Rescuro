# RESCURO — AI Emergency Command Center

RESCURO is an AI-powered emergency command center that automates the first stage of emergency call triage while keeping human dispatchers and supervisors in control.

A caller does **not** need an app, website, or dashboard. They can use a normal phone to call the RESCURO emergency number. The call is connected to the voice AI, converted into structured emergency information, and surfaced to the command center for dispatch and human intervention.

---

## How It Works

```text
Caller
  │
  │ Normal phone call
  ▼
Exotel Voice Network
  │
  │ Bidirectional audio stream
  ▼
RESCURO FastAPI Backend
  │
  ├── Speech-to-Text
  ├── Emergency Triage / AI Orchestrator
  ├── Text-to-Speech
  │
  ▼
Caller receives voice response
  │
  ▼
Command Center Dashboard
  │
  ├── Live incidents
  ├── Call telemetry
  ├── AI transcript / response
  ├── Dispatcher controls
  └── Supervisor intervention
  ---

## Core Features

### AI Voice Triage

RESCURO listens to the caller, detects when they have finished speaking, transcribes the completed turn, and sends it through the emergency-triage pipeline.

### Real-Time Command Center

The dashboard provides live visibility into active calls, incidents, telemetry, transcripts, and system status.

### Human-in-the-Loop Dispatch

AI handles the initial triage, while dispatchers and supervisors remain able to intervene and take control when required.

### Role-Based Access Control

The system supports role-based permissions for operational users such as supervisors, dispatchers, operators, and guests.

### Live WebSocket Streaming

The frontend connects to the FastAPI backend for real-time call and telemetry updates with reconnect handling.

### Call Turn Detection

The voice pipeline processes complete caller turns instead of responding to every incoming audio packet. This prevents repeated AI responses while the caller is still speaking.

---

## Technology Stack

### Frontend

- React 18
- Vite
- Framer Motion
- GSAP
- Lucide React
- Three.js
- WebSockets

### Backend

- Python
- FastAPI
- Uvicorn
- WebSockets
- Pydantic Settings
- SQLite
- aiosqlite
- JWT Authentication
- bcrypt

### Voice Pipeline

- Exotel AgentStream Voicebot
- Bidirectional WebSocket Audio Streaming
- PCM 16-bit / 8 kHz / Mono Audio
- Speech-to-Text
- AI Emergency Triage
- Text-to-Speech

The backend supports provider configuration through environment variables, including Deepgram, OpenAI, and ElevenLabs.

---

## Repository Structure

```text
Rescuro/
├── app/
│   ├── api/
│   │   ├── auth.py
│   │   ├── calls.py
│   │   ├── dashboard_ws.py
│   │   ├── exotel.py          # Exotel AgentStream WebSocket
│   │   └── vobiz.py           # Legacy telephony integration
│   ├── main.py                # FastAPI application entry point
│   └── ...
│
├── frontend/                  # React frontend
├── css/                       # UI styles
├── public/                    # Static assets
├── schema.sql                 # Database schema
├── rescuro.db                 # Local SQLite database
├── requirements.txt           # Python dependencies
├── package.json               # Frontend dependencies
├── .env.example               # Environment template
└── README.md
```

---

## Running Locally

### Backend

Create a Python virtual environment and install the dependencies:

```bash
pip install -r requirements.txt
```

Copy the environment template:

```bash
cp .env.example .env
```

Configure the required provider keys and application settings inside `.env`.

Start the backend:

```bash
uvicorn app.main:app --reload
```

The backend provides:

```text
GET /health
WS  /exotel/media
```

### Frontend

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production frontend:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## Environment Variables

The main configuration is provided through environment variables.

Example:

```env
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=*

JWT_SECRET=<strong-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

DATABASE_URL=sqlite+aiosqlite:///./rescuro.db

STT_PROVIDER=stub
DEEPGRAM_API_KEY=<key>
OPENAI_API_KEY=<key>

TTS_PROVIDER=stub
ELEVENLABS_API_KEY=<key>
ELEVENLABS_VOICE_ID=<voice-id>
```

Use `.env.example` as the source of truth for available configuration.

**Never commit real API keys, tokens, passwords, or service-account credentials to GitHub.**

---

## Exotel Integration

RESCURO currently uses **Exotel AgentStream** for the phone-to-AI connection.

The Exotel Voicebot applet connects to:

```text
wss://<backend-domain>/exotel/media
```

The backend handles the AgentStream lifecycle, including:

- Connection
- Call Start
- Audio Media
- DTMF
- Marks
- Clear Events
- Call Stop

Audio is processed as raw PCM16, 8 kHz, mono audio.

The backend performs:

```text
Caller Speech
     ↓
Audio Buffer
     ↓
Speech Detection
     ↓
Speech-to-Text
     ↓
AI Emergency Triage
     ↓
Text-to-Speech
     ↓
Audio Response
     ↓
Caller
```

For production, the WebSocket endpoint must be publicly reachable over secure WebSockets (`wss://`).

---

## Production Deployment

The backend can be deployed using **Google Cloud Run**.

Recommended setup:

1. Create a Google Cloud project.
2. Enable Cloud Run and Secret Manager.
3. Deploy the FastAPI backend to Cloud Run.
4. Store provider credentials in Secret Manager.
5. Grant the Cloud Run service account access to the required secrets.
6. Configure the required environment variables.
7. Use the Cloud Run HTTPS domain for the secure Exotel WebSocket endpoint.
8. Configure the Exotel Voicebot applet with the production `wss://` endpoint.

Production WebSocket deployments should account for:

- Request timeouts
- Long-running call sessions
- WebSocket reconnects
- Instance lifecycle
- Secure secret management

---

## Security

RESCURO handles emergency-call data and operational controls.

Production deployments should:

- Keep API credentials outside source control.
- Use Secret Manager or another secure secret store.
- Use HTTPS/WSS for external communication.
- Use strong JWT secrets.
- Apply role-based permissions.
- Never expose provider credentials in frontend code.
- Never place credentials in README files, commits, screenshots, or chat messages.

---

## Current Status

RESCURO currently has an end-to-end voice prototype using Exotel AgentStream:

```text
Normal Phone Call
       ↓
     Exotel
       ↓
RESCURO WebSocket
       ↓
Speech Recognition
       ↓
AI Emergency Triage
       ↓
Text-to-Speech
       ↓
Audio Returned to Caller
```

The command-center frontend and FastAPI backend provide the operational layer around this voice pipeline.

---

## Project Goal

RESCURO is built around one simple principle:

> **In an emergency, the caller should only need a normal phone.**

The intelligence and operational complexity stay behind the scenes, while dispatchers and supervisors retain control over critical decisions.
