import React from 'react';
import { 
    BarChart3, 
    Clock, 
    Volume2, 
    ShieldCheck, 
    Languages, 
    Activity, 
    Info, 
    CheckCircle2, 
    Users 
} from 'lucide-react';

export const AnalyticsView = ({ onToast }) => {
    // 24h Hourly Traffic simulation
    const hourlyData = [
        { hour: '00:00', calls: 32, p1: 4 },
        { hour: '02:00', calls: 18, p1: 2 },
        { hour: '04:00', calls: 12, p1: 1 },
        { hour: '06:00', calls: 45, p1: 6 },
        { hour: '08:00', calls: 110, p1: 14 },
        { hour: '10:00', calls: 145, p1: 22 },
        { hour: '12:00', calls: 160, p1: 19 },
        { hour: '14:00', calls: 135, p1: 15 },
        { hour: '16:00', calls: 175, p1: 26 },
        { hour: '18:00', calls: 190, p1: 31 },
        { hour: '20:00', calls: 155, p1: 18 },
        { hour: '22:00', calls: 88, p1: 9 }
    ];

    const maxCalls = Math.max(...hourlyData.map(d => d.calls));

    return (
        <div className="space-y-5">
            {/* 1. Executive TL;DR Operational Banner */}
            <div className="bg-white/80 backdrop-blur-xl border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ring-1 ring-indigo-500/10">
                <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0 mt-0.5">
                        <Activity className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                Executive Operational Summary
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">Past 24 Hours • Delhi NCR Command Sector</span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-1 leading-relaxed max-w-3xl">
                            Autonomous AI triage resolved <strong className="text-indigo-600 font-bold">68.4%</strong> of emergency calls without human escalation, conserving <strong className="text-slate-900 font-bold">42.8 dispatcher hours</strong> and clearing the response queue <strong className="text-blue-600 font-bold">38 seconds faster</strong> than manual dispatch.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs flex-shrink-0 self-end md:self-auto">
                    <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl text-center min-w-[115px]">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Staff Hours Saved</span>
                        <strong className="text-slate-900 font-extrabold text-sm">42.8 hrs</strong>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200/80 px-3.5 py-2 rounded-xl text-center min-w-[115px]">
                        <span className="text-[9px] text-indigo-500 font-bold uppercase block">System Load Status</span>
                        <strong className="text-indigo-700 font-extrabold text-sm">Optimal (68%)</strong>
                    </div>
                </div>
            </div>

            {/* 2. Simplified Public Safety Outcome KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Ingestion */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Total Emergency Ingestion
                        </span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Activity className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">1,510</div>
                    <p className="text-xs font-semibold text-blue-600 mt-2 flex items-center gap-1">
                        ↑ 12.4% <span className="text-slate-400 font-normal">vs previous 24h</span>
                    </p>
                </div>

                {/* Autonomous Triage Success */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Autonomous Triage Success
                        </span>
                        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                            <ShieldCheck className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-blue-600 mt-2">68.4%</div>
                    <p className="text-xs font-semibold text-slate-500 mt-2">
                        1,032 calls autonomously completed
                    </p>
                </div>

                {/* First Response Triage Time */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            First Response Triage Time
                        </span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Clock className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">1m 42s</div>
                    <p className="text-xs font-semibold text-blue-600 mt-2 flex items-center gap-1">
                        ↓ 38s faster <span className="text-slate-400 font-normal">than manual queue</span>
                    </p>
                </div>

                {/* Speech Clarity & Noise Filter */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Speech Clarity &amp; Noise Filter
                        </span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Volume2 className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-indigo-600 mt-2">-24.5 dB</div>
                    <p className="text-xs font-semibold text-slate-500 mt-2">
                        Agora AI Acoustic Suppression
                    </p>
                </div>
            </div>

            {/* 3. Main Operational Forecasting Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 24h Hourly Volume Chart with Surge Forecasting Note (2 Cols) */}
                <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-150 gap-2">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                24-Hour Call Ingestion &amp; Incident Load
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time incoming SIP traffic across Delhi NCR regional nodes</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Total Calls
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
                                <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Priority 1 Critical
                            </span>
                        </div>
                    </div>

                    {/* Actionable Forecasting Surge Note */}
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-900">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-[11px] leading-relaxed">
                            <strong>Peak Surge Window:</strong> Critical incidents surge between <strong>16:00 – 19:00</strong> (Evening Traffic Rush). <strong>Staffing Advisory:</strong> Maintain at least 10 active supervisors on desk during this window.
                        </p>
                    </div>

                    {/* Bar Chart Visualizer */}
                    <div className="h-56 flex items-end justify-between gap-2 pt-4 pb-2 px-1">
                        {hourlyData.map((d, idx) => {
                            const totalHeight = Math.round((d.calls / maxCalls) * 100);
                            const p1Height = Math.round((d.p1 / maxCalls) * 100);

                            return (
                                <div 
                                    key={idx} 
                                    className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                                    onClick={() => onToast && onToast(`Interval ${d.hour}: ${d.calls} calls (${d.p1} P1 Critical)`, 'chart')}
                                >
                                    {/* Tooltip Hover */}
                                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                        {d.calls} calls • {d.p1} P1
                                    </div>

                                    <div className="w-full bg-slate-100/90 rounded-t-lg flex flex-col justify-end overflow-hidden h-44">
                                        <div 
                                            className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 group-hover:from-indigo-600 group-hover:to-indigo-500 transition-all rounded-t-sm"
                                            style={{ height: `${totalHeight}%` }}
                                        >
                                            <div 
                                                className="w-full bg-rose-500 opacity-90"
                                                style={{ height: `${p1Height}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 mt-1">{d.hour}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Spoken Language Mix & Dialect Insights (1 Col) */}
                <div className="space-y-4">
                    <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                <Languages className="w-4 h-4 text-indigo-600" />
                                Spoken Language Mix
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">Deepgram Nova-2</span>
                        </div>

                        {/* Actionable Regional Dialect Note */}
                        <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold text-indigo-600 block">Regional Dialect Routing</span>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                <strong>Mixed Hinglish</strong> accounts for <strong>62%</strong> of calls. Bilingual routing handles 86% of regional dialects without human supervisor translation needed.
                            </p>
                        </div>

                        <div className="space-y-3.5 text-xs pt-1">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700">Mixed Hinglish (Code-Switch)</span>
                                    <span className="font-mono font-bold text-indigo-600">62% (936 calls)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: '62%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700">Pure Hindi</span>
                                    <span className="font-mono font-bold text-blue-600">24% (362 calls)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500 rounded-full" style={{ width: '24%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700">Indian English</span>
                                    <span className="font-mono font-bold text-amber-600">14% (212 calls)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '14%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
