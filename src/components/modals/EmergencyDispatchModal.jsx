import React, { useState } from 'react';
import { 
    AlertTriangle, 
    Siren, 
    MapPin, 
    Send, 
    Zap, 
    Compass, 
    ShieldAlert, 
    CheckCircle2, 
    Activity, 
    HeartPulse,
    Clock,
    Car,
    PhoneCall
} from 'lucide-react';
import { useLiveStream } from '../../context/LiveStreamContext';

export const EmergencyDispatchModal = ({ onToast }) => {
    const { takeOverCall } = useLiveStream();
    const [dispatchedUnits, setDispatchedUnits] = useState({
        ambulance: false,
        police: false,
        fire: false
    });
    const [isIntervened, setIsIntervened] = useState(false);

    const handleTakeOver = () => {
        setIsIntervened(true);
        takeOverCall('C-1021');
        if (onToast) onToast('Supervisor SUP-004 intervened and took over voice channel for C-1021', 'zap');
    };

    const handleDispatchUnit = (unitType, unitName) => {
        setDispatchedUnits(prev => ({ ...prev, [unitType]: true }));
        if (onToast) onToast(`Authorized Immediate Field Dispatch for ${unitName}!`, 'siren');
    };

    const handleDispatchAll = () => {
        setDispatchedUnits({ ambulance: true, police: true, fire: true });
        if (onToast) onToast('Multi-Agency Critical Dispatch Triggered: Ambulance, Police & Fire Squad Mobilized!', 'siren');
    };

    return (
        <div className="space-y-6">
            {/* Critical Alert Header Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white shadow-lg shadow-rose-600/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white flex-shrink-0 animate-pulse">
                        <Siren className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                                Incident C-1021
                            </span>
                            <span className="text-xs font-mono font-bold bg-white text-rose-700 px-2 py-0.5 rounded">
                                Priority-1 Critical
                            </span>
                        </div>
                        <h3 className="text-base font-extrabold mt-1">
                            High-Risk Collision with Severe Trauma Detected
                        </h3>
                        <p className="text-xs text-rose-100">
                            AI Confidence 92% • Immediate Supervisor Intervention &amp; Unit Dispatch Recommended
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        onClick={handleDispatchAll}
                        className="py-2 px-4 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                        <Send className="w-3.5 h-3.5" />
                        Dispatch Units
                    </button>
                </div>
            </div>

            {/* Grid: 92% Risk Breakdown + GPS Location */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Card 1: 92% Critical Risk Breakdown */}
                <div className="bg-white border border-rose-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                                92% Critical Risk Telemetry Breakdown
                            </h4>
                        </div>
                        <span className="text-sm font-extrabold font-mono text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            92% CONFIDENCE
                        </span>
                    </div>

                    <div className="space-y-3 text-xs">
                        {/* Factor 1 */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Acoustic Vocal Stress &amp; Cadence</span>
                                <span className="font-mono font-bold text-rose-600">94% (Severe Shock)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-rose-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                            </div>
                        </div>

                        {/* Factor 2 */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Trauma Entity Slot Detection</span>
                                <span className="font-mono font-bold text-rose-600">89% (Hemorrhage / Blunt Trauma)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-rose-500 h-2 rounded-full" style={{ width: '89%' }}></div>
                            </div>
                        </div>

                        {/* Factor 3 */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Real-Time Sentiment Polarity</span>
                                <span className="font-mono font-bold text-rose-600">-0.82 (Extreme Distress)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '82%' }}></div>
                            </div>
                        </div>

                        {/* Factor 4 */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold text-slate-700">Golden Hour Urgency Window</span>
                                <span className="font-mono font-bold text-rose-600">&lt; 8 Mins Required</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-rose-600 h-2 rounded-full" style={{ width: '96%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Precise GPS Coordinates & Node Intel */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-600" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                                Precise GPS Coordinates &amp; Cell Triangulation
                            </h4>
                        </div>
                        <span className="text-xs font-mono text-slate-400">Sector 18 UP</span>
                    </div>

                    <div className="h-28 bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner">
                        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#6366F1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        <div className="relative flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-rose-500/20 animate-ping absolute"></div>
                            <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[9px] font-bold">
                                C1
                            </div>
                        </div>
                        <span className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-400">
                            Triangulated via Carrier Tower A-09
                        </span>
                    </div>

                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500 font-medium">Exact Location:</span>
                            <span className="font-bold text-slate-900">Sector 18 Metro Pillar 42, Noida</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500 font-medium">GPS Coordinates:</span>
                            <span className="font-mono font-bold text-indigo-600">28.5708° N, 77.3271° E</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-slate-500 font-medium">District &amp; State:</span>
                            <span className="font-medium text-slate-800">Gautam Buddha Nagar, UP</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Nearest Available Emergency Units with Live ETA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-2">
                        <Car className="w-4 h-4 text-emerald-600" />
                        Nearest Available Response Units (Real-Time ETA)
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">Multi-Agency Telematics</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Unit 1: Ambulance */}
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/80 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Ambulance Amb-02</span>
                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                4m ETA
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Trauma ALS • Kailash Hospital Station</p>
                        <button
                            onClick={() => handleDispatchUnit('ambulance', 'Ambulance Amb-02')}
                            disabled={dispatchedUnits.ambulance}
                            className={`w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                dispatchedUnits.ambulance 
                                    ? 'bg-slate-700 text-white cursor-default' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                        >
                            {dispatchedUnits.ambulance ? '✓ Dispatched' : 'Dispatch Ambulance'}
                        </button>
                    </div>

                    {/* Unit 2: Police PCR */}
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/80 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">PCR-14 Sector 18</span>
                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                2m ETA
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Police Rapid Intervention • Atta Market</p>
                        <button
                            onClick={() => handleDispatchUnit('police', 'PCR-14 Patrol')}
                            disabled={dispatchedUnits.police}
                            className={`w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                dispatchedUnits.police 
                                    ? 'bg-slate-700 text-white cursor-default' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                        >
                            {dispatchedUnits.police ? '✓ Dispatched' : 'Dispatch Police'}
                        </button>
                    </div>

                    {/* Unit 3: Fire Tender */}
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/80 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Fire Squad FT-07</span>
                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                8m ETA
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Rescue Tender • Sector 2 Fire Station</p>
                        <button
                            onClick={() => handleDispatchUnit('fire', 'Fire Squad FT-07')}
                            disabled={dispatchedUnits.fire}
                            className={`w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                dispatchedUnits.fire 
                                    ? 'bg-slate-700 text-white cursor-default' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                        >
                            {dispatchedUnits.fire ? '✓ Dispatched' : 'Dispatch Fire'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Direct Action Triggers */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                    <h5 className="text-xs font-bold text-slate-900">Supervisor Escalation Protocol</h5>
                    <p className="text-xs text-slate-500">Override AI Voice Agent immediately or mobilize trauma response teams</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                        onClick={handleTakeOver}
                        className={`py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm ${
                            isIntervened 
                                ? 'bg-amber-600 text-white' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                    >
                        <Zap className="w-4 h-4" />
                        {isIntervened ? '✓ Intervened (SUP-004 Active)' : 'Intervene & Take Over Call'}
                    </button>

                    <button
                        onClick={handleDispatchAll}
                        className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <Send className="w-4 h-4" />
                        Dispatch Units
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmergencyDispatchModal;
