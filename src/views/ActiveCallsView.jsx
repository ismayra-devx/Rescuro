import React, { useState } from 'react';
import { PhoneCall, Headphones, Clock, MapPin, Search, Maximize2, ShieldCheck } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';
import { CallDetailDrawer } from '../components/CallDetailDrawer';

export const ActiveCallsView = ({ onToast }) => {
    const { activeCalls, takeOverCall, releaseCallToAi, resolveCall, openTakeoverModal } = useLiveStream();
    const [selectedCallId, setSelectedCallId] = useState(null);
    const [riskFilter, setRiskFilter] = useState('ALL');
    const [query, setQuery] = useState('');

    const fmt = (sec = 0) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

    const selectedCall = activeCalls?.find(c => c.id === selectedCallId) || null;

    const filtered = (activeCalls || []).filter(c => 
        (riskFilter === 'ALL' || c.risk === riskFilter) &&
        (!query || [c.id, c.caller, c.location, c.incident].some(s => s.toLowerCase().includes(query.toLowerCase())))
    );

    return (
        <div className="space-y-4">
            {/* 1 & 4. Executive Header & Clean Filter Bar */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 shadow-[0_12px_40px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-2xs">
                        <PhoneCall className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-black text-slate-900 font-mono tracking-tight">
                            Active Concurrent Calls Registry
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                            {activeCalls.length} In-Flight
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter active lines..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-xs font-mono pl-7 pr-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/80 focus:outline-none focus:border-indigo-400 w-44 shadow-2xs"
                        />
                    </div>
                    <div className="flex bg-slate-100/80 p-0.5 rounded-xl text-[10px] font-mono font-bold border border-slate-200/60">
                        {['ALL', 'HIGH', 'REVIEW', 'SAFE'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRiskFilter(r)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${riskFilter === r ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* High-Density Enterprise Command Table */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgb(0,0,0,0.04)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200/80 text-[10px] font-mono font-black uppercase tracking-wider text-slate-900">
                                <th className="py-2.5 px-3.5">Line ID</th>
                                <th className="py-2.5 px-3.5">Caller ID</th>
                                <th className="py-2.5 px-3.5">Incident Classification</th>
                                <th className="py-2.5 px-3.5">Geo-Location</th>
                                <th className="py-2.5 px-3.5">Duration</th>
                                <th className="py-2.5 px-3.5">Language</th>
                                <th className="py-2.5 px-3.5">Assigned Agent / Audio State</th>
                                <th className="py-2.5 px-3.5">Risk Tier</th>
                                <th className="py-2.5 px-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-slate-700 font-medium">
                            {filtered.map(call => {
                                const isHighRisk = call.risk === 'HIGH';
                                const isReview = call.risk === 'REVIEW';
                                const isOverridden = !!call.supervisorOverridden;
                                return (
                                    <tr 
                                        key={call.id} 
                                        onClick={() => setSelectedCallId(call.id)}
                                        className={`transition-all duration-150 cursor-pointer ${
                                            selectedCallId === call.id
                                                ? 'bg-indigo-50/70 shadow-inner'
                                                : isOverridden 
                                                ? 'bg-blue-50/40 hover:bg-blue-50/60'
                                                : isHighRisk 
                                                ? 'bg-rose-50/30 hover:bg-rose-50/50'
                                                : isReview
                                                ? 'bg-amber-50/20 hover:bg-amber-50/30'
                                                : 'hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <td className="py-2.5 px-3.5 font-mono font-black text-indigo-600 tracking-tight">{call.id}</td>
                                        <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 tabular-nums">{call.caller}</td>
                                        <td className="py-2.5 px-3.5">
                                            <p className="font-bold text-slate-900 leading-tight">{call.incident}</p>
                                            <p className="text-[10px] text-slate-400 italic truncate max-w-xs mt-0.5">"{call.snippet}"</p>
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-600">
                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500 flex-shrink-0" />{call.location}</span>
                                        </td>
                                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-700 tabular-nums">
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />{fmt(call.durationSec)}</span>
                                        </td>
                                        <td className="py-2.5 px-3.5">
                                            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">{call.lang}</span>
                                        </td>

                                        {/* Assigned Agent Column: Swaps to Glowing Supervisor Status when Overridden */}
                                        <td className="py-2.5 px-3.5 align-middle">
                                            {isOverridden ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openTakeoverModal(call.id); }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 shadow-2xs ring-1 ring-blue-400/20 cursor-pointer transition-all active:scale-95"
                                                    title="Open Supervisor Command Modal"
                                                >
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold uppercase tracking-tight flex items-center gap-1">
                                                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                                                        <span>Supervisor Active</span>
                                                    </span>
                                                </button>
                                            ) : (
                                                <div className="flex items-center text-[11px] font-semibold font-mono text-slate-700">
                                                    <span className="truncate">{call.agent}</span>
                                                </div>
                                            )}
                                        </td>

                                        <td className="py-2.5 px-3.5 align-middle">
                                            {isOverridden ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openTakeoverModal(call.id); }}
                                                    className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[10px] font-mono font-bold bg-blue-100/90 hover:bg-blue-200 text-blue-900 border border-blue-300 shadow-xs cursor-pointer transition-all active:scale-95"
                                                    title="Open Supervisor Command Modal"
                                                >
                                                    LIVE AUDIO
                                                </button>
                                            ) : isHighRisk ? (
                                                <span className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                                                    CRITICAL
                                                </span>
                                            ) : isReview ? (
                                                <span className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                                                    REVIEW
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                                                    STABLE
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right align-middle">
                                            <div className="inline-flex items-center justify-end p-1 rounded-xl bg-slate-100/90 border border-slate-200/90 shadow-2xs gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                {/* Unified Secondary Utility Controls Dock */}
                                                <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200/80">
                                                    <button
                                                        onClick={() => setSelectedCallId(call.id)}
                                                        className="group/btn p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-all duration-200 active:scale-95 shadow-none hover:shadow-2xs"
                                                        title="Inspect in Slide-Over Drawer"
                                                    >
                                                        <Maximize2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                                                    </button>
                                                    <button
                                                        onClick={() => onToast && onToast(`Monitoring audio feed for ${call.id}`, 'listen')}
                                                        className="group/btn p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-all duration-200 active:scale-95 shadow-none hover:shadow-2xs"
                                                        title="Listen-In Live Audio"
                                                    >
                                                        <Headphones className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                                                    </button>
                                                </div>

                                                {/* Primary Single-Line Action Button */}
                                                {!isOverridden ? (
                                                    <button
                                                        onClick={() => { takeOverCall(call.id); onToast && onToast(`Took over line ${call.id}`, 'phone'); }}
                                                        className="whitespace-nowrap min-w-[5.5rem] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 active:translate-y-0.5 text-white font-mono font-bold text-xs tracking-wide transition-all duration-200 shadow-xs hover:shadow-sm hover:brightness-105 flex items-center justify-center shrink-0 select-none"
                                                    >
                                                        Take Over
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { releaseCallToAi(call.id); onToast && onToast(`Released ${call.id} back to AI`, 'check'); }}
                                                        className="whitespace-nowrap min-w-[5.5rem] px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 active:translate-y-0.5 text-white font-mono font-bold text-xs tracking-wide transition-all duration-200 shadow-xs hover:shadow-sm hover:brightness-105 flex items-center justify-center shrink-0 select-none"
                                                    >
                                                        Release AI
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Slide-Over Context Drawer */}
            <CallDetailDrawer 
                call={selectedCall} 
                isOpen={!!selectedCall} 
                onClose={() => setSelectedCallId(null)} 
                onToast={onToast} 
            />
        </div>
    );
};

export default ActiveCallsView;
