import React, { useState } from 'react';
import { 
    PhoneCall, 
    AlertTriangle, 
    Truck, 
    Mic, 
    Maximize2, 
    MapPin, 
    AlertCircle, 
    Activity, 
    Clock, 
    Zap, 
    Send, 
    VolumeX, 
    Headphones,
    MessageSquare,
    ShieldAlert,
    Radio
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const PrimaryCards = ({ onCardClick, onToast }) => {
    const { 
        transcriptSegments, 
        activeCalls, 
        alerts, 
        takeOverCall 
    } = useLiveStream();

    const [isMuted, setIsMuted] = useState(false);
    const [dispatched, setDispatched] = useState(false);

    const highRiskCount = (activeCalls || []).filter(c => c.risk === 'HIGH').length;
    const p1AlertsCount = (alerts || []).length;

    const handleTakeOver = () => {
        takeOverCall('C-1021');
        if (onToast) onToast('Supervisor SUP-004 took over Line C-1021', 'zap');
    };

    const handleDispatch = () => {
        setDispatched(true);
        if (onToast) onToast('Emergency Units Dispatched: Amb-02 (4m ETA) & PCR-14 (2m ETA)', 'siren');
    };

    const handleMuteToggle = () => {
        setIsMuted(prev => !prev);
        if (onToast) onToast(isMuted ? 'Agent Nova voice unmuted' : 'Agent Nova voice muted', 'mute');
    };

    return (
        <div className="space-y-6">

            {/* ROW 1: TOP 3 OPERATIONAL SITUATIONAL AWARENESS METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Metric Card 1: Active Concurrent Voice Lines */}
                <div 
                    onClick={(e) => onCardClick('active-calls', e)}
                    className="glass-surface rounded-2xl p-6 flex flex-col justify-between cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <PhoneCall className="w-3.5 h-3.5" />
                            </span>
                            Active Concurrent Lines
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 font-semibold flex items-center gap-0.5">
                            Registry <Maximize2 className="w-3 h-3" />
                        </span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">
                                {activeCalls?.length || 6}
                            </span>
                            <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {highRiskCount} High-Risk Priority-1 Lines
                            </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            SIP TRUNK 100%
                        </span>
                    </div>
                </div>

                {/* Metric Card 2: Agora ANS Audio Stream */}
                <div 
                    onClick={(e) => onCardClick('audio-stream', e)}
                    className="glass-surface rounded-2xl p-6 flex flex-col justify-between cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Radio className="w-3.5 h-3.5" />
                            </span>
                            Agora ANS Audio Stream
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-600 font-semibold flex items-center gap-0.5">
                            Workbench <Maximize2 className="w-3 h-3" />
                        </span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-3xl font-extrabold font-mono text-slate-900 leading-none">
                                24<span className="text-sm font-normal text-slate-400 font-sans">kHz</span>
                            </span>
                            <p className="text-xs font-semibold text-slate-600 mt-2">
                                Neural Noise Suppression Active
                            </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            HD OPUS
                        </span>
                    </div>
                </div>

                {/* Metric Card 3: Emergency Triage Flags */}
                <div 
                    onClick={(e) => onCardClick('emergency-dispatch', e)}
                    className="glass-surface-critical rounded-2xl p-6 flex flex-col justify-between cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                <ShieldAlert className="w-3.5 h-3.5" />
                            </span>
                            Emergency Triage Flags
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-rose-600 font-semibold flex items-center gap-0.5">
                            Dispatch <Maximize2 className="w-3 h-3" />
                        </span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-3xl font-extrabold font-mono text-rose-600 leading-none">
                                {p1AlertsCount}
                            </span>
                            <p className="text-xs font-semibold text-slate-600 mt-2">
                                Critical Priority-1 Interventions
                            </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            92% RISK
                        </span>
                    </div>
                </div>

            </div>

            {/* ROW 2: CORE OPERATIONAL WORKSPACE (Transcription, Metadata, Zero-Scroll Override) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Panel 1: Live Call Transcription Window with Micro-Action Overrides */}
                <div 
                    onClick={(e) => onCardClick('transcription', e)}
                    className="glass-surface rounded-2xl p-6 flex flex-col h-[450px] cursor-pointer group"
                >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                            <Mic className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <span>Live Call Transcription</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5">
                            Line C-1021 <Maximize2 className="w-3 h-3" />
                        </span>
                    </div>

                    {/* Structured Speech Segments */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-smooth-scroll font-sans">
                        {(transcriptSegments || []).map((seg) => (
                            <div 
                                key={seg.id}
                                className={`p-3 rounded-xl border text-xs transition-all ${
                                    seg.isAi 
                                        ? 'bg-indigo-50/70 border-indigo-100 text-slate-900' 
                                        : 'bg-slate-50 border-slate-200/80 text-slate-900'
                                }`}
                            >
                                <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-indigo-600">[{seg.timestamp}]</span>
                                        <span className={`font-semibold uppercase tracking-wider ${seg.isAi ? 'text-indigo-700' : 'text-slate-700'}`}>
                                            {seg.speaker}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-slate-400">{seg.confidence}</span>
                                </div>
                                <p className="font-medium text-slate-800 leading-relaxed text-xs">
                                    "{seg.text}"
                                </p>
                            </div>
                        ))}

                        {/* Live Transcribing Interim Stream */}
                        <div className="p-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 text-xs">
                            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-indigo-600">[00:14.2]</span>
                                    <span className="font-semibold text-slate-700 uppercase">SPEAKER_01 (Caller)</span>
                                </div>
                                <span className="text-indigo-600 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                                    Transcribing...
                                </span>
                            </div>
                            <p className="font-medium text-slate-700 leading-relaxed italic text-xs">
                                "Bheed ikattha ho rahi hai metro pillar 42 ke saamne, jaldi ambulance bhejo..."
                            </p>
                        </div>
                    </div>

                    {/* Supervisor Quick Micro-Action Overrides */}
                    <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between gap-2"
                    >
                        <button
                            onClick={() => onToast && onToast('Supervisor patched in to live audio stream', 'listen')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                        >
                            <Headphones className="w-3 h-3 text-slate-500" /> Patch In
                        </button>
                        <button
                            onClick={() => onToast && onToast('Whisper channel opened for Line C-1021', 'zap')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors border border-indigo-100"
                        >
                            <MessageSquare className="w-3 h-3 text-indigo-500" /> Whisper
                        </button>
                        <button
                            onClick={handleMuteToggle}
                            className={`py-1.5 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors border ${
                                isMuted 
                                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                        >
                            <VolumeX className="w-3 h-3" /> {isMuted ? 'Unmute' : 'Mute Bot'}
                        </button>
                    </div>
                </div>

                {/* Panel 2: AI Extracted Metadata (Instant Slot-Filling) */}
                <div 
                    onClick={(e) => onCardClick('metadata', e)}
                    className="glass-surface rounded-2xl p-6 flex flex-col justify-between cursor-pointer group h-[450px]"
                >
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 text-indigo-600" />
                                AI Extracted Metadata
                            </span>
                            <span className="text-xs font-mono font-semibold text-indigo-600 group-hover:underline flex items-center gap-1">
                                Details <Maximize2 className="w-3 h-3" />
                            </span>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Incident Classification</span>
                                <span className="font-mono font-bold text-slate-900">Road Traffic Collision</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Exact Location
                                </span>
                                <span className="font-mono font-bold text-slate-900">Sector 18 Metro Pillar 42</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Injury &amp; Trauma Status</span>
                                <span className="font-mono font-bold text-rose-600">Severe Shock / Hemorrhage</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium">Golden Hour Urgency</span>
                                <span className="font-mono font-bold text-rose-600">&lt; 8 Mins Required</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                    <Activity className="w-3.5 h-3.5 text-indigo-500" /> Caller Distress Cadence
                                </span>
                                <span className="font-mono font-bold text-slate-900">148 WPM (Distressed)</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono flex items-center justify-between">
                        <span>Language: <strong>Hinglish (Code-Switch)</strong></span>
                        <span className="text-indigo-600 font-bold">Slot Confidence: 98.4%</span>
                    </div>
                </div>

                {/* Panel 3: High-Risk Override & Emergency Dispatch Panel (Zero-Scroll Immediate Access) */}
                <div 
                    onClick={(e) => onCardClick('risk-override', e)}
                    className="glass-surface-critical rounded-2xl p-6 flex flex-col justify-between cursor-pointer group h-[450px]"
                >
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5 font-mono">
                                <ShieldAlert className="w-4 h-4 text-rose-600" />
                                High-Risk Override &amp; Dispatch
                            </span>
                            <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                92% CRITICAL
                            </span>
                        </div>

                        {/* Quantitative Risk Breakdown */}
                        <div className="space-y-2 text-xs mb-4">
                            <div>
                                <div className="flex justify-between text-[11px] mb-1 font-mono text-slate-600">
                                    <span>Acoustic Vocal Cadence Stress</span>
                                    <strong className="text-rose-600">94%</strong>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '94%' }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[11px] mb-1 font-mono text-slate-600">
                                    <span>Trauma Slot Severity Entity</span>
                                    <strong className="text-rose-600">89%</strong>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '89%' }} />
                                </div>
                            </div>
                        </div>

                        {/* Nearest First Responder Units with Live ETA */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900">
                                <span>Ambulance Amb-02 (ALS)</span>
                                <span className="font-mono font-bold text-rose-600 bg-white px-2 py-0.5 rounded border border-slate-200">4m ETA</span>
                            </div>
                            <div className="flex items-center justify-between font-semibold text-slate-900">
                                <span>PCR-14 Sector 18 Patrol</span>
                                <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">2m ETA</span>
                            </div>
                        </div>
                    </div>

                    {/* Zero-Scroll Action Triggers */}
                    <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="pt-3 border-t border-slate-100 flex flex-col gap-2"
                    >
                        <button
                            onClick={handleTakeOver}
                            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
                        >
                            <Zap className="w-4 h-4" /> Take Over Call (SUP-004)
                        </button>
                        <button
                            onClick={handleDispatch}
                            disabled={dispatched}
                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all ${
                                dispatched 
                                    ? 'bg-slate-800 text-white cursor-default' 
                                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                        >
                            <Send className="w-4 h-4" /> {dispatched ? '✓ Units Mobilized & Dispatched' : 'Dispatch Emergency Units'}
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default PrimaryCards;
