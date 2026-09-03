import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { 
    CheckCircle2, 
    Zap, 
    AlertTriangle, 
    Shield, 
    Headphones, 
    MapPin, 
    Radio, 
    PhoneCall, 
    FileText, 
    Bot, 
    Activity, 
    Compass,
    Bell
} from 'lucide-react';

export const Toast = ({ toast }) => {
    const toastRef = useRef(null);

    useEffect(() => {
        if (!toastRef.current) return;
        if (toast.visible) {
            gsap.fromTo(toastRef.current, 
                { y: 25, opacity: 0, scale: 0.95 },
                { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }
            );
        } else {
            gsap.to(toastRef.current, {
                y: 15, opacity: 0, scale: 0.96, duration: 0.2, ease: "power2.in"
            });
        }
    }, [toast.visible]);

    const getIconConfig = () => {
        switch (toast.icon) {
            case 'zap':
            case 'takeover':
                return {
                    Icon: Zap,
                    bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
                    tag: 'COMMAND OVERRIDE'
                };
            case 'siren':
            case 'dispatch':
            case 'alert':
                return {
                    Icon: AlertTriangle,
                    bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                    tag: 'EMERGENCY DISPATCH'
                };
            case 'listen':
            case 'headset':
                return {
                    Icon: Headphones,
                    bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
                    tag: 'AUDIO CHANNEL'
                };
            case 'map':
                return {
                    Icon: Compass,
                    bg: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
                    tag: 'GEO-TACTICAL MAP'
                };
            case 'nav':
                return {
                    Icon: Compass,
                    bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
                    tag: 'NAVIGATION'
                };
            case 'call':
                return {
                    Icon: PhoneCall,
                    bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
                    tag: 'LINE REGISTRY'
                };
            case 'bot':
                return {
                    Icon: Bot,
                    bg: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
                    tag: 'AI AGENT CORE'
                };
            case 'check':
                return {
                    Icon: CheckCircle2,
                    bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                    tag: 'SUCCESS'
                };
            default:
                return {
                    Icon: Bell,
                    bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
                    tag: 'SYSTEM STATUS'
                };
        }
    };

    const { Icon, bg, tag } = getIconConfig();

    return (
        <div 
            ref={toastRef}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/70 shadow-[0_16px_40px_rgba(0,0,0,0.30)] text-white max-w-md select-none transition-all ${
                toast.visible ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
            }`}
        >
            {/* High-End Glowing Micro Icon Orb */}
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className="w-4 h-4" />
            </div>

            {/* Structured Dual-Tier Notification Text */}
            <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-slate-400 leading-none mb-1">
                    {tag}
                </span>
                <p className="text-xs font-semibold text-slate-100 leading-snug truncate">
                    {toast.message}
                </p>
            </div>

            {/* Pulse Indicator */}
            <div className="flex-shrink-0 pl-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse block"></span>
            </div>
        </div>
    );
};

export default Toast;
