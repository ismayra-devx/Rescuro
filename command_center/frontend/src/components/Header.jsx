import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Clock, LogOut, Radio, User } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      // UTC and Local time in monospace
      const hours = now.getHours();
      const timeFormatted = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTimeStr(`${timeFormatted} UTC${now.getTimezoneOffset() <= 0 ? '+' : '-'}${Math.abs(Math.round(now.getTimezoneOffset() / 60))}`);

      // Time-based greeting
      if (hours < 12) {
        setGreeting('Good morning');
      } else if (hours < 18) {
        setGreeting('Good afternoon');
      } else {
        setGreeting('Good evening');
      }
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'Commander';

  return (
    <header className="glass-card" style={{ padding: '16px 28px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-blue-alt) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px var(--primary-blue-glow)',
            }}
          >
            <Radio size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="heading-extrabold" style={{ fontSize: '1.25rem' }}>
                RESCURO Command Center
              </h1>
              <span className="badge-secure">
                <span className="pulse-dot pulse-secure"></span>
                Secure Session
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {greeting}, <strong style={{ color: 'var(--text-primary)' }}>{user?.full_name || firstName}</strong>
            </p>
          </div>
        </div>

        {/* Telemetry Clock & User Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Monospace Clock Readout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.7)',
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(203, 213, 225, 0.5)',
            }}
          >
            <Clock size={15} style={{ color: 'var(--primary-blue)' }} />
            <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {timeStr}
            </span>
          </div>

          {/* User Avatar & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--blue-badge-bg)',
                border: '1.5px solid var(--primary-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-blue)',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
              title={user?.email}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>

            <button
              onClick={logout}
              className="btn-secondary"
              title="Sign out of Command Center"
              style={{ padding: '8px 12px' }}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
