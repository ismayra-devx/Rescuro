import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * RBACGuard: Enforces Role-Based Access Control
 * @param {string} requiredRole - e.g. "SUPERVISOR"
 * @param {string} requiredPermission - e.g. "canTakeover"
 * @param {ReactNode} fallback - Custom fallback when unauthorized
 */
export const RBACGuard = ({ 
    requiredRole, 
    requiredPermission, 
    children, 
    fallback = null
}) => {
    const { hasRole, hasPermission } = useAuth();

    let isAuthorized = true;

    if (requiredRole && !hasRole(requiredRole)) {
        isAuthorized = false;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        isAuthorized = false;
    }

    if (isAuthorized) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    // Default attractive locked state for controls
    return (
        <div className="relative group w-full">
            <div className="opacity-45 pointer-events-none cursor-not-allowed filter grayscale-[30%]">
                {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] rounded-xl border border-dashed border-rose-300">
                <span className="px-2.5 py-1 rounded-md bg-white/95 border border-rose-200 text-rose-600 font-mono text-[10px] font-bold shadow-xs flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>RESTRICTED ({requiredRole || 'SUPERVISOR'} ONLY)</span>
                </span>
            </div>
        </div>
    );
};

export default RBACGuard;
