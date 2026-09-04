import React, { useState } from 'react';
import { Terminal, Tag, CheckCircle2, Activity, Layers } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

const SLOT_MODELS = [
    { slot: 'Geo-Location Extraction', model: 'Deepgram NER + GeoCoder v4', accuracy: 99.4, latency: '12ms', engine: 'Agora WebRTC Voice' },
    { slot: 'Trauma & Injury Severity', model: 'BioClinical-GPT SlotFiller', accuracy: 98.8, latency: '24ms', engine: 'Inference Node-09' },
    { slot: 'Hazard Classification', model: 'LPG/Fire Incident Classifier', accuracy: 99.1, latency: '18ms', engine: 'HazMat Engine' },
    { slot: 'Acoustic Distress & Cadence', model: 'Agora ANS Wav2Vec Cadence', accuracy: 97.9, latency: '9ms', engine: 'Neural Audio DSP' }
];

const AGENT_PROMPT_TEMPLATES = {
    'agent-nova': 'You are Agent Nova, lead triage dispatcher for Delhi NCR EMS. Speak with calm clinical authority in Hinglish/English. Immediately extract Location, Injuries, and Shock level. Flag trauma to SUP-004.',
    'agent-rhea': 'Aap Agent Rhea hain, Uttar Pradesh aur NCR kshetra ke primary Hindi dispatch agent. Shuddh Hindi aur regional boli mein spashtata se baat karein. Sabse pehle sthan aur aapatkaal ki sthiti verify karein. Vitals par nazar rakhein.',
    'agent-aegis': 'You are Agent Aegis, specializing in hazardous materials, structural fires, and gas leaks. Calculate hazard perimeter and wind direction immediately. Instruct evacuation upwind and notify HazMat Squad FT-07.',
    'agent-echo': 'You are Agent Echo, certified BLS instructor. Guide caller through continuous 100-120 BPM chest compressions and airway management until ALS Ambulance Amb-02 arrives. Keep caller grounded and calm.'
};

const PROMPT_VARIABLES = ['{location}', '{injuries}', '{cadence}', '{urgency}'];

export const AgentsView = () => {
    const { agents, toggleAgentMode } = useLiveStream();
    const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || 'agent-nova');
    const [prompts, setPrompts] = useState(AGENT_PROMPT_TEMPLATES);
    const [isSaved, setIsSaved] = useState(false);

    const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
    const currentPrompt = prompts[selectedAgent.id] || AGENT_PROMPT_TEMPLATES[selectedAgent.id] || '';

    const handlePromptChange = (val) => {
        setPrompts(prev => ({ ...prev, [selectedAgent.id]: val }));
        setIsSaved(false);
    };

    const handleInsertVar = (v) => {
        setPrompts(prev => ({ ...prev, [selectedAgent.id]: `${prev[selectedAgent.id] || ''} ${v}`.trim() }));
        setIsSaved(false);
    };

    const handleDeploy = () => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2400);
    };

    return (
        <div className="space-y-4">
            {/* 1. Exactly 4 Horizontal Agent Cards Across Top (Spacious & Clean CAD Architecture) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map(agent => {
                    const isSelected = selectedAgent.id === agent.id;
                    const isGuarded = agent.mode === 'Supervisor Guarded';
                    return (
                        <div
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={`group relative rounded-2xl p-5 cursor-pointer transition-all duration-200 backdrop-blur-2xl border flex flex-col justify-between h-full min-h-[205px] ${
                                isSelected
                                    ? 'bg-white/95 border-blue-500 shadow-md ring-2 ring-blue-500/20 -translate-y-0.5'
                                    : 'bg-white/80 border-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:bg-white hover:border-slate-200 hover:-translate-y-0.5'
                            }`}
                        >
                            {/* Card Top Section: Status & Dedicated Mode Button */}
                            <div>
                                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-emerald-600">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="tracking-wide text-emerald-700">ONLINE</span>
                                    </div>

                                    {/* Dispatch Mode Button with Generous Spacing and Tactile Styling */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleAgentMode(agent.id);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer select-none active:scale-95 ${
                                            isGuarded
                                                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/90 ring-1 ring-amber-400/20'
                                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/90'
                                        }`}
                                        title="Click to toggle operational dispatch mode"
                                    >
                                        <Activity className={`w-3 h-3 ${isGuarded ? 'text-amber-600' : 'text-blue-600'}`} />
                                        <span>{agent.mode}</span>
                                    </button>
                                </div>

                                {/* Agent Identity & Specialization */}
                                <div className="flex items-start gap-3">
                                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-b from-white/95 to-blue-50/60 border border-white shadow-xs flex items-center justify-center p-1 flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <img 
                                            src="/assets/agent-orb.png" 
                                            alt={agent.name} 
                                            className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(56,189,248,0.22)] select-none"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug truncate">
                                            {agent.name}
                                        </h4>
                                        <span className="text-[10px] font-mono text-blue-600 font-semibold block mt-0.5">
                                            {agent.ttsVoice.split(' ')[0]} AI • {agent.supportedLangs[0]}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-2.5 leading-relaxed min-h-[34px] line-clamp-2">
                                    {agent.role}
                                </p>
                            </div>

                            {/* Telemetry Micro-Readout Footer */}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px] font-mono">
                                <span className="text-slate-500">
                                    Latency: <strong className="text-slate-800 font-bold">{agent.latency}</strong>
                                </span>
                                <span className="text-slate-500">
                                    Acc: <strong className="text-blue-600 font-bold">{agent.accuracy}</strong>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 2. Bottom Row: Compact System Triage Prompt Editor (Left) & Active Slot-Filling Models (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Bottom-Left: System Triage Prompt Editor (Zero Empty White Space) */}
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 flex flex-col space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100/80">
                        <div className="flex items-center gap-2.5">
                            <div className="relative w-8 h-8 rounded-full bg-gradient-to-b from-white/95 to-blue-50/60 border border-white shadow-xs flex items-center justify-center p-0.5 flex-shrink-0">
                                <img 
                                    src="/assets/agent-orb.png" 
                                    alt={selectedAgent.name} 
                                    className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(56,189,248,0.22)] select-none"
                                />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider leading-none">
                                    System Triage Prompt • {selectedAgent.name}
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">system.prompt.jinja2 • Zero-Shot Guardrails</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 border border-slate-200/70">
                            {currentPrompt.length} chars
                        </span>
                    </div>

                    {/* Studio Editor Canvas - Naturally fills container height */}
                    <div className="flex-1 flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 focus-within:border-indigo-400 focus-within:bg-white/90 transition-all shadow-inner">
                        <textarea
                            value={currentPrompt}
                            onChange={(e) => handlePromptChange(e.target.value)}
                            className="w-full flex-1 bg-transparent font-mono text-xs text-slate-800 leading-relaxed focus:outline-none resize-none selection:bg-indigo-100 min-h-[140px]"
                            placeholder="Enter system prompt instruction..."
                        />
                    </div>

                    {/* Single-Line Monospace Variables & Save Action */}
                    <div className="space-y-2 pt-0.5 mt-auto">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-indigo-500" /> Slots:
                            </span>
                            {PROMPT_VARIABLES.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleInsertVar(v)}
                                    className="px-2 py-0.5 rounded font-mono text-[10px] font-medium bg-white/90 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 shadow-2xs hover:shadow-xs transition-all"
                                >
                                    +{v}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
                            <span className="text-[10px] font-mono text-slate-400">Target: Agora Real-Time RTC Inference</span>
                            <button
                                onClick={handleDeploy}
                                className={`py-1.5 px-3 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ${
                                    isSaved 
                                        ? 'bg-blue-600 text-white shadow-blue-500/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                }`}
                            >
                                {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                                {isSaved ? 'Deployed' : 'Save Template'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom-Right: Live Entity Extraction Pipeline Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 shadow-sm rounded-2xl p-4 flex flex-col justify-between space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-150">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/60">
                                <Layers className="w-3.5 h-3.5" />
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

                    {/* Pipeline Rows with Clean Telemetry & High-Contrast Status Pills */}
                    <div className="space-y-2 flex-1">
                        {SLOT_MODELS.map((slot, idx) => {
                            const isOptimal = slot.accuracy >= 98.0;
                            return (
                                <div 
                                    key={idx} 
                                    className="p-3 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-150/80 shadow-2xs hover:bg-white/95 hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                                >
                                    {/* Left: Slot Name & Latency Badge, Clean Sub-Labels */}
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

                                    {/* Right: Soft, High-Contrast Status Pill (Emerald for >98%, Amber for Reviewing) */}
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
