import React from 'react';
import { Activity } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const PipelineTelemetryWidget = () => {
    const { latencies, packetLoss, jitterBuffer } = useLiveStream();

    const pipelineStages = [
        { stage: "Carrier Ingestion (Twilio)", ms: latencies[0] || 12, pct: 6, color: "bg-slate-400", desc: "SIP trunk negotiation" },
        { stage: "Audio Pre-Processing (Agora ANS)", ms: latencies[1] || 8, pct: 4, color: "bg-sky-400", desc: "Acoustic noise filter" },
        { stage: "Speech-to-Text (Deepgram Nova-2)", ms: latencies[2] || 45, pct: 21, color: "bg-blue-400", desc: "Real-time bilingual streaming" },
        { stage: "Emergency Triage (LLM Reasoner)", ms: latencies[3] || 120, pct: 54, color: "bg-blue-600", desc: "Slot extraction & risk score" },
        { stage: "Voice Synthesis (ElevenLabs TTS)", ms: latencies[4] || 32, pct: 15, color: "bg-sky-500", desc: "Low-latency neural audio" },
    ];

    const totalLatency = latencies.reduce((a, b) => a + b, 0);

    return (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-4 gsap-stagger-child shadow-xs">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>End-to-End Pipeline Telemetry &amp; Jitter</span>
                </h4>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                    Total: {totalLatency}ms Round-Trip
                </span>
            </div>

            {/* Waterfall breakdown bars */}
            <div className="space-y-2.5">
                {pipelineStages.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-700">{item.stage}</span>
                            <span className="font-mono font-bold text-slate-800">{item.ms}ms <span className="text-slate-400 font-normal">({item.pct}%)</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }}/>
                        </div>
                    </div>
                ))}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">STT Accuracy</span>
                    <span className="text-sm font-bold font-mono text-blue-600">99.2%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Packet Loss</span>
                    <span className="text-sm font-bold font-mono text-slate-800">{packetLoss}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Jitter Buffer</span>
                    <span className="text-sm font-bold font-mono text-indigo-600">{jitterBuffer}</span>
                </div>
            </div>
        </div>
    );
};

export default PipelineTelemetryWidget;
