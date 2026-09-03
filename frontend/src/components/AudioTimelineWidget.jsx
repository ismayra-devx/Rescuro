import React, { useState, useEffect } from 'react';

export const AudioTimelineWidget = ({ onToast }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackProgress, setPlaybackProgress] = useState(38);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [audioChannel, setAudioChannel] = useState('denoised');

    // Playback progress loop
    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setPlaybackProgress(prev => {
                    if (prev >= 100) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return prev + (0.35 * playbackSpeed);
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed]);

    const formatSeconds = (totalSec) => {
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    const currentSeconds = (playbackProgress / 100) * 222; // 03:42 total

    const waveformBars = [
        30, 45, 80, 60, 95, 40, 75, 85, 30, 90, 65, 50, 70, 95, 40, 60, 80, 50, 70, 40, 85, 90, 60, 75, 40, 95, 50, 70, 85, 60, 40, 80, 65, 45
    ];

    return (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/20 border border-slate-200/80 space-y-4 gsap-stagger-child shadow-xs">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                        Live WebRTC Audio Timeline &amp; Scrubber
                    </h4>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <button 
                        onClick={() => setAudioChannel('denoised')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${audioChannel === 'denoised' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        ANS Denoised
                    </button>
                    <button 
                        onClick={() => setAudioChannel('raw')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${audioChannel === 'raw' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        Raw Mic
                    </button>
                </div>
            </div>

            {/* Waveform Visualizer */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/70 space-y-3 shadow-xs">
                <div className="flex items-end gap-1 h-12 py-1 px-2 bg-slate-50/70 rounded-lg border border-slate-100 overflow-hidden">
                    {waveformBars.map((h, i) => {
                        const barProgress = (i / waveformBars.length) * 100;
                        const isPassed = barProgress <= playbackProgress;
                        return (
                            <div 
                                key={i} 
                                className={`flex-1 rounded-xs transition-all duration-100 ${
                                    isPassed 
                                        ? 'bg-gradient-to-t from-indigo-600 to-violet-500' 
                                        : 'bg-slate-200'
                                }`}
                                style={{ 
                                    height: isPlaying ? `${Math.min(100, h + (Math.sin((playbackProgress + i) * 0.5) * 20))}%` : `${h}%`,
                                    opacity: isPassed ? 1 : 0.7
                                }}
                            />
                        );
                    })}
                </div>

                {/* Play/Pause & Scrubber */}
                <div className="flex items-center gap-3 pt-1">
                    <button 
                        onClick={() => {
                            setIsPlaying(!isPlaying);
                            onToast(isPlaying ? "Audio Playback Paused" : "Playing Live Call Audio Stream (Agora WebRTC)", "audio");
                        }}
                        className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center shadow-md shadow-indigo-500/25 transition-transform active:scale-95 flex-shrink-0"
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? (
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                            <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>

                    {/* Clickable / Draggable Track */}
                    <div 
                        className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative cursor-pointer group"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                            setPlaybackProgress(pct);
                        }}
                    >
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 rounded-full relative transition-all duration-75"
                            style={{ width: `${playbackProgress}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform"/>
                        </div>
                    </div>

                    <span className="text-xs font-mono font-semibold text-slate-600 w-24 text-right">
                        {formatSeconds(currentSeconds)} / 03:42
                    </span>
                </div>

                {/* Multipliers & Status */}
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Codec: Opus 24kHz • ANS AI Filter {audioChannel === 'denoised' ? 'ON' : 'BYPASS'}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-medium mr-1">Speed:</span>
                        {[1.0, 1.5, 2.0].map((speed) => (
                            <button
                                key={speed}
                                onClick={() => setPlaybackSpeed(speed)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                                    playbackSpeed === speed
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {speed.toFixed(1)}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioTimelineWidget;
