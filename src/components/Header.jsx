import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const Header = () => {
    const { alerts, activeCalls } = useLiveStream();
    const p1Count = alerts?.filter(a => a.priority?.includes('P1'))?.length || alerts?.length || 3;

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
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 lg:px-8 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Executive Command Title & Lighter Subtitle */}
                <div>
                    <h1 className="text-xl font-[800] text-slate-900 tracking-[-0.025em] font-sans">
                        RESCURO Emergency Command Center
                    </h1>
                    <p className="text-xs text-slate-500 font-normal mt-0.5 tracking-normal font-sans">
                        Regional voice triage telemetry and multi-agency emergency dispatch operations
                    </p>
                </div>

                {/* Center / Right Controls: Compact Premium Telemetry Modules */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* CAD System Trunk Status */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 animate-pulse"></span>
                        <span className="text-[10.5px] font-sans font-semibold text-slate-500 uppercase tracking-wider">VOICE TRUNK:</span>
                        <span className="text-xs font-mono font-bold text-blue-700">99.98% ONLINE</span>
                    </div>

                    {/* Dual Mission Clock */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="text-xs font-mono font-bold tabular-nums text-slate-800">{timeString || '20:30:00'}</span>
                        <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase">IST</span>
                    </div>

                    {/* Active Incident Alert Counter: Red Reserved Exclusively for P1 */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200/90 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        <span className="text-xs font-mono font-bold text-rose-700">
                            {p1Count} P1 Incidents
                        </span>
                    </div>

                    {/* Dispatcher Staffing Module */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs">
                        <div className="w-5 h-5 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Users className="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-mono font-bold text-slate-900">
                                08<span className="text-slate-400 font-normal">/12</span>
                            </span>
                            <span className="text-[10px] uppercase text-slate-500 font-medium font-sans">
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
