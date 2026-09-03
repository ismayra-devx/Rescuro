import React, { useState } from 'react';
import { History, Search, Play, Pause, Download, MapPin, Clock } from 'lucide-react';

const HISTORICAL_CALLS = [
    { callId: 'C-1021', time: '11:42 AM', caller: '+91 98110-XXXXX', location: 'Sector 18, Noida', incident: 'Road Traffic Collision', duration: '03:42', lang: 'Hinglish', risk: 'HIGH', status: 'In Progress', statusColor: 'text-amber-700 bg-amber-50 border-amber-200', summary: 'Collision between two motor vehicles near metro pillar 42. Dispatched medical squad.' },
    { callId: 'C-1020', time: '11:15 AM', caller: '+91 97123-XXXXX', location: 'Vasant Kunj, Delhi', incident: 'Medical Advice / Dehydration', duration: '01:54', lang: 'English', risk: 'LOW', status: 'AI Resolved', statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200', summary: 'Caller felt dizzy during morning jog. AI completed symptom triage and confirmed stable vitals.' },
    { callId: 'C-1019', time: '10:48 AM', caller: '+91 98450-XXXXX', location: 'Cyber Hub, Gurugram', incident: 'Commercial Kitchen Fire', duration: '04:12', lang: 'Hinglish', risk: 'MEDIUM', status: 'Handed Over', statusColor: 'text-indigo-700 bg-indigo-50 border-indigo-200', summary: 'Small fryer fire in restaurant kitchen. AI obtained location and handed line to supervisor.' },
    { callId: 'C-1018', time: '10:05 AM', caller: '+91 99231-XXXXX', location: 'Atta Market, Noida', incident: 'Domestic LPG Gas Leak', duration: '02:30', lang: 'Hindi', risk: 'HIGH', status: 'Dispatched', statusColor: 'text-rose-700 bg-rose-50 border-rose-200', summary: 'Gas pipeline leak reported. Rapid response unit dispatched within 90 seconds.' },
    { callId: 'C-1017', time: '09:22 AM', caller: '+91 93100-XXXXX', location: 'Rajouri Garden, Delhi', incident: 'Pedestrian Slip & Fall', duration: '01:15', lang: 'Hinglish', risk: 'LOW', status: 'AI Resolved', statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200', summary: 'Elderly caller slipped on wet pavement. Minor bruise, refused ambulance transport.' },
    { callId: 'C-1016', time: '08:50 AM', caller: '+91 98199-XXXXX', location: 'Noida Expressway', incident: 'Multi-Vehicle Pileup', duration: '06:40', lang: 'Hinglish', risk: 'HIGH', status: 'Dispatched', statusColor: 'text-rose-700 bg-rose-50 border-rose-200', summary: 'Fog-related pileup involving 3 trucks and 2 cars. 4 Trauma units mobilized.' }
];

export const CallHistoryView = ({ onToast }) => {
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [playingId, setPlayingId] = useState(null);

    const togglePlay = (id) => {
        setPlayingId(prev => (prev === id ? null : id));
        if (onToast) onToast(`${playingId === id ? 'Paused' : 'Playing'} archived Opus 24kHz stream for ${id}`, playingId === id ? 'pause' : 'play');
    };

    const filtered = HISTORICAL_CALLS.filter(c => 
        (statusFilter === 'ALL' || c.status === statusFilter) &&
        (!query || [c.callId, c.caller, c.location, c.incident].some(s => s.toLowerCase().includes(query.toLowerCase())))
    );

    return (
        <div className="space-y-4">
            {/* Header / Filter Toolbar (No Subtitle Clutter) */}
            <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-4 shadow-[0_12px_40px_rgb(0,0,0,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-2xs">
                        <History className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Emergency Call Logs &amp; Audit Trail</h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text" placeholder="Search logs..." value={query} onChange={(e) => setQuery(e.target.value)}
                            className="text-xs pl-7 pr-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/80 focus:outline-none focus:border-indigo-400 w-44 shadow-2xs"
                        />
                    </div>
                    <div className="flex bg-slate-100/80 p-0.5 rounded-xl text-[10px] font-mono font-bold border border-slate-200/60">
                        {['ALL', 'AI Resolved', 'Handed Over', 'Dispatched'].map(s => (
                            <button
                                key={s} onClick={() => setStatusFilter(s)}
                                className={`px-2 py-1 rounded-lg transition-all ${statusFilter === s ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => onToast && onToast('Exported complete 24h CSV audit logs', 'download')}
                        className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 transition-all"
                    >
                        <Download className="w-3.5 h-3.5" /> Export Audit
                    </button>
                </div>
            </div>

            {/* Historical Audit Table */}
            <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200/80 text-[10px] font-mono font-black uppercase tracking-wider text-slate-900">
                                <th className="py-3 px-4">Call ID &amp; Time</th>
                                <th className="py-3 px-4">Caller</th>
                                <th className="py-3 px-4">Incident &amp; Summary</th>
                                <th className="py-3 px-4">Location</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Risk</th>
                                <th className="py-3 px-4">Resolution Tag</th>
                                <th className="py-3 px-4 text-right">Playback</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filtered.map(row => (
                                <tr key={row.callId} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="py-3.5 px-4 font-mono">
                                        <span className="font-extrabold text-indigo-600">{row.callId}</span>
                                        <span className="block text-[10px] text-slate-400 mt-0.5">{row.time}</span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{row.caller}</td>
                                    <td className="py-3.5 px-4">
                                        <p className="font-semibold text-slate-800">{row.incident}</p>
                                        <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">{row.summary}</p>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600">
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{row.location}</span>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono text-slate-500">{row.duration}</td>
                                    <td className="py-3.5 px-4 align-middle">
                                        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-xs ${
                                            row.risk === 'HIGH' ? 'bg-rose-600 text-white' :
                                            row.risk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                            {row.risk === 'HIGH' ? 'CRITICAL' : row.risk === 'MEDIUM' ? 'REVIEW' : 'STABLE'}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-middle">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${row.statusColor}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right align-middle">
                                        <button
                                            onClick={() => togglePlay(row.callId)}
                                            className={`p-2 rounded-xl border transition-all inline-flex items-center justify-center ${
                                                playingId === row.callId ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                            title="Audio Recording Playback"
                                        >
                                            {playingId === row.callId ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        </button>
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

export default CallHistoryView;
