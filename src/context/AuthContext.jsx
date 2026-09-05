import React, { createContext, useContext, useState, useEffect } from 'react';

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
        if (!storedToken) return;

        async function verifySession() {
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                if (res.ok) {
                    const userData = await res.json();
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
                    localStorage.removeItem('rescuro_jwt');
                }
            } catch {
                // Keep local state unchanged if network check fails
            }
        }
        verifySession();
    }, []);

    const login = async (username, password) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: username.trim(), password })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { success: false, message: err.detail || 'Invalid credentials. Access denied.' };
            }

            const data = await res.json();
            const token = data.access_token;
            localStorage.setItem('rescuro_jwt', token);
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
            login,
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
