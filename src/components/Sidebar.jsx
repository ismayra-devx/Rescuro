import React from 'react';
import { useAuth, ROLES } from '../context/AuthContext';

export const Sidebar = ({ onToast }) => {
    const { user, currentRole, switchRole } = useAuth();

    // Initials helper
    const getInitials = (name) => {
        if (!name) return 'OP';
        const parts = name.split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <aside className="fixed top-0 left-0 w-64 h-screen bg-white/95 backdrop-blur-xl border-r border-slate-200/80 flex flex-col z-40">
            {/* Brand Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-500/25">
                        R
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-sm font-extrabold tracking-wider text-slate-900 leading-none">RESCURO</h1>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">v4.2</span>
                        </div>
                        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mt-1">AI Voice Command</p>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-smooth-scroll">
                {/* Main Menu */}
                <div className="space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Main Menu
                    </div>
                    
                    {/* Dashboard */}
                    <a href="#" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-100/90 shadow-2xs">
                        <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                            <rect x="14" y="3" width="7" height="4" rx="1.5"/>
                            <rect x="14" y="11" width="7" height="10" rx="1.5"/>
                            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                        </svg>
                        <span>Dashboard</span>
                    </a>

                    {/* Agents */}
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onToast("Active AI Agents (4 Online)", "info"); }} 
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                    >
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2"/>
                            <circle cx="12" cy="5" r="2"/>
                            <path d="M12 7v4"/>
                            <line x1="8" y1="16" x2="8.01" y2="16"/>
                            <line x1="16" y1="16" x2="16.01" y2="16"/>
                        </svg>
                        <span>Agents</span>
                        <span className="ml-auto text-[11px] font-mono font-semibold px-2 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">4</span>
                    </a>

                    {/* Analytics */}
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onToast("Real-time Analytics View", "info"); }} 
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                    >
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18"/>
                            <path d="m19 9-5 5-4-4-3 3"/>
                        </svg>
                        <span>Analytics</span>
                    </a>
                </div>

                {/* Operations */}
                <div className="space-y-1 pt-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Operations
                    </div>

                    {/* Active Calls */}
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onToast("Filtering 12 Active Calls", "info"); }} 
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                    >
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span>Active Calls</span>
                        <span className="ml-auto text-[11px] font-mono font-semibold px-2 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">12</span>
                    </a>

                    {/* Call History */}
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onToast("Viewing Call History Logs", "info"); }} 
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                    >
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>Call History</span>
                    </a>

                    {/* Alerts */}
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onToast("3 Active High Priority Alerts", "alert"); }} 
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                    >
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-rose-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                        </svg>
                        <span>Alerts</span>
                        <span className="ml-auto text-[11px] font-mono font-semibold px-2 py-0.2 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60">3</span>
                    </a>
                </div>

                {/* Regional Dispatch Node Intel */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        <span>Regional Exchange</span>
                        <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ACTIVE
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-600 font-medium">Node:</span>
                        <span className="font-mono font-semibold text-slate-900">Sector-18 UP</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-600 font-medium">Voice Codec:</span>
                        <span className="font-mono text-slate-700">Opus 24kHz</span>
                    </div>
                </div>

                {/* Role Access Selector */}
                <div className="space-y-1.5">
                    <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            Security Level
                        </span>
                        <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded">RBAC</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.values(ROLES).map(role => (
                            <button
                                key={role}
                                onClick={() => {
                                    switchRole(role);
                                    onToast(`RBAC Level: ${role}`, "shield");
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
                                    currentRole === role
                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Supervisor Profile Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 mt-auto">
                <div className="flex items-center gap-3 p-1 rounded-xl">
                    {/* Modern Avatar with Initials & Clean Status Ring */}
                    <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white">
                            {getInitials(user.name)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>

                    {/* Officer Credentials */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                            {user.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono font-semibold text-indigo-600">
                                {user.supervisorId || currentRole}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400 font-medium">On Duty</span>
                        </div>
                    </div>

                    {/* Quick Settings Icon */}
                    <button 
                        onClick={() => onToast(`Verified Officer: ${user.name} (${user.supervisorId || currentRole})`, "settings")}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all flex-shrink-0"
                        title="Officer Settings & Audit"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
