import React, { useState, useEffect } from 'react';
import { 
    Radio, 
    Mic, 
    Sliders, 
    Play, 
    Pause, 
    Volume2, 
    VolumeX, 
    RotateCcw, 
    FastForward, 
    Activity, 
    CheckCircle2
} from 'lucide-react';
import { useLiveStream } from '../../context/LiveStreamContext';

export const AudioWorkbenchModal = ({ onToast }) => {
    const { jitterBuffer, packetLoss } = useLiveStream();
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(14);
    const [isDenoised, setIsDenoised] = useState(true);
    const [inputGain, setInputGain] = useState(82);
    const [suppressionLevel, setSuppressionLevel] = useState(94);
    const [masterVolume, setMasterVolume] = useState(75);
    const [isMuted, setIsMuted] = useState(false);

    // Dynamic waveform bar generation based on denoised vs raw mode
    const [waveformBars, setWaveformBars] = useState([]);
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPlaying) return;
            const barCount = 38;
            const newBars = Array.from({ length: barCount }, (_, i) => {
                const base = isDenoised ? 25 : 60;
                const jitter = Math.floor(Math.random() * (isDenoised ? 45 : 38));
                return Math.min(100, Math.max(12, base + jitter));
            });
            setWaveformBars(newBars);
        }, 120);
        return () => clearInterval(interval);
    }, [isPlaying, isDenoised]);

    // Timer tick when playing
    useEffect(() => {
        if (!isPlaying) return;
        const timer = setInterval(() => {
            setCurrentTime(prev => (prev >= 222 ? 0 : prev + 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isPlaying]);

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const toggleDenoising = (val) => {
        setIsDenoised(val);
        if (onToast) {
            onToast(
                val ? "Switched to ANS Denoised Stream (-24.5 dB attenuation)" : "Switched to Raw Microphone Audio Feed",
                val ? "sparkles" : "mic"
            );
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar: Mode Switcher & Stream State */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/90">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                        <Radio className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Acoustic DSP &amp; Speech Enhancement Workbench
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                24kHz WebRTC
                            </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                            Real-time neural noise suppression, acoustic echo cancellation &amp; voice clarity filters
                        </p>
                    </div>
                </div>

                {/* ANS Denoised vs Raw Mic Toggle */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                        onClick={() => toggleDenoising(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isDenoised 
                                ? 'bg-indigo-600 text-white shadow-xs' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        ANS Denoised
                    </button>
                    <button
                        onClick={() => toggleDenoising(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            !isDenoised 
                                ? 'bg-amber-600 text-white shadow-xs' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Mic className="w-3.5 h-3.5" />
                        Raw Mic
                    </button>
                </div>
            </div>

            {/* Live Frequency Waveform Scrubber Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Live Spectral Waveform Monitor
                    </span>
                    <span className={isDenoised ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold"}>
                        {isDenoised ? "Noise Suppressed (-24.5 dB Active)" : "Raw Audio (High Ambient Noise)"}
                    </span>
                </div>

                {/* Waveform Visualization Bars */}
                <div className="h-28 bg-slate-900 rounded-2xl p-4 flex items-end gap-1 overflow-hidden relative shadow-inner">
                    <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400">
                        20 Hz – 12,000 Hz Full Bandwidth
                    </div>
                    <div className="absolute top-3 right-4 text-[10px] font-mono font-bold text-emerald-400">
                        {isDenoised ? "AI SPEECH ENHANCED" : "RAW FEED"}
                    </div>

                    {waveformBars.map((height, idx) => (
                        <div
                            key={idx}
                            className={`flex-1 rounded-xs transition-all duration-100 ${
                                isDenoised 
                                    ? 'bg-gradient-to-t from-emerald-500 via-indigo-400 to-cyan-300' 
                                    : 'bg-gradient-to-t from-rose-500 via-amber-400 to-yellow-300'
                            }`}
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>

                {/* Scrubber Timeline Bar */}
                <div className="space-y-1.5 pt-1">
                    <input
                        type="range"
                        min="0"
                        max="222"
                        value={currentTime}
                        onChange={(e) => setCurrentTime(Number(e.target.value))}
                        className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                    />
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>{formatTime(currentTime)}</span>
                        <span>03:42 (Total Line Buffer)</span>
                    </div>
                </div>

                {/* Scrubber Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {isPlaying ? 'Pause Stream' : 'Resume Stream'}
                        </button>
                        <button
                            onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                            title="Rewind 10s"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">1.0x Speed</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">Stereo 2-Ch</span>
                    </div>
                </div>
            </div>

            {/* Audio Codec Telemetry & Volume Sliders (2 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Telemetry Box */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        Audio Codec &amp; Transport Telemetry
                    </h5>

                    <div className="space-y-2 text-xs divide-y divide-slate-100">
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">Acoustic Codec</span>
                            <span className="font-mono font-bold text-slate-800">Opus 24kHz (Wideband)</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">Transmission Bitrate</span>
                            <span className="font-mono font-bold text-slate-800">32.4 kbps Dynamic VBR</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">Jitter Buffer Latency</span>
                            <span className="font-mono font-bold text-emerald-600">{jitterBuffer || '4.2ms'}</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">Network Packet Loss</span>
                            <span className="font-mono font-bold text-emerald-600">{packetLoss || '0.01%'}</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">ANS Denoising Ratio</span>
                            <span className="font-mono font-bold text-indigo-600">-24.5 dB (Traffic/Horn Cutoff)</span>
                        </div>
                    </div>
                </div>

                {/* Volume & Gain Sliders */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-600" />
                        Audio Gain &amp; Suppression Sliders
                    </h5>

                    <div className="space-y-3 text-xs">
                        {/* Input Gain */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Microphone Input Gain</span>
                                <span className="font-mono font-bold text-indigo-600">{inputGain}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={inputGain}
                                onChange={(e) => setInputGain(Number(e.target.value))}
                                className="w-full accent-indigo-600 cursor-pointer"
                            />
                        </div>

                        {/* Suppression Strength */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Neural Suppression Level</span>
                                <span className="font-mono font-bold text-emerald-600">{suppressionLevel}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="50" 
                                max="100" 
                                value={suppressionLevel}
                                onChange={(e) => setSuppressionLevel(Number(e.target.value))}
                                className="w-full accent-emerald-600 cursor-pointer"
                            />
                        </div>

                        {/* Master Output Volume */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-slate-500" />}
                                    Master Supervisor Monitor
                                </span>
                                <span className="font-mono font-bold text-slate-800">{isMuted ? 'Muted' : `${masterVolume}%`}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    disabled={isMuted}
                                    value={masterVolume}
                                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                                    className="w-full accent-indigo-600 cursor-pointer disabled:opacity-40"
                                />
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className={`p-1.5 rounded-lg border text-xs font-semibold ${
                                        isMuted ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    {isMuted ? 'Unmute' : 'Mute'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AudioWorkbenchModal;
