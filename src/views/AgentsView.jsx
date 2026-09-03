import React, { useState } from 'react';
import { Bot, Terminal, Tag, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';
import { AgentAvatar } from '../components/AgentAvatar';

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
            {/* 1. Exactly 4 Horizontal Agent Cards Across Top (Compact & Sleek) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map(agent => {
                    const isSelected = selectedAgent.id === agent.id;
                    return (
                        <div
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={`group relative rounded-2xl p-4 cursor-pointer transition-all duration-200 backdrop-blur-2xl border ${
                                isSelected
                                    ? 'bg-white/85 border-indigo-500 shadow-[0_8px_30px_rgba(99,102,241,0.12)]'
                                    : 'bg-white/65 border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white/75 hover:border-white hover:-translate-y-0.5'
                            }`}
                        >
                            {/* Header: Avatar, Name, Status & Mode Controller */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <AgentAvatar 
                                        size="md" 
                                        variant={isSelected ? 'indigo' : 'white'} 
                                        showStatus={true} 
                                        className="group-hover:scale-105 transition-transform" 
                                    />
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug truncate">{agent.name}</h4>
                                        <span className="text-[10px] font-mono font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ONLINE
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAgentMode(agent.id);
                                    }}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1 shadow-2xs ${
                                        agent.mode === 'Autonomous' 
                                            ? 'bg-indigo-50/90 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100' 
                                            : 'bg-amber-50/90 text-amber-700 border-amber-200/80 hover:bg-amber-100'
                                    }`}
                                >
                                    <Zap className="w-3 h-3" /> {agent.mode}
                                </button>
                            </div>

                            {/* Role Descriptor */}
                            <p className="text-[11px] text-slate-500 font-medium mt-2 truncate">
                                {agent.role}
                            </p>

                            {/* Telemetry Micro-Readout */}
                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100/80 text-[11px] font-mono">
                                <span className="text-slate-500">
                                    Latency: <strong className="text-indigo-600 font-bold">{agent.latency}</strong>
                                </span>
                                <span className="text-slate-500">
                                    Acc: <strong className="text-emerald-600 font-bold">{agent.accuracy}</strong>
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
                            <AgentAvatar size="sm" variant="indigo" />
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
                                <Sparkles className="w-3 h-3 text-indigo-500" /> Slots:
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
                                        ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                }`}
                            >
                                {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                {isSaved ? 'Deployed' : 'Save Template'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom-Right: Active Slot-Filling Modules (Compact Density) */}
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100/80">
                        <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/60">
                                <Tag className="w-3.5 h-3.5" />
                            </span>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider leading-none">
                                    Active Slot-Filling Models
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">Deepgram NER &amp; Agora ANS Sync</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50/90 px-2 py-0.5 rounded-full border border-emerald-200/70 flex items-center gap-1 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 4 Models
                        </span>
                    </div>

                    <div className="space-y-2 flex-1">
                        {SLOT_MODELS.map((slot, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-white/75 backdrop-blur-md border border-white/90 shadow-[0_2px_6px_rgb(0,0,0,0.02)] space-y-1 transition-all hover:bg-white/95">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 text-[11px]">{slot.slot}</span>
                                        <span className="text-[10px] font-mono text-slate-400">• {slot.latency}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <span className="font-black text-emerald-600 text-xs">{slot.accuracy}%</span>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                    </div>
                                </div>

                                {/* Micro-Progress Tracker Bar */}
                                <div className="w-full bg-slate-100/90 h-1 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 rounded-full"
                                        style={{ width: `${slot.accuracy}%` }}
                                    />
                                </div>

                                <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                                    <span>{slot.model}</span>
                                    <span className="text-indigo-600 font-medium">{slot.engine}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100/80 text-[10px] font-mono text-indigo-700 flex items-center justify-between">
                        <span>Agora RTC Sync:</span>
                        <strong className="font-bold text-indigo-900">Synchronized (0.0ms Jitter)</strong>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AgentsView;
