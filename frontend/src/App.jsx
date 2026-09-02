import React, { useState, useEffect, useRef } from "react";

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [sessionId, setSessionId] = useState("No active session");
  const [callSid, setCallSid] = useState("-");
  const [callStatus, setCallStatus] = useState("IDLE");
  const [ttsHalted, setTtsHalted] = useState(false);

  const [sttConfidence, setSttConfidence] = useState(0.0);
  const [llmConfidence, setLlmConfidence] = useState(0.0);
  const [combinedConfidence, setCombinedConfidence] = useState(0.0);

  const [incident, setIncident] = useState("None detected");
  const [urgency, setUrgency] = useState("NORMAL");
  const [route, setRoute] = useState("automated");
  const [escalationReason, setEscalationReason] = useState("");
  const [matchedKeywords, setMatchedKeywords] = useState([]);

  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimer = null;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost:8000";
      const wsUrl = `${protocol}//${host}/ws/events`;

      setConnectionStatus("CONNECTING");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnectionStatus("CONNECTED");
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent(data);
        } catch (err) {
          console.error("Failed to parse event:", err);
        }
      };
      ws.onclose = () => {
        setConnectionStatus("DISCONNECTED");
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  function handleEvent(data) {
    const eventType = data.event_type || data.event || data.type;
    const payload = data.payload || {};
    const sid = data.session_id || payload.session_id;

    if (sid) setSessionId(sid);

    setRecentEvents((prev) => [
      { type: eventType, time: new Date().toLocaleTimeString(), payload: JSON.stringify(payload).slice(0, 100) },
      ...prev.slice(0, 19),
    ]);

    switch (eventType) {
      case "NEW_CALL":
      case "CALL_STARTED":
        setSessionId(sid || "ACTIVE_SESSION");
        setCallSid(payload.call_sid || "LIVE_CALL");
        setCallStatus("ACTIVE");
        setTtsHalted(false);
        setEmergencyAlert(null);
        setTranscripts([]);
        setRoute("automated");
        break;

      case "TRANSCRIPT_UPDATE":
      case "TRANSCRIPT_RECEIVED":
        if (payload.transcript) {
          const conf = payload.stt_confidence ?? 0.9;
          setSttConfidence(conf);
          setTranscripts((prev) => [
            { text: payload.transcript, confidence: conf, time: new Date().toLocaleTimeString() },
            ...prev,
          ]);
        }
        break;

      case "TRIAGE_UPDATE":
      case "TRIAGE_COMPLETED":
        if (payload.route) setRoute(payload.route);
        if (payload.combined_confidence !== undefined) setCombinedConfidence(payload.combined_confidence);
        if (payload.stt_confidence !== undefined) setSttConfidence(payload.stt_confidence);
        if (payload.llm_confidence !== undefined) setLlmConfidence(payload.llm_confidence);
        if (payload.priority) setUrgency(payload.priority);
        if (payload.reason) setEscalationReason(payload.reason);
        if (payload.matched_keywords) setMatchedKeywords(payload.matched_keywords);

        if (payload.route === "human_supervisor") {
          setEmergencyAlert({
            priority: payload.priority || "HIGH",
            reason: payload.reason || "Escalated",
            keywords: payload.matched_keywords || [],
          });
        }
        break;

      case "EMERGENCY_ALERT":
      case "EMERGENCY_DETECTED":
        setRoute("human_supervisor");
        setUrgency(payload.priority || "CRITICAL");
        if (payload.incident_type) setIncident(payload.incident_type);
        setEmergencyAlert({
          priority: payload.priority || "CRITICAL",
          reason: payload.reason || "Emergency alert detected",
          keywords: payload.matched_keywords || [],
        });
        break;

      case "CALL_STATUS":
        if (payload.status) setCallStatus(payload.status);
        if (payload.tts_halted !== undefined) setTtsHalted(payload.tts_halted);
        break;

      case "SUPERVISOR_CONNECTED":
        setCallStatus("SUPERVISOR_CONNECTED");
        setTtsHalted(true);
        setRoute("human_supervisor");
        break;

      case "CALL_ENDED":
        setCallStatus("COMPLETED");
        break;

      default:
        break;
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", background: "#0b0f19", color: "#fff", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2>Battle Buddy Realtime Dashboard</h2>
        <span style={{ padding: "4px 10px", borderRadius: "12px", background: connectionStatus === "CONNECTED" ? "#064e3b" : "#7f1d1d" }}>
          WS {connectionStatus}
        </span>
      </header>

      {emergencyAlert && (
        <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
          <h3>EMERGENCY ALERT: {emergencyAlert.priority}</h3>
          <p>{emergencyAlert.reason}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div style={{ background: "#111827", padding: "16px", borderRadius: "8px" }}>
          <h3>Session: {sessionId}</h3>
          <p>Call SID: {callSid}</p>
          <p>Status: {callStatus} {ttsHalted ? "(TTS HALTED)" : ""}</p>
          <p>Route: <strong>{route}</strong></p>
          <p>Incident: {incident} | Urgency: {urgency}</p>
          <hr style={{ margin: "10px 0", borderColor: "#374151" }} />
          <h4>Confidence Metrics (No Polling)</h4>
          <p>STT: {(sttConfidence * 100).toFixed(1)}%</p>
          <p>LLM: {(llmConfidence * 100).toFixed(1)}%</p>
          <p>Combined: {(combinedConfidence * 100).toFixed(1)}%</p>
          {escalationReason && <p>Reason: {escalationReason}</p>}
        </div>

        <div style={{ background: "#111827", padding: "16px", borderRadius: "8px" }}>
          <h3>Live Transcripts</h3>
          <div style={{ height: "200px", overflowY: "auto", background: "#000", padding: "10px", borderRadius: "4px" }}>
            {transcripts.map((t, idx) => (
              <div key={idx} style={{ marginBottom: "8px" }}>
                <small style={{ color: "#9ca3af" }}>[{t.time}] Conf: {(t.confidence * 100).toFixed(0)}%</small>
                <div>"{t.text}"</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
