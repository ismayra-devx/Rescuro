import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Trash2, Copy, Check, Sparkles, MessageSquare } from 'lucide-react';

export function TranscriptCard({ isActive, isOtherActive, onTranscriptStateChange }) {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscripts, setFinalTranscripts] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [copied, setCopied] = useState(false);
  const [apiSupported, setApiSupported] = useState(true);

  const recognitionRef = useRef(null);
  const transcriptScrollRef = useRef(null);

  // Notify parent of active state
  useEffect(() => {
    if (onTranscriptStateChange) {
      onTranscriptStateChange(isListening);
    }
  }, [isListening, onTranscriptStateChange]);

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
          setFinalTranscripts((prev) => [
            ...prev,
            { text: transcriptSegment.trim(), timestamp },
          ]);
          setInterimText('');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--blue-badge-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-blue)',
            }}
          >
            <MessageSquare size={18} />
          </div>
          <h2 className="card-title" style={{ fontSize: '1.15rem' }}>
            Live Transcript
          </h2>
        </div>

        {/* Semantic Status Badge */}
        {isListening ? (
          <span className="badge-secure">
            <span className="pulse-dot pulse-sky"></span>
            Active
          </span>
        ) : (
          <span className="badge-offline">
            Paused
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginBottom: '18px', lineHeight: '1.5' }}>
        Real-time audio speech-to-text logging. Speak into your microphone to transcribe operations live.
      </p>

      {/* Transcript Scrolling Panel */}
      <div
        ref={transcriptScrollRef}
        style={{
          flex: '1',
          minHeight: '160px',
          maxHeight: '220px',
          background: 'rgba(255, 255, 255, 0.75)',
          border: '1px solid rgba(203, 213, 225, 0.6)',
          borderRadius: '14px',
          padding: '16px',
          overflowY: 'auto',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {finalTranscripts.length === 0 && !interimText && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Mic size={20} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.5 }} />
            <span>Click "Start speech to text" to stream transcripts</span>
          </div>
        )}

        {finalTranscripts.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'rgba(241, 245, 249, 0.9)',
                padding: '2px 6px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {item.timestamp}
            </span>
            <span style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: '1.4' }}>
              {item.text}
            </span>
          </div>
        ))}

        {interimText && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '0.75rem',
                color: 'var(--sky-500)',
                background: 'var(--blue-badge-bg)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              LIVE
            </span>
            <span
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
                lineHeight: '1.4',
              }}
            >
              {interimText}...
            </span>
          </div>
        )}
      </div>

      {/* Control Actions Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={toggleListening}
          disabled={isOtherActive}
          className="btn-primary"
          style={{ flex: 1, height: '48px' }}
        >
          {isListening ? (
            <>
              <MicOff size={18} />
              <span>Stop speech to text</span>
            </>
          ) : (
            <>
              <Mic size={18} />
              <span>Start speech to text</span>
            </>
          )}
        </button>

        {finalTranscripts.length > 0 && (
          <>
            <button
              onClick={handleCopy}
              className="btn-secondary"
              style={{ height: '48px', padding: '0 14px' }}
              title="Copy transcript to clipboard"
            >
              {copied ? <Check size={16} style={{ color: 'var(--status-secure)' }} /> : <Copy size={16} />}
            </button>
            <button
              onClick={handleClear}
              className="btn-secondary"
              style={{ height: '48px', padding: '0 14px' }}
              title="Clear transcript history"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {/* Inactive Muted Note */}
      {isOtherActive && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
          Speech-to-text disabled while call is active.
        </p>
      )}
    </div>
  );
}
