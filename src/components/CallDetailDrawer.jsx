import React, { useState, useEffect } from 'react';
import { 
    X, 
    PhoneCall, 
    Radio, 
    Headphones, 
    Send, 
    ShieldAlert, 
    ShieldCheck,
    MapPin, 
    Clock, 
    Activity, 
    CheckCircle2, 
    AlertTriangle,
    Mic,
    Volume2,
    Sliders,
    FileText
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';
import { SupervisorAudioBar } from './SupervisorAudioBar';

export const CallDetailDrawer = ({ call: initialCall, isOpen, onClose, onToast }) => {
    const { 
        activeCalls, 
        takeOverCall, 
        releaseCallToAi, 
        resolveCall, 
        transcriptSegments,
        isSupervisorMicMuted,
        isSupervisorOnHold
    } = useLiveStream();

    const [whisperInput, setWhisperInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [dispatched, setDispatched] = useState(false);
    const [caseHandled, setCaseHandled] = useState(false);
    const [reviewApproved, setReviewApproved] = useState(false);

    // Two-Way Waveform Amplitude States
    const [callerWf, setCallerWf] = useState([35, 60, 25, 80, 55, 90, 45, 70, 30, 85, 40, 65]);
    const [supervisorWf, setSupervisorWf] = useState([20, 45, 30, 75, 50, 85, 40, 65, 35, 80, 25, 50]);

    // Live reactive call object from activeCalls list
    const call = activeCalls?.find(c => c.id === initialCall?.id) || initialCall;

    // Reset local action states when switching between calls
    useEffect(() => {
        setDispatched(false);
        setCaseHandled(false);
        setReviewApproved(false);
    }, [call?.id]);

    // Keyboard ESC listener to close drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Two-way dynamic waveform animation
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            // Caller incoming voice jitter
            setCallerWf(prev => prev.map(() => Math.floor(Math.random() * 65) + 25));

            // Supervisor outgoing voice jitter (flattens if muted or on hold)
            if (isSupervisorMicMuted || isSupervisorOnHold) {
                setSupervisorWf(new Array(12).fill(10));
            } else {
                setSupervisorWf(prev => prev.map(() => Math.floor(Math.random() * 70) + 20));
            }
        }, 110);
        return () => clearInterval(interval);
    }, [isOpen, isSupervisorMicMuted, isSupervisorOnHold]);

    if (!isOpen || !call) return null;

    // Dynamic Risk Tier calculation
    const riskTier = (call.risk === 'HIGH' || call.urgency === 'CRITICAL' || call.urgency === 'HIGH')
        ? 'CRITICAL'
        : (call.risk === 'REVIEW' || call.urgency === 'MEDIUM')
        ? 'REVIEW'
        : 'STABLE';

    const isHighRisk = riskTier === 'CRITICAL';
    const isReview = riskTier === 'REVIEW';
    const isStable = riskTier === 'STABLE';
    const isOverridden = !!call.supervisorOverridden;

    const handleSendWhisper = (e) => {
        e.preventDefault();
        if (!whisperInput.trim()) return;
        if (onToast) onToast(`Whisper guidance injected: "${whisperInput}"`, 'mic');
        setWhisperInput('');
    };

    const handleTakeoverToggle = () => {
        if (!isOverridden) {
            takeOverCall(call.id);
            if (onToast) onToast(`Supervisor SUP-004 took over Line ${call.id} (Live Audio Linked)`, 'zap');
        } else {
            releaseCallToAi(call.id);
            if (onToast) onToast(`Call control returned to Autonomous AI Voice Engine (${call.agent})`, 'check');
        }
    };

    const handleDispatch = () => {
        setDispatched(true);
        if (onToast) onToast(`Dispatched Emergency Units (PCR-14 & Amb-02) to ${call.location}`, 'siren');
    };

    const handleReviewAction = () => {
        setReviewApproved(true);
        if (onToast) onToast(`Supervisor approved AI triage & escalated unit dispatch for ${call.id}`, 'check');
    };

    const handleLogAndClose = () => {
        setCaseHandled(true);
        if (onToast) onToast(`Case ${call.id} resolved by AI & logged to central registry`, 'check');
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div 
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/25 backdrop-blur-xs transition-opacity duration-300"
            />

            {/* Slide-Over Context Drawer */}
            <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 flex flex-col bg-white/85 backdrop-blur-2xl border-l border-white/90 shadow-[-12px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out overflow-hidden">
                
                {/* 1. Drawer Header Bar (Instant Visual State Transition) */}
                <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 transition-all ${
                    isOverridden 
                        ? 'bg-blue-50/70 border-blue-200/80 backdrop-blur-md' 
                        : 'bg-white/60 border-slate-100/80 backdrop-blur-md'
                }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl text-white shadow-xs flex-shrink-0 transition-all ${
                            isOverridden 
                                ? 'bg-blue-600 ring-2 ring-blue-400/40 shadow-blue-500/20' 
                                : isHighRisk 
                                ? 'bg-rose-600' 
                                : isReview 
                                ? 'bg-amber-500' 
                                : 'bg-indigo-600'
                        }`}>
                            <PhoneCall className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-mono font-black text-sm text-slate-900 tracking-tight">{call.id}</h3>
                                
                                {/* Status Indicator Badge */}
                                {isOverridden ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100/90 text-blue-900 border border-blue-300 shadow-xs ring-1 ring-blue-400/20">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                        </span>
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-tight">
                                            Supervisor Active
                                        </span>
                                    </div>
                                ) : (
                                    <span className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs ${
                                        isHighRisk 
                                            ? 'bg-rose-600 text-white' 
                                            : isReview 
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}>
                                        {isHighRisk ? 'CRITICAL' : isReview ? 'REVIEW' : 'STABLE'}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{call.incident}</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 border border-transparent hover:border-slate-200 transition-all flex-shrink-0"
                        title="Close Drawer (ESC)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Drawer Scrollable Body */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-smooth-scroll">
                    
                    {/* 2. Embedded In-Browser Audio Control Toolbar (When Active or Expandable) */}
                    {isOverridden ? (
                        <SupervisorAudioBar 
                            callId={call.id} 
                            call={call} 
                            onToast={onToast} 
                            variant="drawer" 
                        />
                    ) : (
                        /* Standby Audio Override Prompt Card */
                        <div className="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    <Headphones className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-mono font-bold text-slate-900">AI Autonomous Audio Channel</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">{call.agent} managing live voice stream</p>
                                </div>
                            </div>
                            <button
                                onClick={handleTakeoverToggle}
                                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center flex-shrink-0"
                            >
                                <span>Take Over</span>
                            </button>
                        </div>
                    )}

                    {/* 3. Real-Time Telemetry Grid (4 Tiles) */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-white/70 border border-white/80 shadow-2xs">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Round-Trip Latency</span>
                            <span className="font-mono font-black text-base text-indigo-600">11.8ms</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Zero Jitter Buffer</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/70 border border-white/80 shadow-2xs">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Voice Codec</span>
                            <span className="font-mono font-black text-base text-slate-900">Opus 24kHz</span>
                            <span className="text-[10px] text-slate-500 font-mono block">WebRTC Direct Ingest</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/70 border border-white/80 shadow-2xs">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">WER Accuracy</span>
                            <span className="font-mono font-black text-base text-blue-600">99.4%</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Deepgram Nova-2</span>
                        </div>

                        {/* Telemetry Tile 4: Swaps AI Agent Avatar with Glowing Supervisor Indicator */}
                        {isOverridden ? (
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50/90 to-sky-50/70 border border-blue-200/90 shadow-2xs ring-1 ring-blue-500/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 block">Live Voice Lead</span>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black shadow-xs">
                                        SUP
                                    </div>
                                    <span className="font-mono font-black text-sm text-blue-950 truncate">SUP-004 (Supervisor)</span>
                                </div>
                                <span className="text-[10px] text-blue-600 font-mono font-bold block mt-0.5">Live Audio Linked</span>
                            </div>
                        ) : (
                            <div className="p-3 rounded-xl bg-white/70 border border-white/80 shadow-2xs">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Assigned Agent</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono font-black text-sm text-indigo-600 truncate">{call.agent}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Auto Triage Active</span>
                            </div>
                        )}
                    </div>

                    {/* 4. Caller & Tactical Location Card */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-white/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100/80">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Caller Identification</span>
                            <span className="font-mono font-bold text-slate-900">{call.caller}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                <strong className="text-slate-800 font-semibold">{call.location}</strong>
                            </span>
                            <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/60">
                                {call.lang}
                            </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50/80 border border-slate-200/60 text-[11px] text-slate-600 italic">
                            "{call.snippet}"
                        </div>
                    </div>

                    {/* 5. Live Two-Way Audio Waveform & Spectral Telemetry Display */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-white/80 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                                {isOverridden ? 'Two-Way Full-Duplex Voice Stream' : 'Live Spectral Stream'}
                            </span>
                            <button
                                onClick={() => {
                                    setIsListening(prev => !prev);
                                    if (onToast) onToast(isListening ? 'Muted audio monitor' : 'Patched into audio feed', 'listen');
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all flex items-center gap-1 ${
                                    isListening 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                }`}
                            >
                                <Headphones className="w-3 h-3" /> {isListening ? 'Monitoring Audio' : 'Listen In'}
                            </button>
                        </div>

                        {/* Dual Two-Way Audio Waveform Visualization */}
                        {isOverridden ? (
                            <div className="space-y-2.5">
                                {/* Supervisor Tx (Uplink) Channel */}
                                <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/70 space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="font-bold text-blue-900 flex items-center gap-1">
                                            <Mic className="w-3 h-3 text-blue-600" /> Supervisor Uplink (Tx)
                                        </span>
                                        <span className="text-blue-700 font-semibold">
                                            {isSupervisorMicMuted ? 'MUTED' : isSupervisorOnHold ? 'ON HOLD' : '-14 dBFS'}
                                        </span>
                                    </div>
                                    <div className="h-8 bg-white/70 rounded-lg flex items-center justify-center gap-1.5 px-2">
                                        {supervisorWf.map((h, i) => (
                                            <div
                                                key={i}
                                                className={`w-1.5 rounded-full transition-all duration-100 ${
                                                    isSupervisorMicMuted 
                                                        ? 'bg-rose-300' 
                                                        : isSupervisorOnHold 
                                                        ? 'bg-amber-400' 
                                                        : 'bg-gradient-to-t from-sky-400 via-sky-500 to-blue-600'
                                                }`}
                                                style={{ height: `${h}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Caller Rx (Downlink) Channel */}
                                <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/70 space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="font-bold text-indigo-800 flex items-center gap-1">
                                            <PhoneCall className="w-3 h-3 text-indigo-600" /> Caller Inbound (Rx)
                                        </span>
                                        <span className="text-indigo-700 font-semibold">-19 dBFS</span>
                                    </div>
                                    <div className="h-8 bg-white/70 rounded-lg flex items-center justify-center gap-1.5 px-2">
                                        {callerWf.map((h, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 bg-gradient-to-t from-indigo-600 to-blue-500 rounded-full transition-all duration-100"
                                                style={{ height: `${h}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Standard Single Stream Waveform */
                            <div className="h-10 bg-slate-50 rounded-lg border border-slate-200/60 flex items-center justify-center gap-1.5 px-3">
                                {callerWf.map((h, i) => (
                                    <div
                                        key={i}
                                        className="w-1.5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-full transition-all duration-100"
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 6. Live Speech-to-Text Transcription Stream */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-white/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-blue-600" /> Real-Time Transcription
                            </span>
                            <span className="text-[10px] font-mono text-blue-700 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Live Stream
                            </span>
                        </div>

                        <div className="space-y-2 text-xs max-h-40 overflow-y-auto pr-1 custom-smooth-scroll">
                            {(transcriptSegments || []).slice(-4).map((item, idx) => (
                                <div key={idx} className={`p-2 rounded-lg text-xs leading-relaxed ${
                                    item.isAi 
                                        ? 'bg-indigo-50/80 border border-indigo-100/70 text-indigo-900 ml-3' 
                                        : 'bg-slate-50 border border-slate-200/60 text-slate-800 mr-3'
                                }`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                                            {item.author}
                                        </span>
                                    </div>
                                    {item.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 7. Whisper Guidance Input */}
                    <form onSubmit={handleSendWhisper} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Whisper instructions directly into Agent's ear..."
                                value={whisperInput}
                                onChange={(e) => setWhisperInput(e.target.value)}
                                className="flex-1 text-xs font-mono px-3 py-2 rounded-xl bg-white/80 border border-slate-200/80 focus:outline-none focus:border-indigo-500 shadow-2xs"
                            />
                            <button
                                type="submit"
                                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs"
                                title="Send Whisper"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </form>
                </div>

                {/* 8. Dynamic Context-Aware Action Footer (Pinned to Bottom) */}
                <div className="p-4 border-t border-slate-200/80 bg-white/90 backdrop-blur-2xl flex flex-col gap-2.5 flex-shrink-0">
                    {/* Operational Category Context Banner */}
                    <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
                        {isHighRisk && (
                            <>
                                <span className="flex items-center gap-1.5 text-rose-600 font-bold uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                    Critical Incident • Immediate Response
                                </span>
                                <span className="text-slate-400">Unit PCR-14 Standby</span>
                            </>
                        )}
                        {isReview && (
                            <>
                                <span className="flex items-center gap-1.5 text-amber-700 font-bold uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Supervisor Review • Hazard Verification
                                </span>
                                <span className="text-slate-400">Pending Authorization</span>
                            </>
                        )}
                        {isStable && (
                            <>
                                <span className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Stable Routine Call • Autonomous Handling
                                </span>
                                <span className="text-slate-400">No Deployment Needed</span>
                            </>
                        )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2.5">
                        {/* Left Action: Voice Channel Control */}
                        {isOverridden ? (
                            <button
                                onClick={handleTakeoverToggle}
                                className="flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-98"
                            >
                                <Radio className="w-3.5 h-3.5" />
                                <span>Release Back to AI</span>
                            </button>
                        ) : isHighRisk ? (
                            <button
                                onClick={handleTakeoverToggle}
                                className="flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 active:scale-98"
                            >
                                <span>Take Over Line</span>
                            </button>
                        ) : isReview ? (
                            <button
                                onClick={handleTakeoverToggle}
                                className="flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-98"
                            >
                                <span>Intervene Line</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleTakeoverToggle}
                                className="flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs active:scale-98"
                            >
                                <Headphones className="w-3.5 h-3.5 text-slate-500" />
                                <span>Monitor Channel</span>
                            </button>
                        )}

                        {/* Right Action: Context-Aware Incident Action */}
                        {isHighRisk && (
                            <button
                                onClick={handleDispatch}
                                disabled={dispatched}
                                className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                                    dispatched 
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200 cursor-default shadow-none' 
                                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                }`}
                            >
                                {dispatched ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                                        <span>Units Dispatched</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Dispatch Emergency Units</span>
                                    </>
                                )}
                            </button>
                        )}

                        {isReview && (
                            <button
                                onClick={handleReviewAction}
                                disabled={reviewApproved}
                                className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                                    reviewApproved 
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-default shadow-none' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                }`}
                            >
                                {reviewApproved ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Triage Approved</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Approve &amp; Escalate</span>
                                    </>
                                )}
                            </button>
                        )}

                        {isStable && (
                            <button
                                onClick={handleLogAndClose}
                                disabled={caseHandled}
                                className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                                    caseHandled 
                                        ? 'bg-slate-50 text-slate-500 border border-slate-200 cursor-default shadow-none' 
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 shadow-2xs'
                                }`}
                            >
                                {caseHandled ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Non-Emergency Handled</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Log Case &amp; Close by AI</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default CallDetailDrawer;
