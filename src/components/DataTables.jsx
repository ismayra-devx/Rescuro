import React from 'react';
import { useLiveStream } from '../context/LiveStreamContext';
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
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <PhoneCall className="w-3.5 h-3.5" />
                        </span>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                                Live Concurrent Calls Registry (Priority Sorted)
                            </h3>
                            <p className="text-[11px] text-slate-400">Highest-risk triage lines surfaced at the top</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {activeCalls?.length ?? 0} In-Flight
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center gap-0.5">
                            Expand Registry <Maximize2 className="w-3 h-3" />
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-100">
                                <th className="py-2.5">Line ID</th>
                                <th className="py-2.5">Caller ID</th>
                                <th className="py-2.5">Incident Classification</th>
                                <th className="py-2.5">Location</th>
                                <th className="py-2.5">Duration</th>
                                <th className="py-2.5">Risk Status</th>
                                <th className="py-2.5 text-right">Direct Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {sortedCalls.slice(0, 5).map((call) => (
                                <tr 
                                    key={call.id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onToast) onToast(`Inspecting Line ${call.id} • ${call.location}`, 'call');
                                    }}
                                >
                                    <td className="py-3 font-mono font-extrabold text-indigo-600">{call.id}</td>
                                    <td className="py-3 font-mono font-semibold text-slate-900">{call.caller || call.maskedId}</td>
                                    <td className="py-3">
                                        <p className="font-semibold text-slate-800">{call.incident}</p>
                                        <p className="text-[10px] text-slate-400 italic truncate max-w-xs">{call.snippet}</p>
                                    </td>
                                    <td className="py-3 text-slate-600 font-medium">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-slate-400" />
                                            {call.location}
                                        </span>
                                    </td>
                                    <td className="py-3 font-mono text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {formatDuration(call.durationSec)}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-flex items-center gap-1 ${
                                            call.supervisorOverridden ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                            call.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                            call.risk === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                call.supervisorOverridden ? 'bg-amber-500' :
                                                call.risk === 'HIGH' ? 'bg-rose-500 animate-pulse' :
                                                call.risk === 'REVIEW' ? 'bg-amber-500' : 'bg-slate-400'
                                            }`} />
                                            {call.supervisorOverridden ? 'CONTROLLED' : `${call.risk} RISK`}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => onToast && onToast(`Patched in to audio feed ${call.id}`, 'listen')}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
                                                title="Monitor audio"
                                            >
                                                <Headphones className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    takeOverCall(call.id);
                                                    if (onToast) onToast(`Supervisor took over ${call.id}`, 'zap');
                                                }}
                                                className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-xs"
                                            >
                                                <Zap className="w-2.5 h-2.5" /> Take Over
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
                    <div className="h-32 rounded-xl bg-slate-900 border border-slate-800 my-2 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#6366F1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        <div className="relative flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-rose-500/20 animate-ping absolute"></div>
                            <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[9px] font-bold">
                                P1
                            </div>
                        </div>
                        <span className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400">
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
