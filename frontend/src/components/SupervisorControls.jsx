import React, { useState } from 'react';
import { useAuth, ROLES } from '../context/AuthContext';
import { useLiveStream } from '../context/LiveStreamContext';
import { RBACGuard } from './RBACGuard';

export const SupervisorControls = ({ onToast }) => {
    const { user, currentRole } = useAuth();
    const { dispatchAction } = useLiveStream();

    const [isTakeoverActive, setIsTakeoverActive] = useState(false);
    const [isAiMuted, setIsAiMuted] = useState(false);
    const [isDispatched, setIsDispatched] = useState(false);

    const handleTakeover = async () => {
        const nextState = !isTakeoverActive;
        setIsTakeoverActive(nextState);
        await dispatchAction(nextState ? 'SUPERVISOR_TAKEOVER' : 'RELEASE_TO_AI', {
            callId: 'C-1021',
            notes: nextState ? 'Supervisor manual audio line intervention' : 'Handed back to AI'
        }, user.supervisorId);

        onToast(
            nextState 
                ? `Supervisor ${user.supervisorId || 'SUP-004'} intervened and took over active audio channel` 
                : "Call control returned to AI Autonomous Voice Engine",
            "headset"
        );
    };

    const handleWhisper = async () => {
        await dispatchAction('WHISPER_PROMPT_INJECT', {
            callId: 'C-1021',
            promptText: 'Direct ambulance to Gate 4 of Sector 18 metro station'
        }, user.supervisorId);
        onToast("Whisper Audio Prompt injected into AI Assistant pipeline", "mic");
    };

    const handleDispatch = async () => {
        setIsDispatched(true);
        await dispatchAction('PRIORITY_UNITS_DISPATCH', {
            callId: 'C-1021',
            units: ['PCR-14', 'Ambulance Amb-02'],
            location: 'Sector 18, Noida'
        }, user.supervisorId);
        onToast("Emergency Units (Police PCR-14 & Trauma Ambulance) Dispatched to Sector 18", "dispatch");
    };

    const handleMute = async () => {
        const nextMute = !isAiMuted;
        setIsAiMuted(nextMute);
        await dispatchAction(nextMute ? 'MUTE_AI_ENGINE' : 'UNMUTE_AI_ENGINE', {
            callId: 'C-1021'
        }, user.supervisorId);
        onToast(nextMute ? "AI Voice Engine Muted (Silence Mode)" : "AI Voice Engine Unmuted", "mute");
    };

    return (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 gsap-stagger-child shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                        Supervisor Override Center
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        currentRole === ROLES.SUPERVISOR 
                            ? 'bg-rose-100 text-rose-700' 
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                        {user.supervisorId ? `AUTH: ${user.supervisorId}` : `ROLE: ${currentRole}`}
                    </span>
                </div>
            </div>

            <div className="space-y-2.5">
                {/* 1. Take Over Call Button (SUPERVISOR ONLY) */}
                <RBACGuard requiredPermission="canTakeover" requiredRole={ROLES.SUPERVISOR} actionLabel="Intervene & Take Over">
                    <button 
                        onClick={handleTakeover}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 ${
                            isTakeoverActive 
                                ? 'bg-amber-600 text-white shadow-amber-500/20 hover:bg-amber-700' 
                                : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                        </svg>
                        <span>{isTakeoverActive ? 'Release Call Back to AI Assistant' : 'Intervene & Take Over Call'}</span>
                    </button>
                </RBACGuard>

                {/* 2. Whisper Prompt (SUPERVISOR ONLY) */}
                <RBACGuard requiredPermission="canWhisper" requiredRole={ROLES.SUPERVISOR} actionLabel="Audio Whisper">
                    <button 
                        onClick={handleWhisper}
                        className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-98"
                    >
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        </svg>
                        <span>Inject Audio Whisper Prompt to AI</span>
                    </button>
                </RBACGuard>

                {/* 3. Dispatch Emergency Units (SUPERVISOR or DISPATCHER) */}
                <RBACGuard requiredPermission="canDispatch" actionLabel="Emergency Unit Dispatch">
                    <button 
                        onClick={handleDispatch}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 ${
                            isDispatched 
                                ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                : 'bg-rose-600 text-white shadow-rose-500/20 hover:bg-rose-700'
                        }`}
                    >
                        {isDispatched ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="3" width="15" height="13"/>
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                                <circle cx="5.5" cy="18.5" r="2.5"/>
                                <circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                        )}
                        <span>{isDispatched ? 'Units Dispatched (PCR-14 & Ambulance En Route)' : 'Dispatch Medical & Police Units'}</span>
                    </button>
                </RBACGuard>

                {/* 4. Mute Voice Engine (SUPERVISOR ONLY) */}
                <RBACGuard requiredPermission="canMute" requiredRole={ROLES.SUPERVISOR} actionLabel="Mute Voice Engine">
                    <button 
                        onClick={handleMute}
                        className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98 ${
                            isAiMuted 
                                ? 'bg-rose-50 border-rose-300 text-rose-700' 
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-2xs'
                        }`}
                    >
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23"/>
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                        </svg>
                        <span>{isAiMuted ? 'Unmute AI Voice Engine' : 'Mute AI Voice Engine'}</span>
                    </button>
                </RBACGuard>
            </div>
        </div>
    );
};

export default SupervisorControls;
