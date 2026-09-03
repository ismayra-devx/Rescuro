import React, { useState } from 'react';
import { 
    History, 
    FileText, 
    Search, 
    CheckCircle2, 
    Download, 
    Play, 
    Pause, 
    MapPin, 
    Clock, 
    ShieldCheck, 
    AlertTriangle,
    ArrowRight
} from 'lucide-react';

const AUDIT_RECORDS = [
    {
        callId: 'C-1021',
        time: '11:42 AM Today',
        incident: 'Road Traffic Collision with Injuries',
        classification: 'Severe Trauma',
        location: 'Sector 18, Noida',
        duration: '03:42',
        operator: 'Agent Nova + SUP-004',
        outcome: 'Dispatched',
        outcomeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        summary: 'Collision involving two motor vehicles. Dispatched trauma ambulance Amb-02.'
    },
    {
        callId: 'C-1020',
        time: '11:15 AM Today',
        incident: 'Medical Advice / Dehydration',
        classification: 'Non-Urgent Medical',
        location: 'Vasant Kunj, New Delhi',
        duration: '01:54',
        operator: 'Agent Nova-Triage',
        outcome: 'AI Resolved',
        outcomeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        summary: 'Caller felt dizzy during jogging. AI completed symptom triage and confirmed stable vitals.'
    },
    {
        callId: 'C-1019',
        time: '10:48 AM Today',
        incident: 'Commercial Kitchen Fire',
        classification: 'Hazardous Structure',
        location: 'Cyber Hub, Gurugram',
        duration: '04:12',
        operator: 'Agent Aegis + SUP-001',
        outcome: 'Handed Over',
        outcomeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        summary: 'Deep-fryer fire in restaurant kitchen. AI extracted geo-location and patched supervisor.'
    },
    {
        callId: 'C-1018',
        time: '10:05 AM Today',
        incident: 'Domestic LPG Cylinder Leak',
        classification: 'Hazardous Material',
        location: 'Atta Market, Noida',
        duration: '02:30',
        operator: 'Agent Aegis-Hazards',
        outcome: 'Dispatched',
        outcomeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        summary: 'LPG gas pipeline leak reported in residential block. Fire squad mobilized in 90 seconds.'
    },
    {
        callId: 'C-1017',
        time: '09:22 AM Today',
        incident: 'Pedestrian Slip & Ankle Sprain',
        classification: 'Minor Injury',
        location: 'Rajouri Garden, Delhi',
        duration: '01:15',
        operator: 'Agent Rhea-Hindi',
        outcome: 'AI Resolved',
        outcomeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        summary: 'Elderly caller slipped on wet tiles. First-aid instructions delivered; caller refused hospital transport.'
    },
    {
        callId: 'C-1016',
        time: '08:50 AM Today',
        incident: 'Multi-Vehicle Expressway Pileup',
        classification: 'Mass Casualty Alert',
        location: 'Noida Expressway Km 12',
        duration: '06:40',
        operator: 'Agent Nova + SUP-004',
        outcome: 'Dispatched',
        outcomeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        summary: 'Fog-induced pileup involving 4 vehicles. Mobilized 3 trauma ambulances and PCR squad.'
    }
];

export const CallHistoryModal = ({ onToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [outcomeFilter, setOutcomeFilter] = useState('ALL');
    const [playingId, setPlayingId] = useState(null);

    const togglePlay = (id) => {
        if (playingId === id) {
            setPlayingId(null);
            if (onToast) onToast(`Paused archived call audio for ${id}`, 'pause');
        } else {
            setPlayingId(id);
            if (onToast) onToast(`Playing archived Opus 24kHz stream for ${id}`, 'play');
        }
    };

    const filtered = AUDIT_RECORDS.filter(record => {
        const matchesOutcome = outcomeFilter === 'ALL' || record.outcome === outcomeFilter;
        const matchesSearch = 
            record.callId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.incident.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.location.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesOutcome && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Incident Classification KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Logged (24h)</span>
                    <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">1,284</p>
                    <span className="text-xs text-slate-500 mt-0.5 block">Calls Triaged</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">AI Resolved</span>
                    <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">68%</p>
                    <span className="text-xs text-slate-500 mt-0.5 block">873 Calls Autonomous</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Handed Over</span>
                    <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">18%</p>
                    <span className="text-xs text-slate-500 mt-0.5 block">231 To Supervisors</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Dispatched</span>
                    <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">14%</p>
                    <span className="text-xs text-slate-500 mt-0.5 block">180 Units Mobilized</span>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search audit records by ID, incident..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-indigo-400"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        {['ALL', 'AI Resolved', 'Handed Over', 'Dispatched'].map(status => (
                            <button
                                key={status}
                                onClick={() => setOutcomeFilter(status)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    outcomeFilter === status 
                                        ? 'bg-indigo-600 text-white shadow-2xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => onToast && onToast('Exported complete 24h CSV audit trail!', 'download')}
                        className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Audit
                    </button>
                </div>
            </div>

            {/* Historical Audit Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">Call ID &amp; Time</th>
                                <th className="py-3 px-4">Incident Classification</th>
                                <th className="py-3 px-4">Location</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Assigned Unit/Agent</th>
                                <th className="py-3 px-4">Outcome Status</th>
                                <th className="py-3 px-4 text-right">Playback</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                            {filtered.map((row) => (
                                <tr 
                                    key={row.callId}
                                    className="hover:bg-slate-50/80 transition-colors"
                                >
                                    <td className="py-3.5 px-4 font-mono">
                                        <span className="font-extrabold text-indigo-600">{row.callId}</span>
                                        <span className="block text-[10px] text-slate-400 mt-0.5">{row.time}</span>
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <p className="font-semibold text-slate-900">{row.incident}</p>
                                        <span className="text-[10px] text-slate-400 font-mono">{row.classification}</span>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                            <span>{row.location}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                                        {row.duration}
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600 font-medium text-[11px]">
                                        {row.operator}
                                    </td>
                                    <td className="py-3.5 px-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${row.outcomeColor}`}>
                                            {row.outcome}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-right">
                                        <button
                                            onClick={() => togglePlay(row.callId)}
                                            className={`p-2 rounded-xl border transition-all inline-flex items-center justify-center ${
                                                playingId === row.callId 
                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm animate-pulse' 
                                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                            title="Play Audio Recording"
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

export default CallHistoryModal;
