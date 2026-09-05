import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Trash2, Copy, Check, Sparkles, MessageSquare, Wifi, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + (import.meta.env.VITE_BACKEND_HOST || window.location.host);

export function TranscriptCard({ isActive, isOtherActive, onTranscriptStateChange }) {
  const { token } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [finalTranscripts, setFinalTranscripts] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [copied, setCopied] = useState(false);
  const [apiSupported, setApiSupported] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);

  const recognitionRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const wsRef = useRef(null);

  // Notify parent of active state
  useEffect(() => {
    if (onTranscriptStateChange) {
      onTranscriptStateChange(isListening);
    }
  }, [isListening, onTranscriptStateChange]);

  // Manage dedicated WebSocket to stream STT chunks live to RESCURO backend
  useEffect(() => {
    if (isListening) {
      const wsUrl = `${WS_BASE_URL}/ws/call?token=${encodeURIComponent(token || '')}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStreamConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Optional ack handling
        } catch {}
      };

      ws.onerror = () => {
        setStreamConnected(false);
      };

      ws.onclose = () => {
        setStreamConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end_call' }));
          ws.close();
        }
      };
    } else {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end_call' }));
        wsRef.current.close();
      }
      setStreamConnected(false);
    }
  }, [isListening, token]);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setApiSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentInterim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const textCleaned = transcriptSegment.trim();
          setFinalTranscripts((prev) => [
            ...prev,
            { text: textCleaned, timestamp },
          ]);
          setInterimText('');

          // Stream real-time chunk to backend -> broadcasts to Dispatcher Dashboard
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && textCleaned) {
            wsRef.current.send(JSON.stringify({
              type: 'transcript_stream',
              text: textCleaned,
              timestamp
            }));
          }
        } else {
          currentInterim += transcriptSegment;
        }
      }
      if (currentInterim) {
        setInterimText(currentInterim);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition event:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // If user still intended to listen, restart (continuous mode fallback)
      if (isListening) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [isListening]);

  // Auto scroll to bottom of transcript log
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [finalTranscripts, interimText]);

  const toggleListening = () => {
    if (isOtherActive) return;

    if (!apiSupported) {
      alert('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setInterimText('');
    } else {
      setIsListening(true);
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    }
  };

  const handleCopy = () => {
    const fullText = finalTranscripts.map((item) => `[${item.timestamp}] ${item.text}`).join('\n');
    if (fullText) {
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setFinalTranscripts([]);
    setInterimText('');
  };

  return (
    <div
      className={`glass-card ${isOtherActive ? 'glass-card-disabled' : 'glass-card-interactive'}`}
      style={{
        padding: '28px',
        opacity: isOtherActive ? 0.45 : 1,
        pointerEvents: isOtherActive ? 'none' : 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Ribbon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isListening ? 'var(--cyan-badge-bg)' : 'rgba(241, 245, 249, 0.9)',
              border: isListening ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(226, 232, 240, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isListening ? 'var(--cyan-badge-text)' : 'var(--text-secondary)',
              transition: 'all 0.3s ease',
            }}
          >
            <Mic size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Live Transcript
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
              Real-time speech to text (streams to Dispatcher)
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {isListening ? (
          <span className="badge badge-cyan" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={12} className="pulse-beacon" />
            LIVE STREAMING
          </span>
        ) : (
          <span className="badge badge-gray">STANDBY</span>
        )}
      </div>

      {/* Main Transcript Display Box */}
      <div
        ref={transcriptScrollRef}
        style={{
          flex: 1,
          minHeight: '260px',
          maxHeight: '260px',
          overflowY: 'auto',
          background: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.92rem',
        }}
      >
        {finalTranscripts.length === 0 && !interimText && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              padding: '20px',
              gap: '8px',
            }}
          >
            <MessageSquare size={32} style={{ opacity: 0.3, strokeWidth: 1.5 }} />
            <p style={{ margin: 0, fontWeight: '500' }}>No active speech detected.</p>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>
              Click "Start speech to text" below to stream live audio transcription to the dispatch console.
            </p>
          </div>
        )}

        {finalTranscripts.map((entry, index) => (
          <div
            key={index}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(240, 249, 255, 0.6)',
              borderLeft: '3px solid var(--primary-cyan)',
              color: 'var(--text-primary)',
              lineHeight: '1.5',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: 'var(--primary-cyan)',
                marginRight: '8px',
                fontWeight: '600',
              }}
            >
              [{entry.timestamp}]
            </span>
            <span>{entry.text}</span>
          </div>
        ))}

        {interimText && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(248, 250, 252, 0.8)',
              borderLeft: '3px dashed var(--text-tertiary)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}
          >
            <span>{interimText}</span>
          </div>
        )}
      </div>

      {/* Control Actions Ribbon */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
        <button
          onClick={toggleListening}
          disabled={isOtherActive}
          className={`tactical-btn ${isListening ? 'tactical-btn-danger' : 'tactical-btn-cyan'}`}
          style={{ flex: 1, padding: '13px' }}
        >
          {isListening ? (
            <>
              <MicOff size={18} />
              Stop speech to text
            </>
          ) : (
            <>
              <Mic size={18} />
              Start speech to text
            </>
          )}
        </button>

        <button
          onClick={handleCopy}
          disabled={finalTranscripts.length === 0}
          title="Copy transcript to clipboard"
          style={{
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '10px',
            color: copied ? 'var(--success-green)' : 'var(--text-secondary)',
            cursor: finalTranscripts.length === 0 ? 'not-allowed' : 'pointer',
            opacity: finalTranscripts.length === 0 ? 0.4 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>

        <button
          onClick={handleClear}
          disabled={finalTranscripts.length === 0 && !interimText}
          title="Clear transcript log"
          style={{
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '10px',
            color: 'var(--text-secondary)',
            cursor: finalTranscripts.length === 0 && !interimText ? 'not-allowed' : 'pointer',
            opacity: finalTranscripts.length === 0 && !interimText ? 0.4 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
