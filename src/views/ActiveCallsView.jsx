import React, { useState } from 'react';
import { PhoneCall, Headphones, Zap, Clock, MapPin, Search } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const ActiveCallsView = ({ onToast }) => {
    const { activeCalls, takeOverCall, resolveCall } = useLiveStream();
    const [riskFilter, setRiskFilter] = useState('ALL');
    const [query, setQuery] = useState('');

    const fmt = (sec = 0) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

    const filtered = (activeCalls || []).filter(c => 
        (riskFilter === 'ALL' || c.risk === riskFilter) &&
        (!query || [c.id, c.caller, c.location, c.incident].some(s => s.toLowerCase().includes(query.toLowerCase())))
    );

    return (
        <div className="space-y-4">
            {/* Header & Filter Bar */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><PhoneCall className="w-4 h-4" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Active Concurrent Calls Registry
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {activeCalls.length} In-Flight
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Full-screen real-time SIP trunk line monitor with live WebRTC status</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search active lines..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-xs pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-400 w-44"
                        />
                    </div>
                    <div className="flex bg-slate-100 p-0.5 rounded-xl text-[10px] font-mono font-bold">
                        {['ALL', 'HIGH', 'REVIEW', 'SAFE'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRiskFilter(r)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${riskFilter === r ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dedicated Full-Screen Table */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-4">Line ID</th>
                                <th className="py-3 px-4">Caller ID</th>
                                <th className="py-3 px-4">Incident Classification</th>
                                <th className="py-3 px-4">Geo-Location</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Language</th>
                                <th className="py-3 px-4">Assigned Agent</th>
                                <th className="py-3 px-4">Live Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filtered.map(call => (
                                <tr key={call.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="py-3.5 px-4 font-mono font-extrabold text-indigo-600">{call.id}</td>
                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{call.caller}</td>
                                    <td className="py-3.5 px-4">
                                        <p className="font-semibold text-slate-800">{call.incident}</p>
                                        <p className="text-[11px] text-slate-400 italic truncate max-w-xs mt-0.5">"{call.snippet}"</p>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600">
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500" />{call.location}</span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-slate-700">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />{fmt(call.durationSec)}</span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">{call.lang}</span>
                                    </td>
                                    <td className="py-3.5 px-4 text-[11px] font-semibold text-indigo-600">
                                        {call.supervisorOverridden ? 'SUP-004 (Intervened)' : call.agent}
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border inline-flex items-center gap-1.5 ${
                                            call.supervisorOverridden ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                            call.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                            call.risk === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                call.supervisorOverridden ? 'bg-amber-500' :
                                                call.risk === 'HIGH' ? 'bg-rose-500 animate-pulse' :
                                                call.risk === 'REVIEW' ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`} />
                                            {call.supervisorOverridden ? 'CONTROLLED' : `${call.risk} RISK`}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => onToast && onToast(`Monitoring audio feed for ${call.id}`, 'listen')}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
                                                title="Listen in"
                                            >
                                                <Headphones className="w-3.5 h-3.5" />
                                            </button>
                                            {!call.supervisorOverridden ? (
                                                <button
                                                    onClick={() => { takeOverCall(call.id); onToast && onToast(`Took over line ${call.id}`, 'zap'); }}
                                                    className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                                                >
                                                    <Zap className="w-3 h-3" /> Take Over
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { resolveCall(call.id); onToast && onToast(`Resolved ${call.id}`, 'check'); }}
                                                    className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActiveCallsView;
