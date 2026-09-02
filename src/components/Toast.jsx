import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const Toast = ({ toast }) => {
    const toastRef = useRef(null);

    useEffect(() => {
        if (!toastRef.current) return;
        if (toast.visible) {
            gsap.fromTo(toastRef.current, 
                { y: 30, opacity: 0, scale: 0.9 },
                { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" }
            );
        } else {
            gsap.to(toastRef.current, {
                y: 20, opacity: 0, scale: 0.95, duration: 0.25, ease: "power2.in"
            });
        }
    }, [toast.visible]);

    const renderIcon = () => {
        if (toast.icon === 'headset') {
            return (
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                </svg>
            );
        }
        if (toast.icon === 'dispatch' || toast.icon === 'alert') {
            return (
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
            );
        }
        if (toast.icon === 'shield') {
            return (
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
            );
        }
        return (
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        );
    };

    return (
        <div 
            ref={toastRef}
            className={`fixed bottom-6 right-6 bg-white/95 backdrop-blur-xl border border-indigo-200 shadow-2xl shadow-indigo-500/15 rounded-2xl px-5 py-3.5 text-slate-800 text-sm font-semibold flex items-center gap-3 z-[100] ${toast.visible ? 'pointer-events-auto' : 'pointer-events-none opacity-0'}`}
        >
            <div className="flex-shrink-0">{renderIcon()}</div>
            <span>{toast.message}</span>
        </div>
    );
};

export default Toast;
