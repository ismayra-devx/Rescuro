import React from 'react';
import { CALL_QUEUE_DATA, CALL_HISTORY_DATA } from '../data/mockData';

export const DataTables = ({ onToast }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Data Table 1: Live Call Queue */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">📞 Live Call Queue</span>
                    <span className="text-xs font-mono font-bold text-indigo-600">12 Active</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                                <th className="py-2">Caller ID</th>
                                <th className="py-2">Duration</th>
                                <th className="py-2">Language</th>
                                <th className="py-2">Risk</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {CALL_QUEUE_DATA.map((row, idx) => (
                                <tr 
                                    key={idx}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer" 
                                    onClick={() => onToast(`Inspecting Call ${row.id} (${row.location})`, '📞')}
                                >
                                    <td className="py-2.5 font-mono font-semibold text-slate-900">{row.id}</td>
                                    <td className="py-2.5 font-mono text-slate-500">{row.duration}</td>
                                    <td className="py-2.5"><span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">{row.lang}</span></td>
                                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded font-bold text-[11px] ${row.riskClass}`}>{row.risk}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Card 2: Last Call Location Visualizer */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">📍 Last Call Location</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600">GPS LOCK</span>
                </div>
                
                <div className="h-28 rounded-xl bg-slate-100 border border-slate-200/60 my-3 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6366F1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="radar-pulse-ring relative flex items-center justify-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-rose-600 border-2 border-white shadow-lg"></div>
                    </div>
                </div>

                <div>
                    <p className="text-sm font-bold text-slate-900">Sector 18, Noida</p>
                    <p className="text-xs font-mono text-slate-400">Uttar Pradesh • 28.5708° N, 77.3261° E</p>
                </div>

                <button 
                    onClick={() => onToast('Opening emergency GPS coordinates (28.5708° N, 77.3261° E) in Maps', '📍')}
                    className="w-full mt-3 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs transition-colors border border-indigo-100"
                >
                    🗺️ Open in Interactive Maps
                </button>
            </div>

            {/* Data Table 3: Call History & Audit */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">📑 Call History &amp; Audit</span>
                    <span className="text-xs font-mono text-slate-400">Latest 24h</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                                <th className="py-2">Call ID</th>
                                <th className="py-2">Incident</th>
                                <th className="py-2">Risk</th>
                                <th className="py-2">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {CALL_HISTORY_DATA.map((row, idx) => (
                                <tr 
                                    key={idx}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer" 
                                    onClick={() => onToast(`Audit Log ${row.callId}: ${row.desc}`, '📑')}
                                >
                                    <td className="py-2.5 font-mono text-indigo-600 font-bold">{row.callId}</td>
                                    <td className="py-2.5 font-medium text-slate-800">{row.incident}</td>
                                    <td className="py-2.5">
                                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                            row.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border border-rose-200/60' :
                                            row.risk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                                            'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                        }`}>
                                            {row.risk === 'HIGH' ? '🔴 HIGH' : row.risk === 'MEDIUM' ? '🟠 MEDIUM' : '🟢 LOW'}
                                        </span>
                                    </td>
                                    <td className={`py-2.5 font-semibold ${row.statusColor}`}>{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default DataTables;
