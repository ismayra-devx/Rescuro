import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { History, PhoneIncoming, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

export function CallLogsCard({ refreshKey }) {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/calls/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token, refreshKey]);

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--blue-badge-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-blue)',
            }}
          >
            <History size={18} />
          </div>
          <h2 className="card-title" style={{ fontSize: '1.1rem' }}>
            Tactical Session Activity & Audit Logs
          </h2>
        </div>

        <button
          onClick={fetchLogs}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          title="Refresh call activity"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading activity logs...</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          <Clock size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
          <p style={{ fontSize: '0.875rem' }}>No recent calls logged for this session yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(203, 213, 225, 0.6)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>CALL ID</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>TIMESTAMP</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>DURATION</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>AGENT</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid rgba(226, 232, 240, 0.4)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(240, 247, 255, 0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="font-mono" style={{ padding: '10px 12px', color: 'var(--primary-blue)', fontWeight: 600 }}>
                    #CAL-{String(log.id).padStart(4, '0')}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {formatTime(log.start_time)}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {log.duration_sec}s
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="badge-secure" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={10} />
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    agro (voice)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
