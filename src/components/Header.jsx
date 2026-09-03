import React from 'react';
import { Users, MapPin, AlertTriangle } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

export const Header = () => {
    const { alerts } = useLiveStream();
    const p1Count = alerts?.filter(a => a.priority?.includes('P1'))?.length || alerts?.length || 3;

    return (
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-white/80 px-6 lg:px-8 py-3.5 shadow-xs transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Operational Command Center Title & Regional Location Node */}
                <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        RESCURO AI Emergency Command Center
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                        <span className="flex items-center gap-1 text-slate-700 font-semibold font-mono">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            Operational Node: NCR-DEL-09 (Sector-18 Noida, UP)
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400">Carrier SIP Trunk Route A-09</span>
                    </div>
                </div>

                {/* Right: Operational Alert Counter & Supervisor Capacity */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                    {/* Alert Counter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                        <span className="text-xs font-mono font-bold text-rose-700">
                            {p1Count} Critical Alerts Active
                        </span>
                    </div>

                    {/* Supervisor Capacity */}
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                            <span className="block text-xs font-mono font-bold text-slate-900 leading-tight">
                                08<span className="text-slate-400 font-normal">/12</span>
                            </span>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Supervisors
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
