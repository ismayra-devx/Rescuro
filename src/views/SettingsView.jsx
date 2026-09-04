import React, { useState } from 'react';
import { Settings, Save, Radio, Activity, Cpu, User, MapPin, Check, Server, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsView = ({ onToast }) => {
    const { user } = useAuth();
    const [vadThreshold, setVadThreshold] = useState(90);
    const [confidence, setConfidence] = useState(92);
    const [hinglish, setHinglish] = useState(true);
    const [failoverArmed, setFailoverArmed] = useState(true);

    const handleSave = (e) => {
        e.preventDefault();
        if (onToast) onToast('System & Regional Node Configurations Successfully Saved!', 'check');
    };

    return (
        <div className="space-y-5 max-w-5xl">
            {/* Header (No Subtitle Clutter) */}
            <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-4 shadow-[0_12px_40px_rgb(0,0,0,0.06)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 shadow-2xs"><Settings className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">System &amp; Regional Exchange Settings</h3>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="py-1.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
                >
                    <Save className="w-3.5 h-3.5" /> Save Configuration
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Regional Exchange Node Settings (Sector-18 UP) */}
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)] space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-mono">
                            <MapPin className="w-4 h-4 text-rose-500" /> Regional Exchange Node (Sector-18 UP)
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500">
                            Active • 11.8ms
                        </span>
                    </div>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Exchange Node ID</span>
                            <span className="font-mono font-bold text-indigo-600">NCR-DEL-NODE-09</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Regional Gateway</span>
                            <span className="font-semibold text-slate-800">Sector 18, Noida (Uttar Pradesh)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Primary SIP Trunk</span>
                            <span className="font-mono text-slate-700">Tata Tele Interconnect (Route A-09)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Round-Trip Latency</span>
                            <span className="font-mono font-bold text-blue-600">11.8 ms (Carrier Grade)</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <div>
                                <p className="font-semibold text-slate-800">Automatic Failover Trunk</p>
                                <p className="text-[11px] text-slate-400">Switches to Cloud SIP backup if packet loss &gt; 1%</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={failoverArmed}
                                onChange={(e) => setFailoverArmed(e.target.checked)}
                                className="w-4 h-4 accent-indigo-600 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. System Configurations & DSP Thresholds */}
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)] space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-mono">
                            <Radio className="w-4 h-4 text-indigo-600" /> Pipeline Audio &amp; STT Config
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Opus 24kHz
                        </span>
                    </div>

                    <div className="space-y-3 text-xs">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">VAD Speech Detection Sensitivity</span>
                                <span className="font-mono font-bold text-indigo-600">{vadThreshold}%</span>
                            </div>
                            <input 
                                type="range" min="70" max="99" value={vadThreshold}
                                onChange={(e) => setVadThreshold(Number(e.target.value))}
                                className="w-full accent-indigo-600 cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">AI Entity Extraction Confidence Floor</span>
                                <span className="font-mono font-bold text-indigo-600">{confidence}%</span>
                            </div>
                            <input 
                                type="range" min="80" max="98" value={confidence}
                                onChange={(e) => setConfidence(Number(e.target.value))}
                                className="w-full accent-indigo-600 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                                <p className="font-semibold text-slate-800">Bilingual Hinglish Code-Switching</p>
                                <p className="text-[11px] text-slate-400">Deepgram Nova-2 dual-phoneme parser</p>
                            </div>
                            <input 
                                type="checkbox" checked={hinglish}
                                onChange={(e) => setHinglish(e.target.checked)}
                                className="w-4 h-4 accent-indigo-600 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. User Profile Controls */}
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)] space-y-3.5 md:col-span-2">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-mono">
                            <User className="w-4 h-4 text-indigo-600" /> Active Supervisor Profile &amp; Audit Authority
                        </div>
                        <span className="text-xs font-mono font-bold text-blue-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Officer Authenticated
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Officer Name</span>
                            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{user?.name || 'Ismayra Parveen'}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Call Sign</span>
                            <span className="font-mono font-bold text-indigo-600 text-sm mt-0.5 block">SUP-004 (Lead Triage)</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Jurisdiction</span>
                            <span className="font-semibold text-slate-800 text-sm mt-0.5 block">National Capital Region EMS</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Override Clearance</span>
                            <span className="font-mono font-bold text-blue-600 text-sm mt-0.5 block">Level 3 Priority-1</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
