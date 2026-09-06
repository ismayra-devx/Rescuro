import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../services/api';

// ─── Operational Roles & Access Matrix ──────────────────────────────────────
export const ROLES = {
    GUEST: 'GUEST',
    FIELD_RESPONDER: 'FIELD_RESPONDER',
    DISPATCHER: 'DISPATCHER',
    LEAD_DISPATCHER: 'LEAD_DISPATCHER',
    SUPERVISOR: 'SUPERVISOR',
    ADMIN: 'ADMIN'
};

export const PERMISSIONS = {
    [ROLES.GUEST]: {
        canViewLiveDashboard: true,
        canViewTranscripts: false,
        canOverrideAI: false,
        canAcknowledgeAlarms: false,
        canDispatchUnits: false,
        canViewTelemetry: false,
        canViewQueue: false
    },
    [ROLES.FIELD_RESPONDER]: {
        canViewLiveDashboard: true,
        canViewTranscripts: true,
        canOverrideAI: false,
        canAcknowledgeAlarms: true,
        canDispatchUnits: false,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.DISPATCHER]: {
        canViewLiveDashboard: true,
        canViewTranscripts: true,
        canOverrideAI: false,
        canAcknowledgeAlarms: true,
        canDispatchUnits: true,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.LEAD_DISPATCHER]: {
        canViewLiveDashboard: true,
        canViewTranscripts: true,
        canOverrideAI: true,
        canAcknowledgeAlarms: true,
        canDispatchUnits: true,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.SUPERVISOR]: {
        canViewLiveDashboard: true,
        canViewTranscripts: true,
        canOverrideAI: true,
        canAcknowledgeAlarms: true,
        canDispatchUnits: true,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.ADMIN]: {
        canViewLiveDashboard: true,
        canViewTranscripts: true,
        canOverrideAI: true,
        canAcknowledgeAlarms: true,
        canDispatchUnits: true,
        canViewTelemetry: true,
        canViewQueue: true
    }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentRole, setCurrentRole] = useState(ROLES.GUEST);
    const [authLoading, setAuthLoading] = useState(() => {
        return typeof window !== 'undefined' && !!localStorage.getItem('rescuro_jwt');
    });
    const [user, setUser] = useState({
        id: null,
        name: null,
        supervisorId: null,
        department: null,
        token: null,
        authenticated: false
    });

    // Restore authenticated session from real backend token
    useEffect(() => {
        const storedToken = localStorage.getItem('rescuro_jwt');
        if (!storedToken) {
            setAuthLoading(false);
            return;
        }

        async function verifySession() {
            console.log('[Auth] Restoring session from localStorage token...');
            try {
                const res = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                console.log('[Auth] GET /api/auth/me response status:', res.status);
                if (res.ok) {
                    const userData = await res.json();
                    console.log('[Auth] Session restored for user:', userData.email, 'Role:', userData.role);
                    const role = userData.role?.toUpperCase() === 'SUPERVISOR'
                        ? ROLES.SUPERVISOR
                        : (ROLES[userData.role?.toUpperCase()] || ROLES.LEAD_DISPATCHER);
                    setCurrentRole(role);
                    setUser({
                        id: userData.id,
                        name: userData.full_name || userData.email.split('@')[0],
                        supervisorId: `SUP-${userData.id}`,
                        department: 'RESCURO Dispatch Command',
                        token: storedToken,
                        authenticated: true
                    });
                } else {
                    console.warn('[Auth] Stored token rejected by /api/auth/me (status ' + res.status + '), clearing localStorage');
                    localStorage.removeItem('rescuro_jwt');
                }
            } catch (err) {
                console.error('[Auth] Network error while verifying session:', err);
            } finally {
                setAuthLoading(false);
            }
        }
        verifySession();
    }, []);

    const login = async (email, password) => {
        const trimmedEmail = (email || '').trim().toLowerCase();
        console.log('[Auth] login() initiated for email:', trimmedEmail);
        try {
            console.log('[Auth] Sending POST /api/auth/login payload:', { email: trimmedEmail, password: '***' });
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail, password })
            });

            console.log('[Auth] POST /api/auth/login response status:', res.status, res.statusText);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const errorMsg = err.detail || 'Invalid credentials. Access denied.';
                console.warn('[Auth] Login rejected by server:', errorMsg);
                return { success: false, message: errorMsg };
            }

            const data = await res.json();
            const token = data.access_token;
            console.log('[Auth] Login response received. Saving token to localStorage under "rescuro_jwt"...');
            localStorage.setItem('rescuro_jwt', token);
            console.log('[Auth] Token saved to localStorage successfully.');

            const userObj = data.user;
            const role = userObj.role?.toUpperCase() === 'SUPERVISOR'
                ? ROLES.SUPERVISOR
                : (ROLES[userObj.role?.toUpperCase()] || ROLES.LEAD_DISPATCHER);

            setCurrentRole(role);
            setUser({
                id: userObj.id,
                name: userObj.full_name || userObj.email.split('@')[0],
                supervisorId: `SUP-${userObj.id}`,
                department: 'RESCURO Dispatch Command',
                token: token,
                authenticated: true
            });
            console.log('[Auth] User state updated: authenticated = true, id =', userObj.id, 'role =', role);
            return { success: true, user: userObj };
        } catch (err) {
            console.error('[Auth] Login network/request exception:', err);
            return { success: false, message: 'Server unreachable. Please check connection.' };
        }
    };

    const signup = async (email, password, fullName, role = 'dispatcher') => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password, full_name: fullName, role })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { success: false, message: err.detail || 'Registration failed.' };
            }

            const data = await res.json();
            const token = data.access_token;
            localStorage.setItem('rescuro_jwt', token);
            const userObj = data.user;

            const userRole = userObj.role?.toUpperCase() === 'SUPERVISOR'
                ? ROLES.SUPERVISOR
                : (ROLES[userObj.role?.toUpperCase()] || ROLES.LEAD_DISPATCHER);

            setCurrentRole(userRole);
            setUser({
                id: userObj.id,
                name: userObj.full_name || userObj.email.split('@')[0],
                supervisorId: `SUP-${userObj.id}`,
                department: 'RESCURO Dispatch Command',
                token: token,
                authenticated: true
            });
            return { success: true };
        } catch {
            return { success: false, message: 'Server unreachable. Please check connection.' };
        }
    };

    const switchRole = (newRole) => {
        if (ROLES[newRole]) {
            setCurrentRole(newRole);
        }
    };

    const logout = () => {
        localStorage.removeItem('rescuro_jwt');
        setUser({
            id: 'user-guest',
            name: 'Session Logged Out',
            supervisorId: 'NONE',
            department: 'Guest Monitoring',
            token: null,
            authenticated: false
        });
        setCurrentRole(ROLES.GUEST);
    };

    const hasPermission = (permission) => {
        return !!(PERMISSIONS[currentRole] && PERMISSIONS[currentRole][permission]);
    };

    const hasRole = (role) => {
        return currentRole === role;
    };

    return (
        <AuthContext.Provider value={{
            user,
            currentRole,
            authLoading,
            login,
            signup,
            logout,
            switchRole,
            hasPermission,
            hasRole,
            ROLES
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
