import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../context/LiveStreamContext';
import { 
    LayoutDashboard, 
    Headphones, 
    BarChart3, 
    PhoneCall, 
    History, 
    AlertTriangle, 
    Settings,
    Radio
} from 'lucide-react';
import { SettingsFlyout } from './SettingsFlyout';

export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
    { id: 'agents', label: 'Agents', icon: Headphones, section: 'main' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'main' },
    { id: 'active-calls', label: 'Active Calls', icon: PhoneCall, section: 'ops' },
    { id: 'call-history', label: 'Call History', icon: History, section: 'ops' },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, section: 'ops' },
];

export const Sidebar = ({ activeTab = 'dashboard', onTabChange, onToast }) => {
    const { user } = useAuth();
    const { activeCalls, alerts, agents } = useLiveStream();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsTriggerRef = useRef(null);

    const getDynamicBadge = (itemId) => {
        if (itemId === 'active-calls') return activeCalls?.length?.toString() ?? '0';
        if (itemId === 'alerts') return alerts?.length?.toString() ?? '0';
        if (itemId === 'agents') return agents?.filter(a => a.status === 'ONLINE')?.length?.toString() ?? '0';
        return null;
    };

    const getInitials = (name) => {
        if (!name) return 'IP';
        const parts = name.trim().split(' ');
        return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
    };

    const renderNavGroup = (sectionKey, sectionTitle) => (
        <div className="space-y-1">
            <div className="px-3 py-1.5 font-bold text-[10px] tracking-widest uppercase text-slate-400">
                {sectionTitle}
            </div>
            {NAV_ITEMS.filter(item => item.section === sectionKey).map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const badge = getDynamicBadge(item.id);
                return (
                    <button
                        key={item.id}
                        onClick={() => onTabChange && onTabChange(item.id)}
                        className={`relative w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs transition-all text-left overflow-hidden ${
                            isActive 
                                ? 'bg-white/80 border border-slate-200/60 shadow-xs text-slate-900 font-semibold' 
                                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50 border border-transparent font-medium'
                        }`}
                    >
                        {isActive && <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-blue-600 rounded-r-full" />}
                        <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                            item.id === 'alerts' ? (
                                <span className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/70 shadow-2xs">
                                    {badge}
                                </span>
                            ) : (
                                <span className="ml-auto text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70">
                                    {badge}
                                </span>
                            )
                        )}
                    </button>
                );
            })}
        </div>
    );

    return (
        <aside className="fixed top-0 left-0 w-64 h-screen bg-white/75 backdrop-blur-2xl border-r border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col z-40 transition-all">
            {/* 1. Executive Brand Header: Sleek Wordmark & Rescue Icon */}
            <div className="px-5 py-4 border-b border-slate-100/80 flex items-center bg-white/40">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/25 flex-shrink-0">
                        <Radio className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-base tracking-tight text-slate-900 font-sans">RESCURO</span>
                </div>
            </div>

            {/* 2 & 3 & 4. Refined Navigation Menu */}
            <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-smooth-scroll">
                {renderNavGroup('main', 'Overview')}
                {renderNavGroup('ops', 'Operations')}
            </div>

            {/* 5. Streamlined User Footer: Sleek single-line layout with floating tactile gear icon */}
            <div className="p-3 border-t border-slate-100/80 bg-white/40 mt-auto">
                <div className="flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                                {getInitials(user?.name || 'Ismayra Parveen')}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-sky-400 border border-white rounded-full"></span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                                {user?.name || 'Ismayra Parveen'}
                            </p>
                            <span className="text-[10px] font-mono text-slate-400">SUP-004 • On Duty</span>
                        </div>
                    </div>
                    <button 
                        ref={settingsTriggerRef}
                        onClick={() => setIsSettingsOpen(prev => !prev)}
                        className={`p-1.5 rounded-lg border transition-all flex-shrink-0 cursor-pointer ${
                            isSettingsOpen 
                                ? 'bg-white text-blue-600 border-blue-300 shadow-xs ring-2 ring-blue-500/20' 
                                : 'text-slate-400 hover:text-slate-700 hover:bg-white/60 border-transparent'
                        }`}
                        title="Command Center Settings"
                    >
                        <Settings className={`w-4 h-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90 text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Contextual Settings Flyout Menu */}
            <SettingsFlyout
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                triggerRef={settingsTriggerRef}
                onToast={onToast}
            />
        </aside>
    );
};

export default Sidebar;
