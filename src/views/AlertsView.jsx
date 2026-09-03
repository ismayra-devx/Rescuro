import React from 'react';
import { Siren, Send, CheckCircle2, Clock, MapPin, Zap, AlertTriangle, HeartPulse, Flame, Car } from 'lucide-react';
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

    return (
        <div className="space-y-4">
            {/* Top Critical Alert Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md animate-pulse">
                        <Siren className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Priority 1 Emergency Intervention Queue
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white">
                                {alerts.length} Pending
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400">Real-time notification log tracking high-risk flags and supervisor intervention requests</p>
                    </div>
                </div>
                <button
                    onClick={() => onToast && onToast("Broadcasting Emergency Alert to NCR First Responders", "siren")}
                    className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
                >
                    <Siren className="w-3.5 h-3.5" /> Broadcast All Units
                </button>
            </div>

            {/* Notification Log List */}
            <div className="space-y-3">
                {alerts.map(alert => {
                    const Icon = getIncidentIcon(alert.title);
                    return (
                        <div key={alert.id} className="bg-white/70 backdrop-blur-xl border border-rose-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-extrabold text-xs text-indigo-600">{alert.id}</span>
                                        <h4 className="text-xs font-bold text-slate-900">{alert.title}</h4>
                                        <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-rose-50 text-rose-600 border border-rose-200">{alert.priority}</span>
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
                                    onClick={() => { takeOverCall('C-1021'); onToast && onToast(`Supervisor intervened for ${alert.id}`, 'zap'); }}
                                    className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs flex items-center gap-1 transition-all"
                                >
                                    <Zap className="w-3.5 h-3.5" /> Intervene
                                </button>
                                <button
                                    onClick={() => onToast && onToast(`Authorized Emergency Units for ${alert.id} → ${alert.nearestUnit}`, 'siren')}
                                    className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 transition-all"
                                >
                                    <Send className="w-3.5 h-3.5" /> Dispatch
                                </button>
                                <button
                                    onClick={() => { resolveAlert(alert.id); onToast && onToast(`Alert ${alert.id} resolved & archived`, 'check'); }}
                                    className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
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
