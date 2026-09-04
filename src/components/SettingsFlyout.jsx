import React, { useEffect, useRef, useState } from 'react';
import { 
    X, 
    Shield, 
    Radio, 
    MapPin, 
    Volume2, 
    LogOut, 
    Check, 
    Languages, 
    Cpu, 
    Sliders,
    Server,
    Wifi
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsFlyout = ({ isOpen, onClose, triggerRef, onToast }) => {
    const { user, logout } = useAuth();
    const flyoutRef = useRef(null);

    // Operational Preferences State
    const [codecMode, setCodecMode] = useState('opus'); // 'opus' | 'pcm'
    const [regionalNode, setRegionalNode] = useState('noida-18'); // 'noida-18' | 'gurugram-02' | 'delhi-01'
    const [hinglishFilter, setHinglishFilter] = useState(true);
    const [autoFailover, setAutoFailover] = useState(true);

    // Outside click dismissal
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (
                flyoutRef.current && 
                !flyoutRef.current.contains(e.target) &&
                triggerRef?.current &&
                !triggerRef.current.contains(e.target)
            ) {
                onClose();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, triggerRef]);

    const handleLogout = () => {
        if (onToast) onToast('Supervisor session SUP-004 terminated securely.', 'shield');
        logout();
        onClose();
    };

    const handlePreferenceToggle = (settingName, value) => {
        if (onToast) onToast(`${settingName} updated to ${value}`, 'check');
    };

    return (
        <div
            ref={flyoutRef}
            role="dialog"
            aria-label="Supervisor Operational Settings"
            className={`fixed left-[16.5rem] bottom-3.5 w-96 max-w-[calc(100vw-18rem)] z-50 transition-all duration-200 cubic-bezier(0.16, 1, 0.3, 1) origin-bottom-left ${
                isOpen 
                    ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                    : 'opacity-0 scale-95 -translate-x-3 pointer-events-none'
            }`}
        >
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22),0_4px_16px_rgba(15,23,42,0.08)] space-y-4 ring-1 ring-slate-900/5">
                
                {/* 1. Supervisor Profile Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-white">
                                {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'IP'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">
                                    {user?.name || 'Ismayra Parveen'}
                                </h4>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {user?.supervisorId || 'SUP-004'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Emergency Operations Supervisor
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Close Settings"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. Operational Preferences */}
                <div className="space-y-3">
                    
                    {/* Audio Stream Pipeline Mode */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <Radio className="w-3.5 h-3.5 text-blue-600" /> Audio Stream Pipeline
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-medium">
                                {codecMode === 'opus' ? '12.4ms Latency' : 'Direct PCM 32k'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70">
                            <button
                                type="button"
                                onClick={() => { setCodecMode('opus'); handlePreferenceToggle('Codec', 'Opus 24kHz HD'); }}
                                className={`py-1 px-2 rounded-lg text-[11px] font-mono font-bold transition-all ${
                                    codecMode === 'opus'
                                        ? 'bg-white text-indigo-600 shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Opus 24kHz HD
                            </button>
                            <button
                                type="button"
                                onClick={() => { setCodecMode('pcm'); handlePreferenceToggle('Codec', 'Raw PCM Diagnostic'); }}
                                className={`py-1 px-2 rounded-lg text-[11px] font-mono font-bold transition-all ${
                                    codecMode === 'pcm'
                                        ? 'bg-white text-indigo-600 shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Raw PCM 32k
                            </button>
                        </div>
                    </div>

                    {/* Regional Sector Exchange Node */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" /> Regional Sector Node
                            </span>
                            <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                CARRIER GRADE
                            </span>
                        </div>
                        <div className="space-y-1">
                            {[
                                { id: 'noida-18', label: 'Sector-18 Noida', node: 'NCR-DEL-NODE-09', ping: '11.8ms' },
                                { id: 'gurugram-02', label: 'Cyber City Gurugram', node: 'NCR-GGM-NODE-02', ping: '14.2ms' },
                            ].map(node => (
                                <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => { setRegionalNode(node.id); handlePreferenceToggle('Regional Exchange', node.label); }}
                                    className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                                        regionalNode === node.id
                                            ? 'bg-blue-50/70 border-blue-200/90 text-slate-900 shadow-2xs'
                                            : 'bg-white/60 border-slate-200/60 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${regionalNode === node.id ? 'bg-blue-600' : 'bg-slate-300'}`} />
                                        <div>
                                            <p className="text-[11px] font-bold leading-tight">{node.label}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{node.node}</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold text-slate-500">{node.ping}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Toggles */}
                    <div className="space-y-2 pt-1 border-t border-slate-100/90">
                        {/* Hinglish / Multi-Dialect Neural Filter */}
                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50/80 cursor-pointer transition-colors">
                            <div className="flex items-center gap-2">
                                <Languages className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-[11px] font-semibold text-slate-700">Hinglish Code-Switching Filter</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={hinglishFilter}
                                onChange={(e) => { setHinglishFilter(e.target.checked); handlePreferenceToggle('Hinglish Filter', e.target.checked ? 'Enabled' : 'Bypassed'); }}
                                className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer rounded"
                            />
                        </label>

                        {/* Automatic SIP Failover */}
                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50/80 cursor-pointer transition-colors">
                            <div className="flex items-center gap-2">
                                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-[11px] font-semibold text-slate-700">Auto SIP Trunk Failover</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={autoFailover}
                                onChange={(e) => { setAutoFailover(e.target.checked); handlePreferenceToggle('Trunk Failover', e.target.checked ? 'Armed' : 'Disarmed'); }}
                                className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer rounded"
                            />
                        </label>
                    </div>
                </div>

                {/* 3. Secure Log Out Action */}
                <div className="pt-2 border-t border-slate-100/90">
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 font-mono font-bold text-xs border border-rose-200/90 transition-all flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
                    >
                        <LogOut className="w-3.5 h-3.5 text-rose-600 transition-transform group-hover:-translate-x-0.5" />
                        <span>Sign Out Session (SUP-004)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsFlyout;
