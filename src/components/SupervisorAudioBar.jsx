import React, { useState } from 'react';
import { 
    Mic, 
    MicOff, 
    Volume2, 
    VolumeX, 
    Pause, 
    Play, 
    PhoneOff, 
    ShieldCheck, 
    Radio, 
    Activity,
    SlidersHorizontal,
    Maximize2
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const SupervisorAudioBar = ({ callId, call, onToast, variant = 'drawer' }) => {
    const { 
        releaseCallToAi, 
        resolveCall,
        isSupervisorMicMuted, 
        isSupervisorOnHold, 
        supervisorVolume, 
        toggleSupervisorMic, 
        toggleSupervisorHold, 
        setSupervisorVolume,
        openTakeoverModal
    } = useLiveStream();

    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

    const handleMicToggle = () => {
        toggleSupervisorMic();
        if (onToast) {
            onToast(
                !isSupervisorMicMuted 
                    ? 'Supervisor microphone muted' 
                    : 'Supervisor microphone live & transmitting', 
                !isSupervisorMicMuted ? 'mute' : 'mic'
            );
        }
    };

    const handleHoldToggle = () => {
        toggleSupervisorHold();
        if (onToast) {
            onToast(
                !isSupervisorOnHold 
                    ? `Line ${callId || 'active'} placed on supervisor audio hold` 
                    : `Line ${callId || 'active'} resumed from audio hold`, 
                'hold'
            );
        }
    };

    const handleRelease = () => {
        if (callId) {
            releaseCallToAi(callId);
            if (onToast) {
                onToast(`Call control returned to Autonomous AI Voice Engine (${call?.agent || 'Agent Nova'})`, 'check');
            }
        }
    };

    const handleDisconnect = () => {
        if (callId) {
            resolveCall(callId);
            if (onToast) {
                onToast(`Line ${callId} safely disconnected & logged`, 'zap');
            }
        }
    };


    // Default Drawer & Modal Embedded Variant
    return (
        <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-blue-200/90 shadow-sm p-3.5 space-y-3 ring-1 ring-blue-500/20 supervisor-active-glow">
            {/* 1. Status Indicator Header */}
            <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-black uppercase tracking-wider text-blue-900 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Supervisor Active
                        </span>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md font-bold">
                            Live Audio Linked
                        </span>
                    </div>
                </div>

                {isSupervisorOnHold && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse flex items-center gap-1">
                        <Pause className="w-2.5 h-2.5" /> ON HOLD
                    </span>
                )}
            </div>

            {/* 2. Tactile Touch-Friendly Audio Action Controls */}
            <div className="flex items-center justify-between gap-2">
                {/* Left controls: Mic, Volume, Hold */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {/* Mute Mic Button */}
                    <button
                        onClick={handleMicToggle}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-2xs active:scale-95 border ${
                            isSupervisorMicMuted
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200 shadow-blue-500/10'
                        }`}
                        title={isSupervisorMicMuted ? 'Click to Unmute Mic' : 'Click to Mute Mic'}
                    >
                        {isSupervisorMicMuted ? (
                            <MicOff className="w-4 h-4 text-rose-600" />
                        ) : (
                            <Mic className="w-4 h-4 text-blue-600 animate-pulse" />
                        )}
                        <span className="text-[11px]">{isSupervisorMicMuted ? 'Mic Muted' : 'Mic Live'}</span>
                    </button>

                    {/* Hold Button */}
                    <button
                        onClick={handleHoldToggle}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-2xs active:scale-95 border ${
                            isSupervisorOnHold
                                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                        title={isSupervisorOnHold ? 'Resume Call' : 'Hold Call Audio'}
                    >
                        {isSupervisorOnHold ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        <span className="text-[11px]">{isSupervisorOnHold ? 'Resume' : 'Hold'}</span>
                    </button>

                    {/* Volume Adjust Trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setShowVolumeSlider(prev => !prev)}
                            className={`p-2 rounded-xl text-xs font-mono font-bold transition-all shadow-2xs active:scale-95 border ${
                                showVolumeSlider || supervisorVolume === 0
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                            title="Adjust Volume"
                        >
                            {supervisorVolume === 0 ? (
                                <VolumeX className="w-4 h-4 text-rose-500" />
                            ) : (
                                <Volume2 className="w-4 h-4 text-slate-700" />
                            )}
                        </button>

                        {/* Floating Volume Slider Dropdown */}
                        {showVolumeSlider && (
                            <div className="absolute left-0 bottom-full mb-2 p-3 bg-white/95 backdrop-blur-xl rounded-xl border border-slate-200 shadow-lg z-20 w-44 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 font-bold">
                                    <span>Headset Gain</span>
                                    <span className="text-blue-600 font-black">{supervisorVolume}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={supervisorVolume}
                                    onChange={(e) => setSupervisorVolume(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right controls: Release to AI & Emergency Disconnect */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Distinct "Release Back to AI" Button */}
                    <button
                        onClick={handleRelease}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-mono font-bold shadow-xs hover:shadow-blue-500/20 transition-all flex items-center justify-center"
                        title="Return call to autonomous AI voice agent"
                    >
                        <span>Release to AI</span>
                    </button>

                    {/* Emergency Disconnect Button */}
                    <button
                        onClick={handleDisconnect}
                        className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white transition-all shadow-xs"
                        title="Emergency Terminate / Disconnect Line"
                    >
                        <PhoneOff className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* 3. Live WebRTC Audio Stream Telemetry Strip */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-mono">
                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase">RTT Latency</span>
                    <span className="font-bold text-blue-600">11.8ms</span>
                </div>
                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase">Tx Buffer</span>
                    <span className="font-bold text-blue-600">0.4ms</span>
                </div>
                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase">Audio Codec</span>
                    <span className="font-bold text-slate-700">Opus 24k</span>
                </div>
                <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60 text-center">
                    <span className="text-slate-400 block text-[9px] uppercase">Loss</span>
                    <span className="font-bold text-blue-600">0.00%</span>
                </div>
            </div>
        </div>
    );
};

export default SupervisorAudioBar;
