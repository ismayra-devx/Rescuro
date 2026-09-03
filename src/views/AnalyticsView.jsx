import React from 'react';
import { 
    BarChart3, 
    TrendingUp, 
    Clock, 
    Zap, 
    ShieldCheck, 
    Languages, 
    AlertTriangle,
    ArrowUpRight,
    PieChart,
    Sparkles,
    Activity
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
        <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Total Audio Ingestion</span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <Activity className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">1,510</div>
                    <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1">
                        ↑ 12.4% <span className="text-slate-400 font-normal">vs previous 24h</span>
                    </p>
                </div>

                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">AI Resolution Rate</span>
                        <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <ShieldCheck className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-emerald-600 mt-2">68.4%</div>
                    <p className="text-xs font-semibold text-slate-500 mt-2">
                        1,032 calls autonomously triaged
                    </p>
                </div>

                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Avg Triage Speed</span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <Clock className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">1m 42s</div>
                    <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1">
                        ↓ 38s faster <span className="text-slate-400 font-normal">than human queue</span>
                    </p>
                </div>

                <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-5 shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Audio Noise Reduction</span>
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <Zap className="w-4 h-4" />
                        </span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono text-indigo-600 mt-2">-24.5 dB</div>
                    <p className="text-xs font-semibold text-slate-500 mt-2">
                        Agora AI Acoustic Suppression
                    </p>
                </div>
            </div>

            {/* Main Hourly Chart & Incident Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 24h Hourly Volume Chart (2 Cols) */}
                <div className="lg:col-span-2 bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-6 shadow-[0_12px_40px_rgb(0,0,0,0.06)] flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                24-Hour Call Ingestion &amp; Incident Load
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time incoming SIP traffic across Delhi NCR regional nodes</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="flex items-center gap-1 text-indigo-600">
                                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Total Calls
                            </span>
                            <span className="flex items-center gap-1 text-rose-600 ml-2">
                                <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Priority 1 Critical
                            </span>
                        </div>
                    </div>

                    {/* Bar Chart Bars */}
                    <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-3 px-2">
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

                                    <div className="w-full bg-slate-100/80 rounded-t-lg flex flex-col justify-end overflow-hidden h-48">
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

                {/* Language & Resolution Breakdown (1 Col) */}
                <div className="space-y-6">
                    {/* Language Mix */}
                    <div className="bg-white/65 backdrop-blur-2xl border border-white/90 rounded-2xl p-6 shadow-[0_12px_40px_rgb(0,0,0,0.06)] space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                <Languages className="w-4 h-4 text-indigo-600" />
                                Spoken Language Mix
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">Deepgram Nova-2</span>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700">Mixed Hinglish</span>
                                    <span className="font-mono font-bold text-indigo-600">62% (936 calls)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: '62%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700">Pure Hindi</span>
                                    <span className="font-mono font-bold text-emerald-600">24% (362 calls)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '24%' }}></div>
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
