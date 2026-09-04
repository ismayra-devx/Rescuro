import React, { useState } from 'react';
import { Siren, Send, CheckCircle2, Clock, MapPin, AlertTriangle, HeartPulse, Flame, Car, Radio } from 'lucide-react';
import { useLiveStream } from '../context/LiveStreamContext';

const getIncidentIcon = (title = '') => {
    const l = title.toLowerCase();
    if (l.includes('traffic') || l.includes('collision')) return Car;
    if (l.includes('cardiac') || l.includes('heart')) return HeartPulse;
    if (l.includes('gas') || l.includes('fire')) return Flame;
    return AlertTriangle;
};

export const AlertsView = ({ onToast }) => {
    const { alerts, resolveAlert, takeOverCall } = useLiveStream();
    const [broadcastState, setBroadcastState] = useState('idle'); // 'idle' | 'transmitting' | 'sent'

    const handleBroadcast = () => {
        if (broadcastState !== 'idle') return;
        setBroadcastState('transmitting');
        if (onToast) onToast("Broadcasting Emergency Alert to NCR First Responders", "siren");

        setTimeout(() => {
            setBroadcastState('sent');
            setTimeout(() => {
                setBroadcastState('idle');
            }, 1400);
        }, 1200);
    };

    return (
        <div className="space-y-4">
            {/* Top Critical Alert Bar (No Subtitle Clutter) */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-200/90 shadow-[0_12px_40px_rgb(0,0,0,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md">
                        <Siren className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Priority 1 Emergency Intervention Queue
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-600 text-white">
                                {alerts.length} Pending
                            </span>
                        </h3>
                    </div>
                </div>

                {/* Emergency Broadcast Action Button */}
                <button
                    onClick={handleBroadcast}
                    disabled={broadcastState !== 'idle'}
                    className={`relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-xs tracking-wide transition-all duration-150 select-none shadow-sm cursor-pointer active:scale-[0.98] ${
                        broadcastState === 'idle'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/80 shadow-[0_2px_10px_rgba(225,29,72,0.3)] hover:shadow-[0_4px_16px_rgba(225,29,72,0.4)]'
                            : broadcastState === 'transmitting'
                            ? 'bg-rose-700 text-white border border-rose-600 shadow-[0_2px_10px_rgba(225,29,72,0.3)] animate-pulse cursor-wait'
                            : 'bg-emerald-600 text-white border border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.3)]'
                    }`}
                >
                    {broadcastState === 'idle' && (
                        <>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            <Radio className="w-4 h-4 text-white" />
                            <span className="font-semibold">Broadcast All Units</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-700/70 text-rose-100 border border-rose-400/30">
                                ALL-CALL
                            </span>
                        </>
                    )}

                    {broadcastState === 'transmitting' && (
                        <>
                            <Radio className="w-4 h-4 text-white animate-spin" />
                            <span className="font-semibold">Transmitting Broadcast...</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-rose-700">
                                LIVE
                            </span>
                        </>
                    )}

                    {broadcastState === 'sent' && (
                        <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span className="font-semibold">Broadcast Transmitted</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-700/70 text-emerald-100 border border-emerald-400/30">
                                CONFIRMED
                            </span>
                        </>
                    )}
                </button>
            </div>

            {/* Notification Log List */}
            <div className="space-y-3">
                {alerts.map(alert => {
                    const Icon = getIncidentIcon(alert.title);
                    return (
                        <div key={alert.id} className="bg-white/65 backdrop-blur-2xl border border-rose-200/90 rounded-2xl p-4 shadow-[0_12px_40px_rgb(0,0,0,0.06)] hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-extrabold text-xs text-indigo-600">{alert.id}</span>
                                        <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-rose-50 text-rose-600 border border-rose-200">{alert.priority}</span>
                                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{alert.timeElapsed}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">{alert.details}</p>
                                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 pt-1">
                                        <span className="flex items-center gap-1 text-slate-700"><MapPin className="w-3 h-3 text-indigo-500" />{alert.location}</span>
                                        <span>•</span>
                                        <span className="text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{alert.nearestUnit}</span>
                                        <span>•</span>
                                        <span className="text-slate-400 font-mono">{alert.supervisorAssigned}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
                                <button
                                    onClick={() => { takeOverCall('C-1021'); onToast && onToast(`Supervisor intervened for ${alert.id}`, 'phone'); }}
                                    className="tactile-btn py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-mono font-bold text-xs shadow-[0_2px_0_#b45309] border-t border-amber-300/60 flex items-center justify-center transition-all"
                                >
                                    Intervene
                                </button>
                                <button
                                    onClick={() => onToast && onToast(`Authorized Emergency Units for ${alert.id} → ${alert.nearestUnit}`, 'siren')}
                                    className="tactile-btn py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-mono font-bold text-xs shadow-[0_2px_0_#881337] border-t border-rose-400/60 flex items-center gap-1.5 transition-all"
                                >
                                    <Send className="w-3.5 h-3.5" /> Dispatch
                                </button>
                                <button
                                    onClick={() => { resolveAlert(alert.id); onToast && onToast(`Alert ${alert.id} resolved & archived`, 'check'); }}
                                    className="tactile-btn py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 active:scale-95 text-slate-700 font-mono font-bold text-xs border border-slate-300/80 shadow-[0_2px_0_#cbd5e1] transition-all flex items-center gap-1"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolve
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AlertsView;
