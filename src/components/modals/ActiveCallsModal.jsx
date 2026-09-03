import React from 'react';
import { 
    PhoneCall, 
    Headphones, 
    Zap, 
    Clock, 
    MapPin, 
    AlertTriangle,
    Shield,
    Volume2
} from 'lucide-react';
import { useLiveStream } from '../../context/LiveStreamContext';

export const ActiveCallsModal = ({ onToast }) => {
    const { activeCalls, takeOverCall } = useLiveStream();

    const formatDuration = (sec = 0) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePatchIn = (call) => {
        if (onToast) onToast(`Live audio patch established for line ${call.id} (${call.caller})`, 'listen');
    };

    const handleTakeOver = (call) => {
        takeOverCall(call.id);
        if (onToast) onToast(`Supervisor SUP-004 took over control of ${call.id}`, 'zap');
    };

    return (
        <div className="space-y-6">
            {/* Modal Subheader Intel */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-600 text-white">
                        <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900">
                            Active Emergency Call Registry
                        </h4>
                        <p className="text-xs text-slate-500">
                            Live SIP Channels • Carrier Interconnect Route A-09 • Auto-Recording Opus 24kHz
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-white border border-indigo-200 text-xs font-mono font-bold text-indigo-700 shadow-2xs">
                        {activeCalls.length} Channels In-Flight
                    </span>
                </div>
            </div>

            {/* Live Registry Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">Line ID</th>
                                <th className="py-3 px-4">Caller Number</th>
                                <th className="py-3 px-4">Incident / Location</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Detected Language</th>
                                <th className="py-3 px-4">Risk Level</th>
                                <th className="py-3 px-4 text-right">Patch Into Call</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                            {activeCalls.map((call) => (
                                <tr 
                                    key={call.id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                >
                                    <td className="py-3.5 px-4 font-mono font-extrabold text-indigo-600">
                                        {call.id}
                                    </td>
                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                                        {call.caller}
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <p className="font-semibold text-slate-800">{call.incident}</p>
                                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3 text-indigo-500" />
                                            {call.location}
                                        </p>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {formatDuration(call.durationSec)}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px] font-bold text-slate-700 border border-slate-200/60">
                                            {call.lang}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                            call.supervisorOverridden ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                            call.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                            call.risk === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}>
                                            {call.supervisorOverridden ? 'SUPERVISOR CONTROLLED' : `${call.risk} RISK`}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePatchIn(call)}
                                                className="py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors border border-indigo-200 flex items-center gap-1"
                                                title="Monitor and listen to audio"
                                            >
                                                <Headphones className="w-3.5 h-3.5" />
                                                Patch In
                                            </button>
                                            <button
                                                onClick={() => handleTakeOver(call)}
                                                className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1"
                                                title="Take over line immediately"
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                                Take Over
                                            </button>
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

export default ActiveCallsModal;
