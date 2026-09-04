import React, { useState, useEffect } from 'react';
import { 
    X, 
    ShieldCheck, 
    PhoneCall, 
    MapPin, 
    Clock, 
    Mic, 
    MicOff, 
    Volume2, 
    VolumeX, 
    Pause, 
    Play, 
    PhoneOff, 
    Activity, 
    Minimize2, 
    Maximize2,
    Radio
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const TakeoverModal = ({ onToast }) => {
    const { 
        activeCalls,
        takeoverModalCallId, 
        closeTakeoverModal, 
        releaseCallToAi, 
        resolveCall,
        isSupervisorMicMuted,
        isSpeakerMuted,
        isSupervisorOnHold,
        supervisorVolume,
        toggleSupervisorMic,
        toggleSpeakerMute,
        toggleSupervisorHold,
        setSupervisorVolume
    } = useLiveStream();

    const [isDocked, setIsDocked] = useState(false);

    // Dynamic Reactive Speech Waveform Arrays
    const [supervisorWave, setSupervisorWave] = useState([20, 50, 35, 80, 60, 95, 45, 70, 30, 85, 40, 60]);
    const [callerWave, setCallerWave] = useState([40, 70, 30, 85, 55, 90, 45, 65, 35, 75, 50, 80]);

    const call = activeCalls?.find(c => c.id === takeoverModalCallId);

    // ESC key listener to minimize or dismiss modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && takeoverModalCallId) {
                closeTakeoverModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [takeoverModalCallId, closeTakeoverModal]);

    // Dynamic Speech Audio Waveform Reactivity (Simulates Natural Human Speech Cadence)
    useEffect(() => {
        if (!takeoverModalCallId) return;

        const interval = setInterval(() => {
            // 1. Supervisor Speech Channel (Tx)
            if (isSupervisorMicMuted || isSupervisorOnHold) {
                setSupervisorWave(new Array(12).fill(12));
            } else {
                setSupervisorWave(prev => prev.map(() => {
                    // Natural speech oscillation burst
                    const activeBurst = Math.random() > 0.15;
                    return activeBurst ? Math.floor(Math.random() * 75) + 25 : 15;
                }));
            }

            // 2. Caller Speech Channel (Rx)
            if (isSpeakerMuted || isSupervisorOnHold) {
                setCallerWave(new Array(12).fill(12));
            } else {
                setCallerWave(prev => prev.map(() => {
                    const activeBurst = Math.random() > 0.2;
                    return activeBurst ? Math.floor(Math.random() * 70) + 25 : 18;
                }));
            }
        }, 90);

        return () => clearInterval(interval);
    }, [takeoverModalCallId, isSupervisorMicMuted, isSpeakerMuted, isSupervisorOnHold]);

    if (!takeoverModalCallId || !call) return null;

    const fmt = (sec = 0) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

    const handleRelease = () => {
        releaseCallToAi(call.id);
        if (onToast) onToast(`Call control for ${call.id} returned to AI Voice Assistant`, 'check');
    };

    const handleDisconnect = () => {
        resolveCall(call.id);
        if (onToast) onToast(`Line ${call.id} terminated & logged`, 'zap');
    };

    const handleMicToggle = () => {
        toggleSupervisorMic();
        if (onToast) {
            onToast(
                !isSupervisorMicMuted ? 'Supervisor mic muted' : 'Supervisor mic live & transmitting',
                !isSupervisorMicMuted ? 'mute' : 'mic'
            );
        }
    };

    const handleSpeakerToggle = () => {
        toggleSpeakerMute();
        if (onToast) {
            onToast(
                !isSpeakerMuted ? 'Headset audio muted' : 'Headset audio unmuted',
                !isSpeakerMuted ? 'mute' : 'listen'
            );
        }
    };

    const handleHoldToggle = () => {
        toggleSupervisorHold();
        if (onToast) {
            onToast(
                !isSupervisorOnHold ? `Line ${call.id} placed on audio hold` : `Line ${call.id} resumed from hold`,
                'hold'
            );
        }
    };

    // Minimized / Docked View (Bottom-Right Floating Tactical Override Bar)
    if (isDocked) {
        return (
            <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white/95 backdrop-blur-2xl border border-indigo-200 shadow-2xl rounded-2xl p-4 ring-1 ring-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                        </span>
                        <div>
                            <span className="text-xs font-mono font-black text-slate-900 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                <span>OVERRIDE: {call.id}</span>
                            </span>
                            <span className="text-[10px] font-mono text-indigo-700 font-bold block">
                                Voice Bridge Connected • {fmt(call.durationSec)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsDocked(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Expand Command Modal"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={closeTakeoverModal}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Close Overlay (Voice remains linked)"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Docked Control Strip */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleMicToggle}
                            className={`p-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                isSupervisorMicMuted ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                            }`}
                            title={isSupervisorMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                        >
                            {isSupervisorMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                        <button
                            onClick={handleSpeakerToggle}
                            className={`p-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                isSpeakerMuted ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            }`}
                            title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
                        >
                            {isSpeakerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={handleHoldToggle}
                            className={`p-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                isSupervisorOnHold ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title={isSupervisorOnHold ? 'Resume' : 'Hold'}
                        >
                            {isSupervisorOnHold ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    <button
                        onClick={handleRelease}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs shadow-xs flex items-center justify-center transition-all cursor-pointer"
                    >
                        <span>Release to AI</span>
                    </button>
                </div>
            </div>
        );
    }

    // Centered High-Priority Razor-Focused Command Modal Card
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur Overlay */}
            <div 
                onClick={closeTakeoverModal}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            {/* High-Priority Command Modal Card */}
            <div className="relative z-10 w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-indigo-100 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-indigo-500/15 transition-all">
                
                {/* 1. Ultra-Clean High-Impact Emergency Header */}
                <div className="px-5 py-4 border-b border-slate-150 bg-gradient-to-r from-indigo-50/70 via-white/80 to-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                            <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-mono font-black text-sm text-slate-900 tracking-tight">
                                    HUMAN INTERVENTION OVERRIDE
                                </h3>
                                <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                    {call.id}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Active Incident: <strong className="text-slate-800 font-semibold">{call.incident}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsDocked(true)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Dock overlay"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={closeTakeoverModal}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 2. Razor-Focused Body */}
                <div className="p-5 space-y-4 font-sans">

                    {/* Operational Status & Triage Metadata Bar */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-indigo-200/80 shadow-2xs">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                                </span>
                                <span className="text-[11px] font-mono font-black text-indigo-900 tracking-tight flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Supervisor Active — Secure Voice Bridge Connected</span>
                                </span>
                            </div>

                            <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-1">
                                <Clock className="w-3 h-3 text-indigo-600" />
                                <span>{fmt(call.durationSec)}</span>
                            </span>
                        </div>

                        {/* Caller Phone & Exact Geolocation Anchor */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Caller Phone</span>
                                <span className="font-bold text-slate-900 text-xs block mt-0.5">{call.caller}</span>
                            </div>
                            <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Exact Geolocation</span>
                                <span className="font-bold text-slate-900 text-xs flex items-center gap-1 mt-0.5 truncate">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                    <span className="truncate">{call.location}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Prominent Live Speech Waveform Visualizer (Stripped of redundant telemetry & dBFS clutter) */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                                Live Voice Transmission
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                Full-Duplex
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Supervisor Channel (Tx) */}
                            <div className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                                        <Mic className="w-3.5 h-3.5 text-indigo-600" /> Supervisor
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-700">
                                        {isSupervisorMicMuted ? 'Muted' : isSupervisorOnHold ? 'On Hold' : 'Transmitting'}
                                    </span>
                                </div>
                                <div className="h-10 bg-white rounded-lg flex items-center justify-center gap-1 px-2 border border-indigo-100/80">
                                    {supervisorWave.map((h, i) => (
                                        <div
                                            key={i}
                                            className={`w-1.5 rounded-full transition-all duration-100 ${
                                                isSupervisorMicMuted 
                                                    ? 'bg-rose-300' 
                                                    : isSupervisorOnHold 
                                                    ? 'bg-amber-400' 
                                                    : 'bg-indigo-600'
                                            }`}
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Caller Channel (Rx) */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                        <PhoneCall className="w-3.5 h-3.5 text-slate-600" /> Caller
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-600">
                                        {isSpeakerMuted ? 'Muted' : 'Speaking'}
                                    </span>
                                </div>
                                <div className="h-10 bg-white rounded-lg flex items-center justify-center gap-1 px-2 border border-slate-200/70">
                                    {callerWave.map((h, i) => (
                                        <div
                                            key={i}
                                            className="w-1.5 bg-slate-800 rounded-full transition-all duration-100"
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Essential Action Bar (Mission-Critical Touch Controls) */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Mute Mic Button */}
                        <button
                            onClick={handleMicToggle}
                            className={`p-2.5 rounded-xl font-mono font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                                isSupervisorMicMuted
                                    ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                                    : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                            }`}
                        >
                            {isSupervisorMicMuted ? <MicOff className="w-4 h-4 text-rose-600" /> : <Mic className="w-4 h-4 text-indigo-600 animate-pulse" />}
                            <span>{isSupervisorMicMuted ? 'Mic Muted' : 'Mute Mic'}</span>
                        </button>

                        {/* Toggle Speaker Button */}
                        <button
                            onClick={handleSpeakerToggle}
                            className={`p-2.5 rounded-xl font-mono font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                                isSpeakerMuted
                                    ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                                    : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                            }`}
                        >
                            {isSpeakerMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
                            <span>{isSpeakerMuted ? 'Speaker Off' : 'Speaker On'}</span>
                        </button>

                        {/* Hold Line Button */}
                        <button
                            onClick={handleHoldToggle}
                            className={`p-2.5 rounded-xl font-mono font-bold text-xs border transition-all flex flex-col items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                                isSupervisorOnHold
                                    ? 'bg-amber-500 border-amber-600 text-white shadow-amber-500/20'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            {isSupervisorOnHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4 text-slate-600" />}
                            <span>{isSupervisorOnHold ? 'Resume Call' : 'Hold Call'}</span>
                        </button>
                    </div>
                </div>

                {/* 5. Mission Execution Action Triggers */}
                <div className="p-4 border-t border-slate-150 bg-slate-50/60 flex items-center justify-between gap-3">
                    {/* Disconnect / Drop Line */}
                    <button
                        onClick={handleDisconnect}
                        className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        title="Disconnect Line"
                    >
                        <PhoneOff className="w-4 h-4 text-rose-600" />
                        <span>Disconnect / Drop Line</span>
                    </button>

                    {/* Release Call Back to AI Assistant */}
                    <button
                        onClick={handleRelease}
                        className="flex-1 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-mono font-bold text-xs shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center cursor-pointer"
                    >
                        <span>Release Call Back to AI Assistant</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TakeoverModal;
