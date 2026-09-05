import React, { createContext, useContext, useState } from 'react';

export const ROLES = {
    SUPERVISOR: 'SUPERVISOR',
    DISPATCHER: 'DISPATCHER',
    OPERATOR: 'OPERATOR',
    GUEST: 'GUEST'
};

const PERMISSIONS = {
    [ROLES.SUPERVISOR]: {
        canTakeover: true,
        canWhisper: true,
        canDispatch: true,
        canMute: true,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.DISPATCHER]: {
        canTakeover: false,
        canWhisper: false,
        canDispatch: true,
        canMute: false,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.OPERATOR]: {
        canTakeover: false,
        canWhisper: false,
        canDispatch: false,
        canMute: false,
        canViewTelemetry: true,
        canViewQueue: true
    },
    [ROLES.GUEST]: {
        canTakeover: false,
        canWhisper: false,
        canDispatch: false,
        canMute: false,
        canViewTelemetry: true,
        canViewQueue: false
    }
};

const AuthContext = createContext(null);

// ─── Hardcoded credential store (dev) ──────────────────────────────────────
const VALID_CREDENTIALS = [
    { username: 'jack harrison', password: '123@098', role: ROLES.SUPERVISOR, name: 'Jack Harrison', supervisorId: 'SUP-001', department: 'National Capital Region EMS' },
];

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

    const login = (username, password) => {
        const cred = VALID_CREDENTIALS.find(
            c => c.username.toLowerCase() === username.trim().toLowerCase() && c.password === password
        );
        if (!cred) {
            return { success: false, message: 'Invalid credentials. Access denied.' };
        }
        setCurrentRole(cred.role);
        setUser({
            id: 'user-001',
            name: cred.name,
            supervisorId: cred.supervisorId,
            department: cred.department,
            token: 'jwt-sup-rescuro-valid-9021',
            authenticated: true
        });
        return { success: true };
    };

    const switchRole = (newRole) => {
        if (ROLES[newRole]) {
            setCurrentRole(newRole);
        }
    };

    const logout = () => {
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
            switchRole,
            logout,
            hasPermission,
            hasRole,
            permissions: PERMISSIONS[currentRole]
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

export default AuthContext;
