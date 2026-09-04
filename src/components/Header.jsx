import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock, Radio } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const Header = () => {
    const { alerts, activeCalls, openTakeoverModal } = useLiveStream();
    const p1Count = alerts?.filter(a => a.priority?.includes('P1'))?.length || alerts?.length || 3;
    const overriddenCall = activeCalls?.find(c => c.supervisorOverridden);

    // Live Operational Mission Clock
    const [timeString, setTimeString] = useState('');
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setTimeString(now.toLocaleTimeString('en-US', { hour12: false }));
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-2xl border-b border-white/80 px-6 lg:px-8 py-3.5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Executive Command Title */}
                <div>
                    <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        RESCURO Emergency Command Center
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Regional voice triage telemetry and multi-agency emergency dispatch operations
                    </p>
                </div>

                {/* Center / Right Controls: Enterprise Operations Status Strip */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                    {/* CAD System Trunk Status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs font-mono">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span className="font-bold text-slate-700 tracking-tight">VOICE TRUNK:</span>
                        <span className="text-blue-700 font-black">99.98% ONLINE</span>
                    </div>

                    {/* Dual Mission Clock: UTC + Local IST */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200/80 shadow-2xs text-xs font-mono text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-bold tabular-nums">{timeString || '20:30:00'}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">IST</span>
                    </div>

                    {/* Active Incident Alert Counter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50/90 border border-rose-200/90 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        <span className="text-xs font-mono font-bold text-rose-700">
                            {p1Count} P1 Incidents
                        </span>
                    </div>

                    {/* Supervisor Capacity Badge */}
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200/80 shadow-2xs">
                        <div className="w-5 h-5 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Users className="w-3 h-3" />
                        </div>
                        <div className="text-left font-mono">
                            <span className="text-xs font-bold text-slate-900 leading-tight">
                                08<span className="text-slate-400 font-normal">/12</span>
                            </span>
                            <span className="ml-1 text-[10px] uppercase text-slate-500 font-semibold">
                                Dispatchers
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
