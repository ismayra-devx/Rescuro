import React from 'react';
import { useLiveStream } from '../context/LiveStreamContext';

export const PrimaryCards = ({ onCardClick, wfHeights, onToast }) => {
    const { chatMessages } = useLiveStream();

    return (
        <div className="space-y-6">

            {/* ROW 1: TOP 3 TELEMETRY METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1: Active Calls */}
                <div 
                    onClick={(e) => onCardClick('active-calls', e)}
                    className="card-scale-hover bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer flex flex-col justify-between group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">📞</span>
                            <span>Active Concurrent Calls</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center gap-1 font-semibold">
                            Expand ⤢
                        </span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-4xl font-extrabold font-mono text-slate-900 leading-none">12</span>
                            <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1">
                                ↑ 2 calls <span className="text-slate-400 font-normal">vs last 5m</span>
                            </p>
                        </div>
                        <svg className="w-24 h-10 text-indigo-500" viewBox="0 0 100 40">
                            <path d="M0 30 Q 25 15, 50 25 T 100 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                    </div>
                </div>

                {/* Card 2: Agora ANS Audio Stream */}
                <div 
                    onClick={(e) => onCardClick('audio-stream', e)}
                    className="card-scale-hover bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer flex flex-col justify-between group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">🎙️</span>
                            <span>Agora ANS Audio Stream</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">● LIVE VAD</span>
                            <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 transition-colors font-semibold">Inspect ⤢</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <span className="text-2xl font-extrabold font-mono text-indigo-600 leading-none">-24.5 dB</span>
                            <p className="text-xs font-semibold text-slate-500 mt-2">ANS Noise Suppression Active</p>
                        </div>
                        {/* Waveform Visualizer */}
                        <div className="flex items-end gap-1 h-10 p-1.5 bg-slate-50 border border-slate-200/60 rounded-xl flex-1 max-w-[160px]">
                            {wfHeights.map((h, i) => (
                                <div 
                                    key={i} 
                                    className="flex-1 bg-gradient-to-t from-indigo-500 to-violet-500 rounded-xs transition-all duration-150" 
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Card 3: Emergency Flags */}
                <div 
                    onClick={(e) => onCardClick('emergencies', e)}
                    className="card-scale-hover bg-white border border-rose-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">⚠️</span>
                            <span>Emergency Triage Flags</span>
                        </div>
                        <span className="text-[10px] font-mono text-rose-500 font-semibold">Inspect ⤢</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-4xl font-extrabold font-mono text-rose-600 leading-none">03</span>
                            <p className="text-xs font-semibold text-rose-600 mt-2">⚠️ 2 Awaiting Supervisor Action</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                            CRITICAL
                        </span>
                    </div>
                </div>

            </div>

            {/* ROW 2: CORE WORKSPACE (Transcription, Metadata, Risk Meter) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Panel 1: Live Call Transcription */}
                <div 
                    onClick={(e) => onCardClick('transcription', e)}
                    className="card-scale-hover bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col h-[400px] cursor-pointer hover:border-indigo-300 transition-all group"
                >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                            <span>💬 Live Call Transcription</span>
                            <span className="px-2 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 rounded">LIVE STREAM</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400 group-hover:text-indigo-600 font-semibold">C-1021 ⤢</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {chatMessages.map(msg => (
                            <div 
                                key={msg.id}
                                className={`border rounded-xl p-3 text-xs leading-relaxed transition-all ${
                                    msg.isAi 
                                        ? 'bg-indigo-50/80 border-indigo-100 text-indigo-950 max-w-[85%] ml-auto' 
                                        : 'bg-slate-50 border-slate-200/60 text-slate-800 max-w-[85%]'
                                }`}
                            >
                                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${msg.isAi ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    {msg.author}
                                </p>
                                <p className="font-medium">{msg.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                            Deepgram Nova-2 Streaming
                        </span>
                        <span className="text-[10px] text-slate-400">Click to expand deep-dive ⤢</span>
                    </div>
                </div>

                {/* Panel 2: AI Extracted Details */}
                <div 
                    onClick={(e) => onCardClick('metadata', e)}
                    className="card-scale-hover bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition-all group"
                >
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">⚡ AI Extracted Metadata</span>
                            <span className="text-xs font-mono font-semibold text-indigo-600 group-hover:underline">Deep-Dive ⤢</span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">🚨 Incident Type</span>
                                <span className="font-mono font-bold text-slate-800">Road Accident</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">📍 Location</span>
                                <span className="font-mono font-bold text-slate-800">Sector 18, Noida</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">🩹 Injury Status</span>
                                <span className="font-mono font-bold text-rose-600">Detected (Severe)</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">⚡ Urgency Level</span>
                                <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">CRITICAL</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">🗣️ Language</span>
                                <span className="font-mono font-bold text-slate-800">Hinglish (98%)</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-4">
                        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                            <span>Extraction Confidence</span>
                            <span className="text-indigo-600 font-mono font-bold">92%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                    </div>
                </div>

                {/* Panel 3: High Risk Override */}
                <div 
                    onClick={(e) => onCardClick('risk-override', e)}
                    className="card-scale-hover bg-gradient-to-br from-rose-50/60 to-white border border-rose-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-400 transition-all group"
                >
                    <div className="flex items-center justify-between pb-3 border-b border-rose-100 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-600">🚨 High Risk Override</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-100 border border-rose-200 rounded">ACTION REQUIRED</span>
                    </div>

                    {/* Circular Risk Meter */}
                    <div className="flex flex-col items-center justify-center py-4 relative">
                        <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" stroke="#FEE2E2" strokeWidth="8" fill="none"/>
                            <circle cx="60" cy="60" r="52" stroke="#EF4444" strokeWidth="8" fill="none" strokeDasharray="326" strokeDashoffset="26" strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-extrabold font-mono text-rose-600">92%</span>
                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">CRITICAL</span>
                        </div>
                    </div>

                    {/* Supervisor Action Buttons */}
                    <div className="space-y-2.5 mt-auto">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onToast("Supervisor SUP-004 taken over active call C-1021", "🎧");
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs tracking-wide shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
                        >
                            <span>⚡</span> Take Over Call
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onToast("Emergency Units Dispatched to Noida Sector 18", "🚨");
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-98"
                        >
                            <span>🚨</span> Escalate &amp; Dispatch
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default PrimaryCards;
