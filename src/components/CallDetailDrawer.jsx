import React, { useState, useEffect } from 'react';
import { 
    X, 
    PhoneCall, 
    Radio, 
    Headphones, 
    Zap, 
    Send, 
    ShieldAlert, 
    MapPin, 
    Clock, 
    Activity, 
    Bot, 
    Sparkles, 
    CheckCircle2, 
    AlertTriangle,
    Sliders
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';
import { AgentAvatar } from './AgentAvatar';

export const CallDetailDrawer = ({ call, isOpen, onClose, onToast }) => {
    const { takeOverCall, resolveCall, transcriptSegments } = useLiveStream();
    const [whisperInput, setWhisperInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [dispatched, setDispatched] = useState(false);
    const [wfJitter, setWfJitter] = useState([40, 75, 30, 85, 60, 95, 50, 70, 45, 80]);

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

    // Waveform animation
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setWfJitter(prev => prev.map(() => Math.floor(Math.random() * 70) + 25));
        }, 120);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen || !call) return null;

    const isHighRisk = call.risk === 'HIGH';
    const isReview = call.risk === 'REVIEW';

    const handleSendWhisper = (e) => {
        e.preventDefault();
        if (!whisperInput.trim()) return;
        if (onToast) onToast(`Whisper guidance injected: "${whisperInput}"`, 'mic');
        setWhisperInput('');
    };

    const handleTakeoverToggle = () => {
        if (!call.supervisorOverridden) {
            takeOverCall(call.id);
            if (onToast) onToast(`Supervisor SUP-004 took over Line ${call.id}`, 'zap');
        } else {
            resolveCall(call.id);
            if (onToast) onToast(`Resolved & normalized Line ${call.id}`, 'check');
        }
    };

    const handleDispatch = () => {
        setDispatched(true);
        if (onToast) onToast(`Dispatched PCR-14 & Amb-02 to ${call.location}`, 'siren');
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div 
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/25 backdrop-blur-xs transition-opacity duration-300"
            />

            {/* Slide-Over Context Drawer */}
            <aside className="fixed top-0 right-0 h-full w-full sm:w-[460px] z-50 flex flex-col bg-white/85 backdrop-blur-2xl border-l border-white/90 shadow-[-12px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out overflow-hidden">
                
                {/* 1. Drawer Header Bar */}
                <div className="p-4 border-b border-slate-100/80 bg-white/60 backdrop-blur-md flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl text-white shadow-xs flex-shrink-0 ${
                            isHighRisk ? 'bg-rose-600' : isReview ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}>
                            <PhoneCall className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-mono font-black text-sm text-slate-900 tracking-tight">{call.id}</h3>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-xs ${
                                    call.supervisorOverridden 
                                        ? 'bg-amber-500 text-white'
                                        : isHighRisk 
                                        ? 'bg-rose-600 text-white'
                                        : isReview
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                    {call.supervisorOverridden ? 'CONTROLLED' : isHighRisk ? 'CRITICAL' : isReview ? 'REVIEW' : 'STABLE'}
                                </span>
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
                    
                    {/* 2. Real-Time Telemetry Grid (4 Tiles) */}
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
                            <span className="font-mono font-black text-base text-emerald-600">99.4%</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Deepgram Nova-2</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/70 border border-white/80 shadow-2xs">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Assigned Agent</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <AgentAvatar size="xs" variant="indigo" />
                                <span className="font-mono font-black text-sm text-indigo-600 truncate">{call.agent}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Auto Triage Active</span>
                        </div>
                    </div>

                    {/* 3. Caller & Tactical Location Card */}
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

                    {/* 4. Live Audio Frequency Stream */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-white/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-indigo-500" /> Live Spectral Stream
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
                        {/* Waveform Canvas */}
                        <div className="h-10 bg-slate-50 rounded-lg border border-slate-200/60 flex items-center justify-center gap-1.5 px-3">
                            {wfJitter.map((h, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-full transition-all duration-100"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 5. Live Speech-to-Text Transcription Stream */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-white/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-emerald-500" /> Real-Time Transcription
                            </span>
                            <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Stream
                            </span>
                        </div>

                        <div className="space-y-2 text-xs max-h-48 overflow-y-auto pr-1 custom-smooth-scroll">
                            {(transcriptSegments || []).slice(-4).map((item, idx) => (
                                <div key={idx} className={`p-2 rounded-lg text-xs leading-relaxed ${
                                    item.isAi 
                                        ? 'bg-indigo-50/80 border border-indigo-100/70 text-indigo-900 ml-3' 
                                        : 'bg-slate-50 border border-slate-200/60 text-slate-800 mr-3'
                                }`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {item.isAi && <AgentAvatar size="xs" variant="indigo" />}
                                        <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                                            {item.author}
                                        </span>
                                    </div>
                                    {item.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 6. Whisper Guidance Input */}
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

                {/* 7. Instant Supervisor Action Triggers (Pinned to Bottom) */}
                <div className="p-4 border-t border-slate-100/80 bg-white/60 backdrop-blur-md flex items-center gap-2.5 flex-shrink-0">
                    <button
                        onClick={handleTakeoverToggle}
                        className={`flex-1 py-2 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                            call.supervisorOverridden 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                        }`}
                    >
                        {call.supervisorOverridden ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                        {call.supervisorOverridden ? 'Release to AI' : 'Take Over Line'}
                    </button>

                    <button
                        onClick={handleDispatch}
                        disabled={dispatched}
                        className={`flex-1 py-2 px-3 rounded-xl font-mono font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                            dispatched 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                        }`}
                    >
                        {dispatched ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {dispatched ? 'Units Dispatched' : 'Dispatch Squad'}
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default CallDetailDrawer;
