import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveStream } from '../context/LiveStreamContext';
import { 
    LayoutDashboard, 
    Bot, 
    BarChart3, 
    PhoneCall, 
    History, 
    AlertTriangle, 
    Settings
} from 'lucide-react';

export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
    { id: 'agents', label: 'Agents', icon: Bot, badgeColor: 'emerald', section: 'main' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'main' },
    { id: 'active-calls', label: 'Active Calls', icon: PhoneCall, badgeColor: 'indigo', section: 'ops' },
    { id: 'call-history', label: 'Call History', icon: History, section: 'ops' },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badgeColor: 'rose', section: 'ops' },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'ops' },
];

export const Sidebar = ({ activeTab = 'dashboard', onTabChange, onToast }) => {
    const { user } = useAuth();
    const { activeCalls, alerts, agents } = useLiveStream();

    const getDynamicBadge = (itemId) => {
        if (itemId === 'active-calls') return activeCalls?.length?.toString() ?? '0';
        if (itemId === 'alerts') return alerts?.length?.toString() ?? '0';
        if (itemId === 'agents') return agents?.filter(a => a.status === 'ONLINE')?.length?.toString() ?? '0';
        return null;
    };

    const getInitials = (name) => {
        if (!name) return 'IP';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const handleTabClick = (tabId) => {
        if (onTabChange) {
            onTabChange(tabId);
        }
    };

    return (
        <aside className="fixed top-0 left-0 w-64 h-screen bg-white/70 backdrop-blur-2xl border-r border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col z-40 transition-all">
            {/* Brand Header: Cleaned of static v4.2 clutter */}
            <div className="p-5 border-b border-slate-100/80 flex items-center justify-between bg-white/40">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-500/20">
                        R
                    </div>
                    <div>
                        <h1 className="text-sm font-extrabold tracking-wider text-slate-900 leading-none">
                            RESCURO
                        </h1>
                        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mt-1">
                            AI Voice Command
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation Menu with Dynamic View Switching */}
            <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-smooth-scroll">
                {/* Main Section */}
                <div className="space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Overview
                    </div>
                    {NAV_ITEMS.filter(item => item.section === 'main').map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleTabClick(item.id, item.label)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all text-left ${
                                    isActive 
                                        ? 'bg-indigo-50/90 text-indigo-700 font-semibold border border-indigo-200/70 shadow-2xs' 
                                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent font-medium hover:border-slate-100'
                                }`}
                            >
                                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="flex-1 truncate">{item.label}</span>
                                {getDynamicBadge(item.id) && (
                                    <span className={`ml-auto text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                                        item.badgeColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                                        item.badgeColor === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200/60' :
                                        'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                    }`}>
                                        {getDynamicBadge(item.id)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Operations Section */}
                <div className="space-y-1 pt-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Operations &amp; Config
                    </div>
                    {NAV_ITEMS.filter(item => item.section === 'ops').map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleTabClick(item.id, item.label)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all text-left ${
                                    isActive 
                                        ? 'bg-indigo-50/90 text-indigo-700 font-semibold border border-indigo-200/70 shadow-2xs' 
                                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent font-medium hover:border-slate-100'
                                }`}
                            >
                                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="flex-1 truncate">{item.label}</span>
                                {getDynamicBadge(item.id) && (
                                    <span className={`ml-auto text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                                        item.badgeColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                                        item.badgeColor === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200/60' :
                                        'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                    }`}>
                                        {getDynamicBadge(item.id)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar User Footer: Clean & Minimal with Ismayra Parveen */}
            <div className="p-3.5 border-t border-slate-100/80 bg-white/50 mt-auto">
                <div className="flex items-center gap-3 p-1 rounded-xl">
                    {/* User Avatar with Initials */}
                    <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white">
                            {getInitials(user?.name || 'Ismayra Parveen')}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>

                    {/* Officer Credentials */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                            {user?.name || 'Ismayra Parveen'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono font-semibold text-indigo-600">
                                SUP-004
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                On Duty
                            </span>
                        </div>
                    </div>

                    {/* Working Settings Gear Icon */}
                    <button 
                        onClick={() => handleTabClick('settings', 'Settings')}
                        className={`p-2 rounded-lg border transition-all flex-shrink-0 ${
                            activeTab === 'settings' 
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                                : 'text-slate-400 hover:text-slate-700 hover:bg-white border-transparent hover:border-slate-200'
                        }`}
                        title="Open Command Center Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
