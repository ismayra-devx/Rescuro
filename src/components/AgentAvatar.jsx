import React from 'react';

export const AgentAvatar = ({ 
    size = 'md', 
    className = '', 
    showStatus = false,
    status = 'online',
    variant = 'indigo'
}) => {
    // Size tokens
    const sizeMap = {
        xs: 'w-4 h-4',
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-10 h-10',
        xl: 'w-12 h-12'
    };

    const containerSize = sizeMap[size] || size;

    // Background styling tailored to blend harmoniously into any surface
    const variantStyles = {
        indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 border-indigo-200/70 shadow-xs',
        emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/70 shadow-xs',
        amber: 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200/70 shadow-xs',
        slate: 'bg-slate-100/90 border-slate-200 shadow-2xs',
        white: 'bg-white/90 border-white/90 shadow-xs',
        transparent: 'bg-transparent border-transparent shadow-none'
    };

    const badgeStyle = variantStyles[variant] || variantStyles.indigo;

    return (
        <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}>
            <div className={`${containerSize} rounded-xl border flex items-center justify-center overflow-hidden p-0.5 transition-transform ${badgeStyle}`}>
                <img 
                    src="/assets/agent-avatar.png" 
                    alt="AI Agent" 
                    className="w-full h-full object-contain filter drop-shadow-2xs select-none"
                    loading="eager"
                />
            </div>
            {showStatus && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
        </div>
    );
};

export default AgentAvatar;
