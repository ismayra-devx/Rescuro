import React, { useState } from 'react';
import { Bot, FileCode, Tag } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

const SLOT_MODELS = [
    { slot: 'Geo-Location Extraction', model: 'Deepgram NER + GeoCoder v4', accuracy: '99.4%', latency: '12ms' },
    { slot: 'Trauma & Injury Severity', model: 'BioClinical-GPT SlotFiller', accuracy: '98.8%', latency: '24ms' },
    { slot: 'Hazard Classification', model: 'LPG/Fire Incident Classifier', accuracy: '99.1%', latency: '18ms' },
    { slot: 'Acoustic Distress & Sentiment', model: 'Agora ANS Wav2Vec Cadence', accuracy: '97.9%', latency: '9ms' }
];

const AGENT_PROMPT_TEMPLATES = {
    'agent-nova': 'You are Agent Nova, lead triage dispatcher for Delhi NCR EMS. Speak with calm clinical authority in Hinglish/English. Immediately extract Location, Injuries, and Shock level. Flag trauma to SUP-004.',
    'agent-rhea': 'Aap Agent Rhea hain, Uttar Pradesh aur NCR kshetra ke primary Hindi dispatch agent. Shuddh Hindi aur regional boli mein spashtata se baat karein. Sabse pehle sthan aur aapatkaal ki sthiti verify karein. Vitals par nazar rakhein.',
    'agent-aegis': 'You are Agent Aegis, specializing in hazardous materials, structural fires, and gas leaks. Calculate hazard perimeter and wind direction immediately. Instruct evacuation upwind and notify HazMat Squad FT-07.',
    'agent-echo': 'You are Agent Echo, certified BLS instructor. Guide caller through continuous 100-120 BPM chest compressions and airway management until ALS Ambulance Amb-02 arrives. Keep caller grounded and calm.'
};

export const AgentsView = ({ onToast }) => {
    const { agents, toggleAgentMode } = useLiveStream();
    const [selectedAgent, setSelectedAgent] = useState(agents[0] || null);
    const [prompts, setPrompts] = useState(AGENT_PROMPT_TEMPLATES);

    const currentPrompt = prompts[selectedAgent?.id] || AGENT_PROMPT_TEMPLATES[selectedAgent?.id] || '';

    const handlePromptChange = (val) => {
        if (!selectedAgent?.id) return;
        setPrompts(prev => ({ ...prev, [selectedAgent.id]: val }));
    };

    return (
        <div className="space-y-5">
            {/* Top Agent Cluster Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map(agent => (
                    <div
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent)}
                        className={`bg-white/70 backdrop-blur-xl border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                            selectedAgent?.id === agent.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-white/90'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center text-white shadow-xs`}>
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">{agent.name}</h4>
                                    <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAgentMode(agent.id);
                                    if (onToast) onToast(`${agent.name} mode updated`, 'bot');
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                    agent.mode === 'Autonomous' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                            >
                                {agent.mode}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 truncate">{agent.role}</p>
                        <div className="flex justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
                            <span>Lat: <strong className="text-indigo-600">{agent.latency}</strong></span>
                            <span>Acc: <strong className="text-emerald-600">{agent.accuracy}</strong></span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Selected Agent: Prompt Template & Active Slot-Filling Models */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Prompt Template Configuration */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-mono">
                            <FileCode className="w-4 h-4 text-indigo-600" />
                            System Triage Prompt ({selectedAgent?.name || 'Agent Nova'})
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">Zero-Shot Guardrails Active</span>
                    </div>
                    <textarea
                        value={currentPrompt}
                        onChange={(e) => handlePromptChange(e.target.value)}
                        rows={5}
                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400 leading-relaxed resize-none"
                    />
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400 font-mono">Variables: {"{location}"}, {"{injury_type}"}, {"{distress_level}"}</span>
                        <button
                            onClick={() => onToast && onToast(`Updated Prompt Template for ${selectedAgent?.name}!`, 'check')}
                            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                            Save Template
                        </button>
                    </div>
                </div>

                {/* Active Slot-Filling Models */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-mono">
                            <Tag className="w-4 h-4 text-emerald-600" />
                            Active Slot-Filling Models
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">4 Models Active</span>
                    </div>

                    <div className="space-y-2 text-xs divide-y divide-slate-100">
                        {SLOT_MODELS.map((slot, idx) => (
                            <div key={idx} className="flex items-center justify-between pt-2">
                                <div>
                                    <p className="font-semibold text-slate-800">{slot.slot}</p>
                                    <p className="text-[10px] font-mono text-slate-400">{slot.model}</p>
                                </div>
                                <div className="text-right font-mono">
                                    <span className="font-bold text-emerald-600 block">{slot.accuracy}</span>
                                    <span className="text-[10px] text-slate-400">{slot.latency}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentsView;
