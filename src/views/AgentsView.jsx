import React, { useState } from 'react';
import { 
    Terminal, 
    CheckCircle2, 
    Activity, 
    Layers, 
    Globe, 
    Cpu, 
    Volume2, 
    ShieldCheck, 
    ShieldAlert, 
    Radio, 
    Waves,
    Mic
} from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

const SLOT_MODELS = [
    { slot: 'Geo-Location Extraction', model: 'Deepgram NER + GeoCoder v4', accuracy: 99.4, latency: '12ms', engine: 'Agora WebRTC Voice' },
    { slot: 'Trauma & Injury Severity', model: 'BioClinical-GPT SlotFiller', accuracy: 98.8, latency: '24ms', engine: 'Inference Node-09' },
    { slot: 'Hazard Classification', model: 'LPG/Fire Incident Classifier', accuracy: 99.1, latency: '18ms', engine: 'HazMat Engine' },
    { slot: 'Acoustic Distress & Cadence', model: 'Agora ANS Wav2Vec Cadence', accuracy: 97.9, latency: '9ms', engine: 'Neural Audio DSP' }
];

const UNIFIED_SYSTEM_PROMPT = `You are RESCURO Core, the primary unified emergency medical triage and incident dispatch voice AI for the Delhi NCR command region.
Operate with clinical authority, rapid situational assessment, and absolute composure under extreme distress.

MULTILINGUAL CODE-SWITCHING & DIALECT HANDLING:
- Actively parse and respond in the caller's language: Native English, Hindi, or conversational Hinglish.
- If the caller code-switches mid-utterance (e.g. 'Bhaiya, accident ho gaya near metro station, severe bleeding ho rahi hai'), immediately match with clear, grounding Hinglish instructions.
- Prioritize high-urgency biomedical slot extraction: {location}, {injuries}, {cadence}, {urgency}, {dialect}.

CRITICAL TRIAGE PROTOCOLS:
1. VERIFY LOCATION & SAFE PERIMETER: Pin exact cross-streets, metro pillars, or sector landmarks immediately.
2. TRIAGE CATEGORIZATION: Classify into Trauma Code Red, Cardiac / Unresponsive, Structural/Fire Hazard, or Basic Life Support (BLS).
3. CONTINUOUS LIFE SUPPORT: Guide bystander through compressions (100-120 BPM) or hemorrhage pressure while units roll.
4. SUPERVISOR ESCALATION: Instantly flag high-risk or ambiguous calls to SUP-004 for priority audio take-over.`;

const PROMPT_VARIABLES = ['{location}', '{injuries}', '{cadence}', '{urgency}', '{dialect}'];

export const AgentsView = () => {
    const { agents, toggleAgentMode } = useLiveStream();
    const [prompt, setPrompt] = useState(UNIFIED_SYSTEM_PROMPT);
    const [isSaved, setIsSaved] = useState(false);

    // Single unified agent state
    const agent = agents?.[0] || {
        id: 'agent-core',
        name: 'RESCURO Core — Unified Multilingual Agent',
        role: 'Autonomous Emergency Medical Triage, Multi-Dialect Code-Switching & Hazard Dispatch',
        mode: 'Autonomous',
        latency: '34ms',
        accuracy: '99.4%',
        activeCalls: 6,
        totalCalls: 1510
    };

    const isGuarded = agent.mode === 'Supervisor Guarded';

    const handlePromptChange = (val) => {
        setPrompt(val);
        setIsSaved(false);
    };

    const handleInsertVar = (v) => {
        setPrompt(prev => `${prev} ${v}`.trim());
        setIsSaved(false);
    };

    const handleDeploy = () => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2400);
    };

    return (
        <div className="space-y-5">
            {/* 1. SINGLE PROMINENT UNIFIED MULTILINGUAL AGENT OPERATIONAL CARD */}
            <div className="bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-2xl p-6 transition-all">
                {/* Header: Beacon, Engine Identity & Mode Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>ONLINE</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">•</span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold uppercase tracking-wider">
                            Unified Dispatch Kernel • Agora WebRTC Full-Duplex
                        </span>
                    </div>

                    {/* Operational Dispatch Mode Toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
                            Mode:
                        </span>
                        <button
                            onClick={() => toggleAgentMode(agent.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-2 shadow-2xs cursor-pointer select-none active:scale-95 ${
                                isGuarded
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/90 ring-1 ring-amber-400/20'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/90'
                            }`}
                            title="Click to toggle operational dispatch mode"
                        >
                            {isGuarded ? (
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                                <Activity className="w-3.5 h-3.5 text-blue-600" />
                            )}
                            <span>{agent.mode}</span>
                        </button>
                    </div>
                </div>

                {/* Agent Core Profile Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Identity & Mission */}
                    <div className="flex items-start gap-4">
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-white to-blue-50/70 border border-slate-200/80 shadow-xs flex items-center justify-center p-2 flex-shrink-0">
                            <img 
                                src="/assets/agent-orb.png" 
                                alt="RESCURO Core" 
                                className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(56,189,248,0.3)] select-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                    RESCURO Core — Unified Multilingual Agent
                                </h3>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                    v2.4 Production Engine
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
                                Autonomous emergency triage and incident dispatch engine handling callers across Delhi NCR with zero-latency, real-time code-switching between English, Hindi, and colloquial Hinglish.
                            </p>
                        </div>
                    </div>

                    {/* Quick Telemetry Pills */}
                    <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-left min-w-[110px]">
                            <span className="text-[10px] font-mono text-slate-400 block font-semibold">Active Lines</span>
                            <span className="text-sm font-mono font-bold text-slate-800">
                                {agent.activeCalls ?? 6} Concurrent
                            </span>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-left min-w-[110px]">
                            <span className="text-[10px] font-mono text-slate-400 block font-semibold">Stream Latency</span>
                            <span className="text-sm font-mono font-bold text-indigo-600">
                                {agent.latency ?? '34ms'}
                            </span>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-left min-w-[110px]">
                            <span className="text-[10px] font-mono text-slate-400 block font-semibold">Slot Accuracy</span>
                            <span className="text-sm font-mono font-bold text-emerald-600">
                                {agent.accuracy ?? '99.4%'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4 Multi-Dialect & Pipeline Telemetry Capability Modules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
                    {/* Capability 1: Multilingual Code-Switching */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs hover:bg-white hover:border-indigo-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-indigo-600" />
                                Code-Switching
                            </span>
                            <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">
                                Dynamic
                            </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                            English • Hindi • Hinglish
                        </h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Real-time dialect adaptation & bi-directional translation
                        </p>
                    </div>

                    {/* Capability 2: Streaming ASR Parser */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs hover:bg-white hover:border-indigo-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Mic className="w-3 h-3 text-blue-600" />
                                Streaming ASR
                            </span>
                            <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                                Realtime
                            </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                            Deepgram Nova-2 Engine
                        </h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Sub-token audio streaming • Word error rate &lt; 1.2%
                        </p>
                    </div>

                    {/* Capability 3: Neural Noise Suppression */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs hover:bg-white hover:border-indigo-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Waves className="w-3 h-3 text-emerald-600" />
                                Noise Suppression
                            </span>
                            <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                Active
                            </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                            Agora ANS Multi-Band DSP
                        </h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Siren, traffic, & acoustic distress echo isolation
                        </p>
                    </div>

                    {/* Capability 4: Biomedical Triage Precision */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs hover:bg-white hover:border-indigo-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Cpu className="w-3 h-3 text-purple-600" />
                                Biomedical Triage
                            </span>
                            <span className="text-[9px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                                99.4%
                            </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">
                            BioClinical-GPT Core
                        </h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Zero-shot injury severity & shock index evaluation
                        </p>
                    </div>
                </div>

                {/* Dialect Distribution Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        Live Regional Dialect Allocation:
                    </span>
                    <div className="flex items-center gap-4 flex-wrap">
                        <span>English (EN-IN): <strong className="text-slate-900">42%</strong></span>
                        <span>Hindi (HI-IN): <strong className="text-slate-900">38%</strong></span>
                        <span>Hinglish (Colloquial): <strong className="text-indigo-600">20%</strong></span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                            Auto Code-Switching Engaged
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. SYSTEM PROMPT CONFIGURATION (LEFT) & LIVE EXTRACTION PIPELINE (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Left: Unified System Triage Prompt Editor */}
                <div className="bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-2xl p-5 flex flex-col space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider leading-none">
                                    Unified System Instruction • RESCURO Core
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">system.prompt.jinja2 • Multilingual Zero-Shot Guardrails</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 border border-slate-200/70">
                            {prompt.length} chars
                        </span>
                    </div>

                    {/* Studio Editor Canvas */}
                    <div className="flex-1 flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 focus-within:border-indigo-400 focus-within:bg-white/95 transition-all shadow-inner">
                        <textarea
                            value={prompt}
                            onChange={(e) => handlePromptChange(e.target.value)}
                            className="w-full flex-1 bg-transparent font-mono text-xs text-slate-800 leading-relaxed focus:outline-none resize-none selection:bg-indigo-100 min-h-[170px]"
                            placeholder="Enter unified multilingual system prompt instruction..."
                        />
                    </div>

                    {/* Monospace Variables & Save Action */}
                    <div className="space-y-2 pt-1 mt-auto">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-indigo-500" /> Triage Slots:
                            </span>
                            {PROMPT_VARIABLES.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleInsertVar(v)}
                                    className="px-2 py-0.5 rounded font-mono text-[10px] font-medium bg-white/90 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                >
                                    +{v}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                            <span className="text-[10px] font-mono text-slate-400">
                                Target: Agora Real-Time RTC Inference • Deepgram Pipeline
                            </span>
                            <button
                                onClick={handleDeploy}
                                className={`py-1.5 px-3.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSaved 
                                        ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-95'
                                }`}
                            >
                                {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                                {isSaved ? 'Deployed' : 'Save & Deploy Instruction'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Live Entity Extraction Pipeline Card */}
                <div className="bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-2xl p-5 flex flex-col justify-between space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/60">
                                <Layers className="w-4 h-4" />
                            </span>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider leading-none">
                                    Live Entity Extraction Pipeline
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">Continuous Multi-Model Semantic Parser</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
                            </span>
                            4 Slots Active
                        </span>
                    </div>

                    {/* Pipeline Rows with Clean Telemetry */}
                    <div className="space-y-2 flex-1">
                        {SLOT_MODELS.map((slot, idx) => {
                            const isOptimal = slot.accuracy >= 98.0;
                            return (
                                <div 
                                    key={idx} 
                                    className="p-3 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-150/80 shadow-2xs hover:bg-white/95 hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                                >
                                    {/* Left: Slot Name & Latency Badge */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 tracking-tight">
                                                {slot.slot}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                                {slot.latency}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                            <span>{slot.model}</span>
                                            <span className="mx-1.5 text-slate-300">•</span>
                                            <span className="text-slate-500 font-medium">{slot.engine}</span>
                                        </div>
                                    </div>

                                    {/* Right: Soft, High-Contrast Status Pill */}
                                    <div className="flex-shrink-0">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border shadow-2xs ${
                                            isOptimal
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
                                                : 'bg-amber-50 text-amber-800 border-amber-200/90'
                                        }`}>
                                            <CheckCircle2 className={`w-3 h-3 ${isOptimal ? 'text-emerald-600' : 'text-amber-600'}`} />
                                            <span>{slot.accuracy}%</span>
                                            <span className="text-[9px] uppercase font-semibold opacity-80">
                                                {isOptimal ? 'Optimal' : 'Review'}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Sync Telemetry */}
                    <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100/80 text-[10px] font-mono text-indigo-700 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                            Agora RTC Neural Audio Sync:
                        </span>
                        <strong className="font-bold text-indigo-900">Locked (0.0ms Jitter)</strong>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AgentsView;
