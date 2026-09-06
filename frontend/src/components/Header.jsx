import React from 'react';
import { useLiveStream } from '../context/LiveStreamContext';

export const Header = () => {
    const { streamStatus, latencies } = useLiveStream();
    const totalLatency = latencies.reduce((sum, val) => sum + (val || 0), 0) || 217;

    return (
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 px-8 py-3.5 shadow-2xs">
            {/* Top Bar: Title & Primary KPI Counters */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            National Emergency Command Center
                        </h2>
                        
                        {/* Live Operations Indicator */}
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Live Dispatch</span>
                        </div>

                        {/* Stream Connection Pill */}
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100/80 text-slate-600 border border-slate-200/70">
                            <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            <span>{streamStatus === 'CONNECTED' ? 'FastAPI Stream' : 'Live Stream Sync'}</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2 font-mono">
                        <span>NCR Exchange Node</span>
                        <span>•</span>
                        <span>Sector 18 Sector Command</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-semibold">Triage Protocol 4.2</span>
                    </p>
                </div>

                {/* Right: High-Density KPI Chips */}
                <div className="flex items-center gap-3">
                    {/* Active Calls */}
                    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                        </div>
                        <div>
                            <span className="block text-sm font-bold font-mono text-slate-900 leading-tight">12</span>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Lines</span>
                        </div>
                    </div>

                    {/* Critical Emergencies */}
                    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-rose-50/40 border border-rose-200/80 hover:border-rose-300 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-rose-100/70 border border-rose-200 flex items-center justify-center text-rose-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>
                        </div>
                        <div>
                            <span className="block text-sm font-bold font-mono text-rose-600 leading-tight">03</span>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-600">Priority 1</span>
                        </div>
                    </div>

                    {/* Supervisors */}
                    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <div>
                            <span className="block text-sm font-bold font-mono text-slate-900 leading-tight">08<span className="text-slate-400 text-xs">/12</span></span>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Supervisors</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Telemetry Ribbon: High-Precision Pipeline Flow */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[11px] font-mono text-slate-600">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans mr-1">
                        Pipeline
                    </span>

                    {/* Node 1: Twilio SIP Trunk */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="font-semibold text-slate-800">Twilio SIP</span>
                        <span className="text-indigo-600 font-bold">{latencies[0] || 12}ms</span>
                    </div>

                    <span className="text-slate-300">➔</span>

                    {/* Node 2: Agora ANS */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="font-semibold text-slate-800">Agora ANS</span>
                        <span className="text-indigo-600 font-bold">{latencies[1] || 8}ms</span>
                    </div>

                    <span className="text-slate-300">➔</span>

                    {/* Node 3: Deepgram Nova-2 STT */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="font-semibold text-slate-800">Deepgram STT</span>
                        <span className="text-indigo-600 font-bold">{latencies[2] || 45}ms</span>
                    </div>

                    <span className="text-slate-300">➔</span>

                    {/* Node 4: AI Triage Model */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="font-semibold text-slate-800">AI Triage</span>
                        <span className="text-indigo-600 font-bold">{latencies[3] || 120}ms</span>
                    </div>

                    <span className="text-slate-300">➔</span>

                    {/* Node 5: ElevenLabs TTS */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="font-semibold text-slate-800">TTS Audio</span>
                        <span className="text-indigo-600 font-bold">{latencies[4] || 32}ms</span>
                    </div>
                </div>

                {/* Total Latency & Health Indicator */}
                <div className="flex items-center gap-2 text-[11px] font-mono flex-shrink-0">
                    <span className="text-slate-400">Total Pipeline:</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        {totalLatency}ms
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        OPTIMAL (&lt;250ms)
                    </span>
                </div>
            </div>
        </header>
    );
};

export default Header;
