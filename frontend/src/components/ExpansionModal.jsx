import React, { useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { gsap } from 'gsap';
import { CARD_DATA } from '../data/mockData';
import { AudioTimelineWidget } from './AudioTimelineWidget';
import { PipelineTelemetryWidget } from './PipelineTelemetryWidget';
import { SupervisorControls } from './SupervisorControls';

export const ExpansionModal = ({ activeCardKey, originRect, onClose, onToast }) => {
    const overlayRef = useRef(null);
    const modalContentRef = useRef(null);

    const card = CARD_DATA[activeCardKey] || CARD_DATA['risk-override'];

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

        // Physics-based starting state calculated from clicked origin card
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
            { opacity: 1, backdropFilter: 'blur(16px)', duration: 0.45, ease: 'power2.out' },
            0
        );

        // 2. Physics-based Card-to-Page Scale & Morph (`gsap.fromTo`)
        tl.fromTo(modal,
            {
                x: deltaX,
                y: deltaY,
                scaleX: scaleX,
                scaleY: scaleY,
                borderRadius: '24px',
                opacity: 0.5,
                transformOrigin: '50% 50%'
            },
            {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                borderRadius: '28px',
                opacity: 1,
                duration: 0.55,
                ease: 'power3.out' // physics spring curve
            },
            0
        );

        // 3. Stagger inner widgets entrance
        tl.fromTo('.gsap-stagger-child',
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.38, stagger: 0.05, ease: 'power2.out' },
            0.2
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
            borderRadius: '20px',
            duration: 0.35,
            ease: 'power3.in'
        }, 0);

        exitTl.to(overlay, {
            opacity: 0,
            backdropFilter: 'blur(0px)',
            duration: 0.3,
            ease: 'power2.in'
        }, 0.05);

    }, [originRect, onClose]);

    // Keyboard ESC listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleSmoothClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSmoothClose]);

    return (
        <div 
            ref={overlayRef}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            onClick={(e) => {
                if (e.target === overlayRef.current) handleSmoothClose();
            }}
        >
            <div 
                ref={modalContentRef}
                className="bg-white border border-slate-200/95 rounded-3xl max-w-5xl w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
            >
                {/* Fixed Header */}
                <div className="flex items-start justify-between p-6 sm:p-8 pb-5 border-b border-slate-100 gsap-stagger-child bg-white flex-shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                                    {card.title}
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wide ${
                                    card.badgeColor === 'rose' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                                    card.badgeColor === 'emerald' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                    'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                }`}>
                                    {card.badge}
                                </span>
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {card.location}
                                </span>
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold">Incident: {card.incident}</span>
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleSmoothClose}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all active:scale-95"
                        title="Close Deep Dive (ESC)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Smooth Scrollable Body with Inset Padding */}
                <div className="flex-1 overflow-y-auto custom-smooth-scroll p-6 sm:p-8 pt-5 space-y-6">
                    {/* Modal Grid: Telemetry, Audio Timeline & Controls */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                        {/* LEFT COLUMN: AUDIO PLAYBACK & EXTENDED TELEMETRY (7 Cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            <AudioTimelineWidget onToast={onToast} />
                            <PipelineTelemetryWidget />
                        </div>

                        {/* RIGHT COLUMN: SUPERVISOR OVERRIDE & INCIDENT INTEL (5 Cols) */}
                        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                            <SupervisorControls onToast={onToast} />

                            {/* INCIDENT METADATA SUMMARY */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 space-y-3 gsap-stagger-child shadow-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                                        Incident Telemetry Summary
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                        92% RISK CRITICAL
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                                        <span className="text-slate-500">Call ID</span>
                                        <span className="font-mono font-bold text-indigo-600">C-1021</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                                        <span className="text-slate-500">Caller Number</span>
                                        <span className="font-mono font-bold text-slate-800">+91 98110-XXXXX</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                                        <span className="text-slate-500">GPS Coordinates</span>
                                        <span className="font-mono font-bold text-slate-800">28.5708° N, 77.3261° E</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                                        <span className="text-slate-500">Nearest Unit</span>
                                        <span className="font-mono font-bold text-emerald-600">Ambulance Amb-02 (4m ETA)</span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-500">Supervisor Signature</span>
                                        <span className="font-mono font-semibold text-slate-400">SUP-004-VERIFIED</span>
                                    </div>
                                </div>
                            </div>

                            {/* ESC Hint */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-center text-xs text-slate-400 font-mono gsap-stagger-child">
                                Press <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">ESC</kbd> or click backdrop to exit deep dive
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpansionModal;
