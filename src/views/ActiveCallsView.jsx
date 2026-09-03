import React, { useState } from 'react';
import { PhoneCall, Headphones, Zap, Clock, MapPin, Search, Maximize2 } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';
import { CallDetailDrawer } from '../components/CallDetailDrawer';
import { AgentAvatar } from '../components/AgentAvatar';

export const ActiveCallsView = ({ onToast }) => {
    const { activeCalls, takeOverCall, resolveCall } = useLiveStream();
    const [selectedCall, setSelectedCall] = useState(null);
    const [riskFilter, setRiskFilter] = useState('ALL');
    const [query, setQuery] = useState('');

    const fmt = (sec = 0) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

    const filtered = (activeCalls || []).filter(c => 
        (riskFilter === 'ALL' || c.risk === riskFilter) &&
        (!query || [c.id, c.caller, c.location, c.incident].some(s => s.toLowerCase().includes(query.toLowerCase())))
    );

    return (
        <div className="space-y-4">
            {/* 1 & 4. Executive Header & Clean Filter Bar (No Subtitle Clutter) */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 shadow-[0_12px_40px_rgb(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-2xs">
                        <PhoneCall className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-black text-slate-900 font-mono tracking-tight">
                            Active Concurrent Calls Registry
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
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

            {/* 1, 2 & 3. High-Density Enterprise Command Table */}
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
                                <th className="py-2.5 px-3.5">Assigned Agent</th>
                                <th className="py-2.5 px-3.5">Risk Tier</th>
                                <th className="py-2.5 px-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-slate-700 font-medium">
                            {filtered.map(call => {
                                const isHighRisk = call.risk === 'HIGH';
                                const isReview = call.risk === 'REVIEW';
                                return (
                                    <tr 
                                        key={call.id} 
                                        onClick={() => setSelectedCall(call)}
                                        className={`transition-all duration-150 cursor-pointer ${
                                            selectedCall?.id === call.id
                                                ? 'bg-indigo-50/70 border-l-2 border-l-indigo-600 shadow-inner'
                                                : call.supervisorOverridden 
                                                ? 'border-l-2 border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/60'
                                                : isHighRisk 
                                                ? 'border-l-2 border-l-rose-500 bg-gradient-to-r from-rose-50/80 via-rose-50/30 to-transparent hover:from-rose-100/70'
                                                : isReview
                                                ? 'border-l-2 border-l-amber-400/80 bg-amber-50/20 hover:bg-amber-50/40'
                                                : 'border-l-2 border-l-transparent hover:bg-slate-50/70'
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
                                        <td className="py-2.5 px-3.5 text-[11px] font-semibold font-mono text-indigo-700 align-middle">
                                            <div className="flex items-center gap-1.5">
                                                <AgentAvatar size="xs" variant="indigo" />
                                                <span>{call.supervisorOverridden ? 'SUP-004 (Active)' : call.agent}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3.5 align-middle">
                                            {call.supervisorOverridden ? (
                                                <span className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide bg-amber-500 text-white shadow-xs">
                                                    CONTROLLED
                                                </span>
                                            ) : isHighRisk ? (
                                                <span className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide bg-rose-600 text-white shadow-xs">
                                                    CRITICAL
                                                </span>
                                            ) : isReview ? (
                                                <span className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                                                    REVIEW
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                                                    STABLE
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right align-middle">
                                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setSelectedCall(call)}
                                                    className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold transition-colors shadow-2xs"
                                                    title="Inspect in Slide-Over Drawer"
                                                >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => onToast && onToast(`Monitoring audio feed for ${call.id}`, 'listen')}
                                                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors shadow-2xs"
                                                    title="Monitor Audio"
                                                >
                                                    <Headphones className="w-3.5 h-3.5" />
                                                </button>
                                                {!call.supervisorOverridden ? (
                                                    <button
                                                        onClick={() => { takeOverCall(call.id); onToast && onToast(`Took over line ${call.id}`, 'zap'); }}
                                                        className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs hover:shadow-sm"
                                                    >
                                                        <Zap className="w-3 h-3" /> Take Over
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { resolveCall(call.id); onToast && onToast(`Resolved ${call.id}`, 'check'); }}
                                                        className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs"
                                                    >
                                                        Resolve
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
                onClose={() => setSelectedCall(null)} 
                onToast={onToast} 
            />
        </div>
    );
};

export default ActiveCallsView;
