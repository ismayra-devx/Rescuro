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

export const AuthProvider = ({ children }) => {
    // Default to SUPERVISOR for full initial command center capability
    const [currentRole, setCurrentRole] = useState(ROLES.SUPERVISOR);
    const [user, setUser] = useState({
        id: 'user-004',
        name: 'Ismayra Parveen',
        supervisorId: 'SUP-004',
        department: 'National Capital Region EMS',
        token: 'jwt-sup-rescuro-valid-9021',
        authenticated: true
    });

    const switchRole = (newRole) => {
        if (ROLES[newRole]) {
            setCurrentRole(newRole);
            setUser(prev => ({
                ...prev,
                name: newRole === ROLES.SUPERVISOR ? 'Ismayra Parveen' :
                      newRole === ROLES.DISPATCHER ? 'Rahul Sharma' :
                      newRole === ROLES.OPERATOR ? 'Ananya Roy' : 'Guest Observer',
                supervisorId: newRole === ROLES.SUPERVISOR ? 'SUP-004' : null
            }));
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
