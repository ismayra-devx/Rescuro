import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Radio } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: 'var(--primary-blue)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--blue-badge-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Radio size={28} className="pulse-sky" style={{ borderRadius: '50%' }} />
        </div>
        <p className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          INITIALIZING SECURE LINK...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
}

export function App() {
  return (
    <>
      <div className="canvas-ambient-glow" />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </>
  );
}

export default App;
