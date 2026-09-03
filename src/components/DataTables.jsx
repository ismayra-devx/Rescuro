import React from 'react';
import { useLiveStream } from '../context/LiveStreamContext';
import { AgentAvatar } from './AgentAvatar';
import { 
    PhoneCall, 
    MapPin, 
    Compass, 
    Maximize2, 
    Zap, 
    Headphones,
    Clock,
    AlertTriangle,
    Shield
} from 'lucide-react';

export const DataTables = ({ onCardClick, onToast }) => {
    const { activeCalls, takeOverCall } = useLiveStream();

    const formatDuration = (sec = 0) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Sort active calls to surface highest-risk calls at the top
    const sortedCalls = [...(activeCalls || [])].sort((a, b) => {
        const riskOrder = { 'HIGH': 3, 'REVIEW': 2, 'SAFE': 1 };
        return (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0);
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left 2 Cols: Live Concurrent Calls Registry (Highest Risk Surfaced at Top) */}
            <div 
                onClick={(e) => onCardClick && onCardClick('active-calls', e)}
                className="lg:col-span-2 glass-surface rounded-2xl p-6 flex flex-col cursor-pointer group"
            >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100/80 mb-2.5">
                    <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-2xs">
                            <PhoneCall className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono">
                                Live Concurrent Calls Registry
                            </h3>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50/90 px-2 py-0.5 rounded border border-indigo-200/80 shadow-2xs">
                                {activeCalls?.length ?? 0} In-Flight
                            </span>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center gap-0.5">
                        Expand Registry <Maximize2 className="w-3 h-3" />
                    </span>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/70 text-[10px] font-mono font-black uppercase tracking-wider text-slate-900 border-b border-slate-200/80">
                                <th className="py-2.5 px-3">Line ID</th>
                                <th className="py-2.5 px-3">Caller ID</th>
                                <th className="py-2.5 px-3">Incident Classification</th>
                                <th className="py-2.5 px-3">Location</th>
                                <th className="py-2.5 px-3">Duration</th>
                                <th className="py-2.5 px-3">Risk Status</th>
                                <th className="py-2.5 px-3 text-right">Direct Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-slate-700">
                            {sortedCalls.slice(0, 5).map((call) => {
                                const isHighRisk = call.risk === 'HIGH';
                                const isReview = call.risk === 'REVIEW';
                                return (
                                    <tr 
                                        key={call.id}
                                        className={`transition-all duration-150 ${
                                            call.supervisorOverridden 
                                                ? 'border-l-2 border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/60'
                                                : isHighRisk 
                                                ? 'border-l-2 border-l-rose-500 bg-gradient-to-r from-rose-50/80 via-rose-50/30 to-transparent hover:from-rose-100/70'
                                                : isReview
                                                ? 'border-l-2 border-l-amber-400/80 bg-amber-50/20 hover:bg-amber-50/40'
                                                : 'border-l-2 border-l-transparent hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <td className="py-2.5 px-3 font-mono font-black text-indigo-600 tracking-tight align-middle">
                                            <div className="flex items-center gap-1.5">
                                                <AgentAvatar size="xs" variant="indigo" />
                                                <span>{call.id}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 tabular-nums">{call.caller || call.maskedId}</td>
                                        <td className="py-2.5 px-3">
                                            <p className="font-bold text-slate-900 leading-tight">{call.incident}</p>
                                            <p className="text-[10px] text-slate-400 italic truncate max-w-xs">{call.snippet}</p>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                                                {call.location}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 tabular-nums">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                {formatDuration(call.durationSec)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 align-middle">
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
                                        <td className="py-2.5 px-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => onToast && onToast(`Patched in to audio feed ${call.id}`, 'listen')}
                                                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors shadow-2xs"
                                                    title="Monitor Audio"
                                                >
                                                    <Headphones className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        takeOverCall(call.id);
                                                        if (onToast) onToast(`Supervisor took over ${call.id}`, 'zap');
                                                    }}
                                                    className="py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs hover:shadow-sm"
                                                >
                                                    <Zap className="w-2.5 h-2.5" /> Take Over
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Col: Regional Tactical Geo-Lock & Response Units */}
            <div 
                onClick={(e) => onCardClick && onCardClick('risk-override', e)}
                className="glass-surface rounded-2xl p-6 flex flex-col justify-between cursor-pointer group"
            >
                <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 font-mono">
                            <MapPin className="w-3.5 h-3.5 text-rose-600" />
                            Sector 18 Tactical Geo-Radar
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">Carrier Tower A-09</span>
                    </div>

                    {/* Radar Visualizer */}
                    <div className="h-32 rounded-xl bg-slate-50 border border-slate-200/90 my-2 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6366F1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        <div className="relative flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-rose-500/15 absolute"></div>
                            <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-bold">
                                P1
                            </div>
                        </div>
                        <span className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500 font-semibold">
                            28.5708° N, 77.3271° E
                        </span>
                    </div>

                    <div className="space-y-1.5 mt-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Incident Anchor:</span>
                            <span className="font-bold text-slate-900">Sector 18 Metro Pillar 42</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Nearest ALS:</span>
                            <span className="font-bold text-slate-900">Amb-02 (4m ETA)</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-slate-500">Police Patrol:</span>
                            <span className="font-bold text-slate-900">PCR-14 (2m ETA)</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => onToast && onToast('Opening emergency GPS coordinates in Tactical Maps', 'map')}
                    className="w-full mt-4 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors border border-indigo-200/80 flex items-center justify-center gap-1.5"
                >
                    <Compass className="w-3.5 h-3.5" />
                    Open Tactical Maps
                </button>
            </div>

        </div>
    );
};

export default DataTables;
