import React, { useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { gsap } from 'gsap';
import { useLiveStream } from '../context/LiveStreamContext';
import { X, Shield, Radio, AlertTriangle, History, PhoneCall, Mic } from 'lucide-react';

// Dedicated Card Deep-Dive Modals
import { ActiveCallsModal } from './modals/ActiveCallsModal';
import { AudioWorkbenchModal } from './modals/AudioWorkbenchModal';
import { LiveTranscriptionModal } from './modals/LiveTranscriptionModal';
import { EmergencyDispatchModal } from './modals/EmergencyDispatchModal';
import { CallHistoryModal } from './modals/CallHistoryModal';

export const ExpansionModal = ({ activeCardKey, originRect, onClose, onToast }) => {
    const { activeCalls, alerts } = useLiveStream();
    const overlayRef = useRef(null);
    const modalContentRef = useRef(null);

    // Dynamic Title & Badging per card
    const getModalMeta = () => {
        switch (activeCardKey) {
            case 'active-calls':
                return {
                    title: 'Active Concurrent Calls Registry',
                    subtitle: 'Live SIP Channels • Carrier Interconnect Route A-09',
                    badge: `${activeCalls?.length || 0} ACTIVE CHANNELS`,
                    badgeColor: 'indigo',
                    icon: PhoneCall
                };
            case 'audio-stream':
                return {
                    title: 'Acoustic DSP & Noise Suppression Workbench',
                    subtitle: 'Real-time WebRTC 24kHz Stream • Neural Noise Suppression & Speech Enhancement',
                    badge: '24kHz HD AUDIO',
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
            case 'emergencies':
            case 'risk-override':
                return {
                    title: 'Emergency Triage Flags & Dispatch Escalation',
                    subtitle: 'Sector 18, Noida • Priority-1 Critical Triage Intervention Required',
                    badge: `${alerts?.length || 0} CRITICAL ACTIONS`,
                    badgeColor: 'rose',
                    icon: AlertTriangle
                };
            case 'call-queue':
            case 'call-history':
                return {
                    title: 'Emergency Call History & Audit Trail',
                    subtitle: 'Historical Call Audits • Incident Classification Summaries & Resolution Logs',
                    badge: '1,284 AUDIT ENTRIES',
                    badgeColor: 'indigo',
                    icon: History
                };
            default:
                return {
                    title: 'Operational Telemetry Deep Dive',
                    subtitle: 'National Emergency Response System Node Intel',
                    badge: 'ACTIVE TELEMETRY',
                    badgeColor: 'indigo',
                    icon: Shield
                };
        }
    };

    const meta = getModalMeta();
    const Icon = meta.icon;

    // GSAP Fluid Physics-Based Card-to-Page Expansion (`gsap.fromTo`)
    useLayoutEffect(() => {
        if (!modalContentRef.current || !overlayRef.current) return;

        const modal = modalContentRef.current;
        const overlay = overlayRef.current;

        // Lock background scroll
        document.body.style.overflow = 'hidden';

        const modalRect = modal.getBoundingClientRect();

        let deltaX = 0;
        let deltaY = 0;
        let scaleX = 0.85;
        let scaleY = 0.85;

        if (originRect) {
            scaleX = originRect.width / modalRect.width;
            scaleY = originRect.height / modalRect.height;
            const originCenterX = originRect.left + originRect.width / 2;
            const originCenterY = originRect.top + originRect.height / 2;
            const modalCenterX = modalRect.left + modalRect.width / 2;
            const modalCenterY = modalRect.top + modalRect.height / 2;

            deltaX = originCenterX - modalCenterX;
            deltaY = originCenterY - modalCenterY;
        }

        const tl = gsap.timeline();

        // 1. Overlay Backdrop Fade & Blur
        tl.fromTo(overlay, 
            { opacity: 0, backdropFilter: 'blur(0px)' },
            { opacity: 1, backdropFilter: 'blur(16px)', duration: 0.4, ease: 'power2.out' },
            0
        );

        // 2. Physics-based Card-to-Page Scale & Morph (`gsap.fromTo`)
        tl.fromTo(modal,
            {
                x: deltaX,
                y: deltaY,
                scaleX: scaleX,
                scaleY: scaleY,
                opacity: 0.85,
                borderRadius: '1.25rem'
            },
            {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                borderRadius: '1.5rem',
                duration: 0.45,
                ease: 'power3.out'
            },
            0
        );

        return () => {
            document.body.style.overflow = '';
        };
    }, [originRect]);

    // GSAP Smooth Exit Transition (`gsap.to`)
    const handleSmoothClose = useCallback(() => {
        if (!modalContentRef.current || !overlayRef.current) {
            onClose();
            return;
        }

        const modal = modalContentRef.current;
        const overlay = overlayRef.current;

        let exitDeltaX = 0;
        let exitDeltaY = 15;
        let exitScaleX = 0.9;
        let exitScaleY = 0.9;

        if (originRect) {
            const modalRect = modal.getBoundingClientRect();
            exitScaleX = originRect.width / modalRect.width;
            exitScaleY = originRect.height / modalRect.height;
            const originCenterX = originRect.left + originRect.width / 2;
            const originCenterY = originRect.top + originRect.height / 2;
            const modalCenterX = modalRect.left + modalRect.width / 2;
            const modalCenterY = modalRect.top + modalRect.height / 2;

            exitDeltaX = originCenterX - modalCenterX;
            exitDeltaY = originCenterY - modalCenterY;
        }

        const exitTl = gsap.timeline({
            onComplete: () => {
                onClose();
            }
        });

        // Smooth morph back towards card origin
        exitTl.to(modal, {
            x: exitDeltaX,
            y: exitDeltaY,
            scaleX: exitScaleX * 0.95,
            scaleY: exitScaleY * 0.95,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in'
        }, 0);

        // Fade backdrop overlay smoothly
        exitTl.to(overlay, {
            opacity: 0,
            backdropFilter: 'blur(0px)',
            duration: 0.3,
            ease: 'power2.in'
        }, 0);
    }, [originRect, onClose]);

    // Keyboard ESC Dismiss
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleSmoothClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSmoothClose]);

    // Render exact dedicated deep-dive view based on clicked card key
    const renderModalContent = () => {
        switch (activeCardKey) {
            case 'active-calls':
                return <ActiveCallsModal onToast={onToast} />;
            case 'audio-stream':
                return <AudioWorkbenchModal onToast={onToast} />;
            case 'transcription':
                return <LiveTranscriptionModal onToast={onToast} />;
            case 'emergencies':
            case 'risk-override':
                return <EmergencyDispatchModal onToast={onToast} />;
            case 'call-queue':
            case 'call-history':
                return <CallHistoryModal onToast={onToast} />;
            default:
                return <ActiveCallsModal onToast={onToast} />;
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
                className="bg-white/95 backdrop-blur-3xl border border-white/90 rounded-3xl max-w-5xl w-full shadow-[0_25px_70px_rgb(0,0,0,0.15)] relative max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
            >
                {/* Clean Header Bar */}
                <div className="flex items-start justify-between p-6 sm:p-7 pb-4 border-b border-slate-100 bg-white/80 backdrop-blur-md flex-shrink-0 z-10">
                    <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-2xl shadow-inner flex items-center justify-center ${
                            meta.badgeColor === 'rose' ? 'bg-rose-50 text-rose-600' :
                            meta.badgeColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-indigo-50 text-indigo-600'
                        }`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                    {meta.title}
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                    meta.badgeColor === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                    meta.badgeColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                    {meta.badge}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {meta.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Close Modal Button */}
                    <button
                        onClick={handleSmoothClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Dismiss (ESC)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body Container with Dedicated Unique Views */}
                <div className="p-6 sm:p-7 overflow-y-auto flex-1 custom-smooth-scroll bg-slate-50/30">
                    {renderModalContent()}
                </div>
            </div>
        </div>
    );
};

export default ExpansionModal;
