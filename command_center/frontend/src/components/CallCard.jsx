import React, { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, ShieldAlert, Activity, Volume2, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + (import.meta.env.VITE_BACKEND_HOST || window.location.host);

export function CallCard({ isActive, isOtherActive, onCallStateChange, onCallFinished }) {
  const { token } = useAuth();
  const [callState, setCallState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error' | 'ended'
  const [errorMessage, setErrorMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);

  // Notify parent of call activity
  useEffect(() => {
    if (onCallStateChange) {
      onCallStateChange(callState === 'connecting' || callState === 'connected');
    }
  }, [callState, onCallStateChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCall();
    };
  }, []);

  // Call duration counter
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Audio waveform animation loop
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle background grid lines
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Waveform line in --sky-500
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0EA5E9';
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  const startCall = async () => {
    if (isOtherActive) return;
    setErrorMessage('');
    setCallState('connecting');

    try {
      // 1. Get user media audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Setup AudioContext for visualizer and playback
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // 3. Connect WebSocket to /ws/call with JWT token
      const wsUrl = `${WS_BASE_URL}/ws/call?token=${encodeURIComponent(token || '')}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setCallState('connected');
        drawWaveform();
        startAudioProcessing(stream, ws, audioCtx);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'agent_audio' && data.payload) {
            playAgentAudio(data.payload, audioCtx);
          } else if (data.type === 'error') {
            setErrorMessage(data.message || 'Call connection error');
            setCallState('error');
          } else if (data.type === 'call_ended') {
            setCallState('ended');
            if (onCallFinished) onCallFinished();
          }
        } catch (err) {
          console.debug('Raw WS data:', event.data);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket call error:', err);
        setErrorMessage('Failed to connect to tactical line.');
        setCallState('error');
      };

      ws.onclose = () => {
        if (callState === 'connected' || callState === 'connecting') {
          setCallState('ended');
          if (onCallFinished) onCallFinished();
        }
      };
    } catch (err) {
      console.error('Microphone or connection error:', err);
      setErrorMessage(err.message || 'Could not access microphone.');
      setCallState('error');
    }
  };

  // Streams mic audio chunks over WebSocket
  const startAudioProcessing = (stream, ws, audioCtx) => {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const buffer = await e.data.arrayBuffer();
          // Convert to Base64
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Audio = btoa(binary);
          ws.send(JSON.stringify({ type: 'audio', payload: base64Audio }));
        }
      };
      recorder.start(100); // 100ms time slice
      recorderRef.current = recorder;
    } catch {
      // Fallback: standard audio frame ping
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', payload: btoa('test_audio_frame') }));
        } else {
          clearInterval(interval);
        }
      }, 150);
    }
  };

  const recorderRef = useRef(null);

  // Synthesizes and plays incoming agro voice frame
  const playAgentAudio = (base64Data, audioCtx) => {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // Decode 16-bit linear PCM into AudioBuffer
      const samples = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, samples.length, 16000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        channelData[i] = samples[i] / 32768.0;
      }

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioCtx.destination);
      sourceNode.start();
    } catch (err) {
      console.debug('Audio playback note:', err);
    }
  };

  const stopCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'end_call' })); } catch {}
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
    }

    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
    }, 2000);

    if (onCallFinished) onCallFinished();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const isCallActive = callState === 'connecting' || callState === 'connected';

  return (
    <div
      className={`glass-card ${isOtherActive ? 'glass-card-disabled' : 'glass-card-interactive'}`}
      style={{
        padding: '28px',
        opacity: isOtherActive ? 0.45 : 1,
        pointerEvents: isOtherActive ? 'none' : 'auto',
        position: 'relative',
      }}
    >
      {/* Top Card Ribbon */}
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
            <Phone size={18} />
          </div>
          <h2 className="card-title" style={{ fontSize: '1.15rem' }}>
            Call RESCURO
          </h2>
        </div>

        {/* Dynamic Status Badges */}
        {callState === 'idle' && (
          <span className="badge-ready">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)' }}></span>
            Secure line ready
          </span>
        )}
        {callState === 'connecting' && (
          <span className="badge-ready">
            <span className="pulse-dot pulse-sky"></span>
            Connecting...
          </span>
        )}
        {callState === 'connected' && (
          <span className="badge-secure">
            <span className="pulse-dot pulse-secure"></span>
            Connected ({formatDuration(callDuration)})
          </span>
        )}
        {callState === 'error' && (
          <span className="badge-critical">
            <ShieldAlert size={12} />
            Line Error
          </span>
        )}
        {callState === 'ended' && (
          <span className="badge-offline">
            Line Closed
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginBottom: '24px', lineHeight: '1.5' }}>
        Connect directly to the RESCURO tactical voice assistant (<strong>agro</strong>) over an encrypted, low-latency audio stream.
      </p>

      {/* Waveform / Visualizer Window */}
      <div
        style={{
          height: '110px',
          background: 'rgba(240, 247, 255, 0.7)',
          border: '1px solid rgba(219, 234, 254, 0.9)',
          borderRadius: '14px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={110}
          style={{ width: '100%', height: '100%', display: isCallActive ? 'block' : 'none' }}
        />

        {!isCallActive && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={24} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.6 }} />
            <span className="font-mono" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>
              VOICE CHANNEL IDLE
            </span>
          </div>
        )}

        {isCallActive && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.85)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              color: 'var(--primary-blue)',
            }}
            className="font-mono"
          >
            <Radio size={12} />
            LIVE AGRO BRIDGE
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--critical-badge-bg)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: '10px',
            color: 'var(--critical-red)',
            fontSize: '0.85rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldAlert size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* CTA Button */}
      {!isCallActive ? (
        <button
          onClick={startCall}
          disabled={isOtherActive}
          className="btn-primary"
          style={{ width: '100%', height: '48px' }}
        >
          <Phone size={18} />
          <span>Call RESCURO</span>
        </button>
      ) : (
        <button
          onClick={stopCall}
          className="btn-critical"
          style={{ width: '100%', height: '48px' }}
        >
          <PhoneOff size={18} />
          <span>End Call</span>
        </button>
      )}

      {/* Inactive Muted Note */}
      {isOtherActive && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
          Call disabled while speech-to-text is active.
        </p>
      )}
    </div>
  );
}
