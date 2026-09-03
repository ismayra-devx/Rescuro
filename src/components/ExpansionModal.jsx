import React, { useRef, useLayoutEffect, useCallback, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useLiveStream } from '../context/LiveStreamContext';
import { CALL_HISTORY_DATA } from '../data/mockData';
import { 
    X, 
    PhoneCall, 
    Radio, 
    Mic, 
    AlertTriangle, 
    History, 
    Shield, 
    MapPin, 
    Clock, 
    Zap, 
    Headphones, 
    Volume2, 
    Sliders, 
    Activity, 
    Send, 
    Truck, 
    Flame, 
    FileText, 
    Tag, 
    CheckCircle2 
} from 'lucide-react';

export const ExpansionModal = ({ activeCardKey, originRect, onClose, onToast }) => {
    const { activeCalls, alerts, takeOverCall, transcriptSegments } = useLiveStream();
    const overlayRef = useRef(null);
    const modalContentRef = useRef(null);

    // Audio Workbench Local State
    const [ansEnabled, setAnsEnabled] = useState(true);
    const [gainLevel, setGainLevel] = useState(82);

    // Emergency Dispatch Local State
    const [dispatchedUnits, setDispatchedUnits] = useState({ amb: false, pcr: false, fire: false });
    const [isOverridden, setIsOverridden] = useState(false);

    // Whisper Guidance Local State
    const [whisperText, setWhisperText] = useState('');

    const formatDuration = (sec = 0) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Card Header Metadata per unique card
    const getModalMeta = () => {
        switch (activeCardKey) {
            case 'active-calls':
                return {
                    title: 'Active Concurrent Calls Registry',
                    subtitle: 'Live SIP Channels • Carrier Interconnect Route A-09',
                    badge: `${activeCalls?.length || 6} ACTIVE CHANNELS`,
                    badgeColor: 'indigo',
                    icon: PhoneCall
                };
            case 'audio-stream':
                return {
                    title: 'Agora ANS Audio Workbench & Denoising',
                    subtitle: 'Real-time WebRTC 24kHz Stream • Neural Noise Suppression & Spectral Scrubber',
                    badge: '24kHz HD OPUS',
                    badgeColor: 'indigo',
                    icon: Radio
                };
            case 'transcription':
                return {
                    title: 'Live Audio Transcription & Diarization Console',
                    subtitle: 'Line C-1021 • Real-Time Speech-to-Text Verbatim Stream & Slot Extraction',
                    badge: 'DEEPGRAM NOVA-2',
                    badgeColor: 'indigo',
                    icon: Mic
                };
            case 'metadata':
                return {
                    title: 'AI Extracted Metadata & Entity Slot Inspector',
                    subtitle: 'Line C-1021 • Deepgram NER + BioClinical-GPT Slot Telemetry',
                    badge: '98.4% CONFIDENCE',
                    badgeColor: 'indigo',
                    icon: Tag
                };
            case 'emergencies':
            case 'emergency-dispatch':
            case 'risk-override':
                return {
                    title: 'Emergency Triage Flags & Priority-1 Dispatch',
                    subtitle: 'Sector 18, Noida • Tactical Triangulation & Response Fleet Mobilization',
                    badge: '92% CRITICAL ESCALATION',
                    badgeColor: 'rose',
                    icon: AlertTriangle
                };
            case 'call-history':
            case 'call-queue':
            default:
                return {
                    title: 'Emergency Call History & Audit Trail',
                    subtitle: 'Historical Call Audits • Incident Classification Summaries & Resolution Logs',
                    badge: '1,284 AUDIT ENTRIES',
                    badgeColor: 'indigo',
                    icon: History
                };
        }
    };

    const meta = getModalMeta();
    const Icon = meta.icon;

    // GSAP Physics Expansion
    useLayoutEffect(() => {
        if (!modalContentRef.current || !overlayRef.current) return;
        const modal = modalContentRef.current;
        const overlay = overlayRef.current;
        document.body.style.overflow = 'hidden';

        const modalRect = modal.getBoundingClientRect();
        let deltaX = 0, deltaY = 0, scaleX = 0.85, scaleY = 0.85;

        if (originRect) {
            scaleX = originRect.width / modalRect.width;
            scaleY = originRect.height / modalRect.height;
            deltaX = (originRect.left + originRect.width / 2) - (modalRect.left + modalRect.width / 2);
            deltaY = (originRect.top + originRect.height / 2) - (modalRect.top + modalRect.height / 2);
        }

        gsap.set(overlay, { opacity: 0 });
        gsap.set(modal, { x: deltaX, y: deltaY, scaleX, scaleY, borderRadius: '24px', opacity: 0 });

        const tl = gsap.timeline();
        tl.to(overlay, { opacity: 1, duration: 0.25, ease: 'power2.out' })
          .to(modal, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, borderRadius: '24px', duration: 0.35, ease: 'back.out(1.15)' }, '-=0.15');

        return () => { document.body.style.overflow = ''; };
    }, [originRect]);

    const handleSmoothClose = useCallback(() => {
        if (!modalContentRef.current || !overlayRef.current) { onClose(); return; }
        const tl = gsap.timeline({ onComplete: onClose });
        tl.to(modalContentRef.current, { scale: 0.95, y: 15, opacity: 0, duration: 0.2, ease: 'power2.in' })
          .to(overlayRef.current, { opacity: 0, duration: 0.15 }, '-=0.1');
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') handleSmoothClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSmoothClose]);

    // Unique Context-Specific Deep-Dive Content via Conditional Switch
    const renderModalContent = () => {
        switch (activeCardKey) {

            // 1. ACTIVE CALLS REGISTRY
            case 'active-calls': {
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-mono font-bold text-slate-700">
                                Total Monitored Channels: {activeCalls?.length || 6}
                            </span>
                            <span className="text-xs font-mono text-emerald-600 font-semibold">Carrier Route A-09 Active</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-100">
                                        <th className="py-2.5">Line ID</th>
                                        <th className="py-2.5">Caller ID</th>
                                        <th className="py-2.5">Location</th>
                                        <th className="py-2.5">Duration</th>
                                        <th className="py-2.5">Language</th>
                                        <th className="py-2.5">Risk Status</th>
                                        <th className="py-2.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {(activeCalls || []).map((call) => (
                                        <tr key={call.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 font-mono font-bold text-indigo-600">{call.id}</td>
                                            <td className="py-3 font-mono font-semibold text-slate-900">{call.maskedId || call.caller}</td>
                                            <td className="py-3 text-slate-600">{call.location}</td>
                                            <td className="py-3 font-mono text-slate-500">{formatDuration(call.durationSec)}</td>
                                            <td className="py-3">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">{call.lang}</span>
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                                    call.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                    call.risk === 'REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    {call.risk}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => onToast && onToast(`Patched into line ${call.id}`, 'listen')}
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                                                        title="Patch In"
                                                    >
                                                        <Headphones className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            takeOverCall(call.id);
                                                            if (onToast) onToast(`Supervisor took over ${call.id}`, 'zap');
                                                        }}
                                                        className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                                                    >
                                                        <Zap className="w-3 h-3" /> Take Over
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }

            // 2. AGORA ANS AUDIO WORKBENCH
            case 'audio-stream': {
                return (
                    <div className="space-y-5">
                        {/* Audio Controls & Denoise Mode Toggle */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                                    Neural Noise Reduction State
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {ansEnabled ? 'Agora ANS AI suppression active (removes traffic, horns, sirens)' : 'Raw unfiltered microphone stream'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setAnsEnabled(false); if (onToast) onToast('Acoustic filter bypassed: Raw Mic active', 'listen'); }}
                                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                        !ansEnabled ? 'bg-slate-800 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Raw Mic
                                </button>
                                <button
                                    onClick={() => { setAnsEnabled(true); if (onToast) onToast('Agora ANS Neural Denoising engaged', 'check'); }}
                                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                        ansEnabled ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    ANS Denoised (Opus 24kHz)
                                </button>
                            </div>
                        </div>

                        {/* Frequency Waveform Scrubber Visualizer */}
                        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                <span>Spectral Frequency Scrubber (20Hz - 24,000Hz)</span>
                                <span className="text-emerald-400 font-bold">SNR Gain: +18.4 dB</span>
                            </div>
                            <div className="h-28 flex items-end justify-between gap-1 px-2 pt-4">
                                {Array.from({ length: 48 }).map((_, i) => {
                                    const height = ansEnabled 
                                        ? Math.max(15, Math.sin(i * 0.4) * 45 + 50 + (i % 3) * 8)
                                        : Math.max(25, (Math.random() * 70) + 30);
                                    return (
                                        <div key={i} className="flex-1 bg-slate-800 rounded-t-sm flex flex-col justify-end h-full">
                                            <div 
                                                className={`w-full rounded-t-sm transition-all duration-300 ${ansEnabled ? 'bg-indigo-400' : 'bg-rose-400'}`}
                                                style={{ height: `${height}%` }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Telemetry Stats & Gain Slider */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Noise Floor</span>
                                <p className="text-base font-bold font-mono text-slate-900 mt-0.5">-42.8 dB</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">Packet Loss</span>
                                <p className="text-base font-bold font-mono text-emerald-600 mt-0.5">0.0% (Jitter 12ms)</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex justify-between mb-1">
                                    <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">DSP Gain</span>
                                    <span className="font-mono font-bold text-indigo-600">{gainLevel}%</span>
                                </div>
                                <input 
                                    type="range" min="30" max="100" value={gainLevel}
                                    onChange={(e) => setGainLevel(Number(e.target.value))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                );
            }

            // 3. EMERGENCY TRIAGE FLAGS & DISPATCH
            case 'emergencies':
            case 'emergency-dispatch':
            case 'risk-override': {
                return (
                    <div className="space-y-5">
                        {/* Critical GPS Triangulation Radar */}
                        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                                    <MapPin className="w-6 h-6 animate-bounce" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">
                                        CELL TOWER TRIANGULATION ANCHOR
                                    </span>
                                    <h4 className="text-sm font-extrabold text-white">Sector 18 Metro Pillar 42, Noida (UP)</h4>
                                    <p className="text-xs font-mono text-slate-400">Coordinates: 28.5708° N, 77.3271° E • Accuracy ± 4m</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onToast && onToast('Opened Tactical Maps with live GPS anchor', 'map')}
                                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5 flex-shrink-0"
                            >
                                Open Map Telemetry
                            </button>
                        </div>

                        {/* Nearest Response Fleet with Direct Dispatch Triggers */}
                        <div className="space-y-2.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                                Nearest Available Response Units
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                {/* ALS Ambulance */}
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                                <Truck className="w-4 h-4 text-rose-600" /> Amb-02 (ALS)
                                            </span>
                                            <span className="font-mono font-bold text-rose-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                4m ETA
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">Kailash Hospital Sector 27 Standby</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDispatchedUnits(prev => ({ ...prev, amb: true }));
                                            if (onToast) onToast('Dispatched Ambulance Amb-02 to Sector 18', 'siren');
                                        }}
                                        disabled={dispatchedUnits.amb}
                                        className={`w-full py-1.5 rounded-xl font-bold text-xs transition-all ${
                                            dispatchedUnits.amb ? 'bg-slate-800 text-white cursor-default' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                                        }`}
                                    >
                                        {dispatchedUnits.amb ? '✓ Dispatched' : 'Dispatch ALS'}
                                    </button>
                                </div>

                                {/* Police Patrol */}
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                                <Shield className="w-4 h-4 text-indigo-600" /> PCR-14 Patrol
                                            </span>
                                            <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                2m ETA
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">Atta Market Circle Cruiser</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDispatchedUnits(prev => ({ ...prev, pcr: true }));
                                            if (onToast) onToast('Dispatched Police Patrol PCR-14 to Sector 18', 'siren');
                                        }}
                                        disabled={dispatchedUnits.pcr}
                                        className={`w-full py-1.5 rounded-xl font-bold text-xs transition-all ${
                                            dispatchedUnits.pcr ? 'bg-slate-800 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                        }`}
                                    >
                                        {dispatchedUnits.pcr ? '✓ Dispatched' : 'Dispatch Police'}
                                    </button>
                                </div>

                                {/* Fire & HazMat */}
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                                <Flame className="w-4 h-4 text-amber-600" /> FT-07 HazMat
                                            </span>
                                            <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                8m ETA
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">Sector 2 Station Squad</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDispatchedUnits(prev => ({ ...prev, fire: true }));
                                            if (onToast) onToast('Dispatched Fire Squad FT-07 to Sector 18', 'siren');
                                        }}
                                        disabled={dispatchedUnits.fire}
                                        className={`w-full py-1.5 rounded-xl font-bold text-xs transition-all ${
                                            dispatchedUnits.fire ? 'bg-slate-800 text-white cursor-default' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                                        }`}
                                    >
                                        {dispatchedUnits.fire ? '✓ Dispatched' : 'Dispatch HazMat'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Supervisor Tactical Takeover Action */}
                        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-4">
                            <div>
                                <h5 className="text-xs font-bold text-rose-900">Priority-1 Supervisor Voice Takeover</h5>
                                <p className="text-xs text-rose-700 mt-0.5">Disconnects automated triage and bridges supervisor SUP-004 directly to Line C-1021</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsOverridden(true);
                                    takeOverCall('C-1021');
                                    if (onToast) onToast('Supervisor SUP-004 took over Line C-1021', 'zap');
                                }}
                                disabled={isOverridden}
                                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                    isOverridden ? 'bg-slate-800 text-white cursor-default' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5" /> {isOverridden ? '✓ Voice Controlled (SUP-004)' : 'Take Over Line'}
                            </button>
                        </div>
                    </div>
                );
            }

            // 4. LIVE TRANSCRIPTION CONSOLE
            case 'transcription': {
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-mono font-bold text-indigo-600">Line C-1021 Verbatim Audio Stream</span>
                            <span className="text-xs font-mono text-slate-400">WER 0.8% • 42ms Inference</span>
                        </div>

                        {/* Diarized Speech Log */}
                        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-smooth-scroll">
                            {(transcriptSegments || []).map(seg => (
                                <div key={seg.id} className={`p-3 rounded-xl border text-xs ${seg.isAi ? 'bg-indigo-50/70 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                                        <span className="font-bold text-indigo-600">[{seg.timestamp}] {seg.speaker}</span>
                                        <span>{seg.confidence}</span>
                                    </div>
                                    <p className="font-medium text-slate-800 leading-relaxed">"{seg.text}"</p>
                                </div>
                            ))}
                            <div className="p-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/20 text-xs">
                                <div className="flex justify-between text-[10px] font-mono text-indigo-600 mb-1">
                                    <span>[00:14.2] SPEAKER_01 (Caller)</span>
                                    <span className="animate-pulse">Streaming...</span>
                                </div>
                                <p className="italic text-slate-700">"Bheed ikattha ho rahi hai metro pillar 42 ke saamne, jaldi ambulance bhejo..."</p>
                            </div>
                        </div>

                        {/* Whisper Guidance Input */}
                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                            <input
                                type="text"
                                value={whisperText}
                                onChange={(e) => setWhisperText(e.target.value)}
                                placeholder="Inject supervisor whisper guidance prompt..."
                                className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400"
                            />
                            <button
                                onClick={() => {
                                    if (whisperText.trim() && onToast) onToast(`Whisper guidance injected: "${whisperText}"`, 'zap');
                                    setWhisperText('');
                                }}
                                className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" /> Whisper
                            </button>
                        </div>
                    </div>
                );
            }

            // 5. AI EXTRACTED METADATA
            case 'metadata': {
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Incident Classification</span>
                                <p className="text-base font-bold text-slate-900">Road Traffic Collision (Multi-Vehicle)</p>
                                <p className="text-slate-500">Extracted via BioClinical-GPT SlotFiller (99.4% confidence)</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Exact Geo-Anchor</span>
                                <p className="text-base font-bold text-indigo-600">Sector 18 Metro Pillar 42</p>
                                <p className="text-slate-500">Noida, Uttar Pradesh (Carrier Tower A-09 Triangulated)</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Trauma / Injury Status</span>
                                <p className="text-base font-bold text-rose-600">Severe Shock &amp; Arterial Hemorrhage</p>
                                <p className="text-slate-500">Immediate BLS / ALS airway stabilization required</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Golden Hour Urgency</span>
                                <p className="text-base font-bold text-rose-600">&lt; 8 Mins Required</p>
                                <p className="text-slate-500">Caller Cadence: 148 WPM (Acoustic Distress Index 94%)</p>
                            </div>
                        </div>
                    </div>
                );
            }

            // 6. CALL HISTORY & AUDIT TRAIL
            case 'call-history':
            case 'call-queue':
            default: {
                return (
                    <div className="space-y-4">
                        {/* 24h KPI Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Logged (24h)</span>
                                <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">1,284</p>
                                <span className="text-[11px] text-slate-500 block">Calls Triaged</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">AI Resolved</span>
                                <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">68%</p>
                                <span className="text-[11px] text-slate-500 block">873 Autonomous</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Supervisor Handover</span>
                                <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">18%</p>
                                <span className="text-[11px] text-slate-500 block">231 Escalated</span>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Units Dispatched</span>
                                <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">14%</p>
                                <span className="text-[11px] text-slate-500 block">180 Mobilized</span>
                            </div>
                        </div>

                        {/* Historical Audit Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-[10px] font-mono font-bold uppercase text-slate-400 border-b border-slate-100">
                                        <th className="py-2.5">Call ID</th>
                                        <th className="py-2.5">Incident</th>
                                        <th className="py-2.5">Risk Tier</th>
                                        <th className="py-2.5">Outcome</th>
                                        <th className="py-2.5 text-right">Audit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {CALL_HISTORY_DATA.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 font-mono text-indigo-600 font-bold">{row.callId}</td>
                                            <td className="py-2.5 font-medium text-slate-800">{row.incident}</td>
                                            <td className="py-2.5">
                                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                                    row.risk === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                    row.risk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    {row.risk}
                                                </span>
                                            </td>
                                            <td className={`py-2.5 font-semibold ${row.statusColor}`}>{row.status}</td>
                                            <td className="py-2.5 text-right">
                                                <button
                                                    onClick={() => onToast && onToast(`Inspecting Audit ${row.callId}: ${row.desc}`, 'file')}
                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }
        }
    };

    return (
        <div 
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            onClick={(e) => {
                if (e.target === overlayRef.current) handleSmoothClose();
            }}
        >
            <div 
                ref={modalContentRef}
                className="bg-white/95 backdrop-blur-3xl border border-white/90 rounded-3xl max-w-4xl w-full shadow-[0_25px_70px_rgb(0,0,0,0.15)] relative max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100 bg-white/80 backdrop-blur-md flex-shrink-0 z-10">
                    <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-2xl shadow-inner flex items-center justify-center ${
                            meta.badgeColor === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                    {meta.title}
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                    meta.badgeColor === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                    {meta.badge}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {meta.subtitle}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleSmoothClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Dismiss (ESC)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body Container with 100% Unique Dedicated Views */}
                <div className="p-6 overflow-y-auto flex-1 custom-smooth-scroll bg-slate-50/30">
                    {renderModalContent()}
                </div>
            </div>
        </div>
    );
};

export default ExpansionModal;
