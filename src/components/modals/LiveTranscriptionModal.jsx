import React, { useState } from 'react';
import { 
    Mic, 
    Copy, 
    Download, 
    Tag, 
    Clock, 
    Volume2, 
    Send, 
    Check, 
    Zap, 
    MapPin, 
    AlertTriangle,
    FileText
} from 'lucide-react';
import { useLiveStream } from '../../context/LiveStreamContext';

const FULL_TRANSCRIPT_DATA = [
    {
        id: 't-1',
        timestamp: '00:01.8',
        speaker: 'SPEAKER_01 (Caller)',
        channel: 'Ch 1 • Inbound SIP',
        confidence: '98.6%',
        text: 'Accident ho gaya hai, Sector 18 Noida mein metro station ke paas!',
        entities: [{ text: 'Sector 18 Noida', type: 'LOCATION' }, { text: 'metro station', type: 'LANDMARK' }],
        isAi: false
    },
    {
        id: 't-2',
        timestamp: '00:05.3',
        speaker: 'AI AGENT NOVA (Triage)',
        channel: 'Ch 2 • TTS Synthesizer',
        confidence: '42ms Latency',
        text: 'Please stay calm. Emergency services are being notified. Can you confirm if anyone is injured?',
        entities: [],
        isAi: true
    },
    {
        id: 't-3',
        timestamp: '00:09.6',
        speaker: 'SPEAKER_01 (Caller)',
        channel: 'Ch 1 • Inbound SIP',
        confidence: '97.2%',
        text: 'Ek aadmi ko bahut chot lagi hai, khoon beh raha hai... Jaldi kijiye!',
        entities: [{ text: 'bahut chot lagi', type: 'INJURY' }, { text: 'khoon beh raha hai', type: 'TRAUMA' }],
        isAi: false
    },
    {
        id: 't-4',
        timestamp: '00:13.1',
        speaker: 'AI AGENT NOVA (Triage)',
        channel: 'Ch 2 • TTS Synthesizer',
        confidence: '38ms Latency',
        text: 'Understood. An Advanced Life Support ambulance (Amb-02) is dispatched to Sector 18. Do not move the patient unless there is fire risk. Can you see breathing?',
        entities: [{ text: 'Amb-02 dispatched', type: 'ACTION' }],
        isAi: true
    },
    {
        id: 't-5',
        timestamp: '00:17.8',
        speaker: 'SPEAKER_01 (Caller)',
        channel: 'Ch 1 • Inbound SIP',
        confidence: '99.1%',
        text: 'Haan saans le raha hai, par behosh lag raha hai. Metro pillar 42 ke theek saamne!',
        entities: [{ text: 'behosh', type: 'VITALS' }, { text: 'Metro pillar 42', type: 'LOCATION' }],
        isAi: false
    }
];

export const LiveTranscriptionModal = ({ onToast }) => {
    const { activeCalls, takeOverCall } = useLiveStream();
    const [copied, setCopied] = useState(false);
    const [supervisorNote, setSupervisorNote] = useState('');

    const handleCopy = () => {
        const text = FULL_TRANSCRIPT_DATA.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n\n');
        navigator.clipboard?.writeText(text);
        setCopied(true);
        if (onToast) onToast('Full transcript copied to clipboard with timestamps', 'copy');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendPromptInjection = (e) => {
        e.preventDefault();
        if (!supervisorNote.trim()) return;
        if (onToast) onToast(`Prompt injected to Agent Nova: "${supervisorNote}"`, 'zap');
        setSupervisorNote('');
    };

    return (
        <div className="space-y-6">
            {/* Top Telemetry Banner */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Mic className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-sm text-indigo-600">Line C-1021</span>
                            <span className="text-xs font-mono text-slate-400">Live 2-Way Diarization</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Deepgram Nova-2 Multilingual Engine • Hinglish Phoneme Code-Switching
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        {copied ? 'Copied!' : 'Copy Transcript'}
                    </button>
                    <button
                        onClick={() => onToast && onToast('Exported C-1021 verbatim transcript (JSON/SRT)', 'download')}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        Export JSON/SRT
                    </button>
                </div>
            </div>

            {/* Main Content: 2-Column (Transcript Stream + Entity / Telemetry Panel) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left 2 Cols: Expanded Verbatim Transcript Stream */}
                <div className="lg:col-span-2 space-y-3 max-h-[460px] overflow-y-auto pr-1.5 custom-smooth-scroll">
                    {FULL_TRANSCRIPT_DATA.map((seg) => (
                        <div 
                            key={seg.id}
                            className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all ${
                                seg.isAi 
                                    ? 'bg-indigo-50/70 border-indigo-100 text-slate-900' 
                                    : 'bg-white border-slate-200/90 text-slate-900 shadow-2xs'
                            }`}
                        >
                            <div className="flex items-center justify-between text-[11px] font-mono pb-2 border-b border-slate-100 mb-2.5 text-slate-400">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-indigo-600">[{seg.timestamp}]</span>
                                    <span className={`font-bold uppercase tracking-wider ${seg.isAi ? 'text-indigo-700' : 'text-slate-800'}`}>
                                        {seg.speaker}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">({seg.channel})</span>
                                </div>
                                <span className="text-xs font-mono font-semibold text-slate-400">
                                    {seg.confidence}
                                </span>
                            </div>

                            <p className="text-sm font-medium text-slate-900 leading-relaxed">
                                "{seg.text}"
                            </p>

                            {/* Extracted Entity Tags */}
                            {seg.entities.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 flex-wrap">
                                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> Extracted Slots:
                                    </span>
                                    {seg.entities.map((ent, i) => (
                                        <span 
                                            key={i} 
                                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                                ent.type === 'LOCATION' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                ent.type === 'TRAUMA' || ent.type === 'INJURY' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                'bg-slate-50 text-slate-700 border-slate-200'
                                            }`}
                                        >
                                            {ent.type}: {ent.text}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Real-time Interim Streaming Segment */}
                    <div className="p-4 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/30 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-600">[00:21.4]</span>
                                <span className="font-bold text-slate-800 uppercase">SPEAKER_01 (Caller)</span>
                                <span className="text-[10px] text-slate-400">(Ch 1 • Inbound SIP)</span>
                            </div>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Transcribing Real-Time Audio...
                            </span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                            "Police ki gaadi bhi aayi hui hai, par ambulance jaldi aana chahiye..."
                            <span className="inline-block w-1.5 h-4 bg-indigo-600 ml-1 animate-pulse align-middle"></span>
                        </p>
                    </div>
                </div>

                {/* Right Col: Transcription Telemetry & Supervisor Intervention */}
                <div className="space-y-4">
                    {/* STT Telemetry Metrics */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" /> Speech Engine Telemetry
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Inference Latency:</span>
                                <span className="font-mono font-bold text-indigo-600">42 ms (Carrier Grade)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Word Error Rate (WER):</span>
                                <span className="font-mono font-bold text-emerald-600">0.8%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Speech Cadence:</span>
                                <span className="font-mono font-bold text-slate-800">148 WPM (Urgent)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Code-Switch Detection:</span>
                                <span className="font-mono font-bold text-indigo-600">Hinglish (Hi-En)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Sample Frequency:</span>
                                <span className="font-mono font-bold text-slate-800">24,000 Hz HD</span>
                            </div>
                        </div>
                    </div>

                    {/* Supervisor Whisper Guidance / Prompt Injection */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <Zap className="w-3.5 h-3.5 text-amber-500" /> Supervisor Whisper Guidance
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Inject instructions directly into Agent Nova's runtime context window without interrupting the call.
                        </p>
                        <form onSubmit={handleSendPromptInjection} className="space-y-2">
                            <input
                                type="text"
                                placeholder="e.g. Ask if caller has tourniquet cloth..."
                                value={supervisorNote}
                                onChange={(e) => setSupervisorNote(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-400"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1 transition-all"
                                >
                                    <Send className="w-3 h-3" /> Inject Guidance
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        takeOverCall('C-1021');
                                        if (onToast) onToast('Supervisor SUP-004 took over Line C-1021', 'zap');
                                    }}
                                    className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1 transition-all"
                                >
                                    Take Over
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveTranscriptionModal;
