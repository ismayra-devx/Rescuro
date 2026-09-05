import React, { useState } from 'react';
import { Header } from '../components/Header';
import { CallCard } from '../components/CallCard';
import { TranscriptCard } from '../components/TranscriptCard';
import { CallLogsCard } from '../components/CallLogsCard';
import { AlertCircle, Shield } from 'lucide-react';

export function DashboardPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isTranscriptActive, setIsTranscriptActive] = useState(false);
  const [refreshLogsKey, setRefreshLogsKey] = useState(0);

  const handleCallFinished = () => {
    setRefreshLogsKey((prev) => prev + 1);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px', position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto' }}>
      {/* Tactical Top Header */}
      <Header />

      {/* Main Command Grid (2-Column) */}
      <main>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {/* Card 1: Call RESCURO */}
          <CallCard
            isActive={isCallActive}
            isOtherActive={isTranscriptActive}
            onCallStateChange={setIsCallActive}
            onCallFinished={handleCallFinished}
          />

          {/* Card 2: Live Transcript */}
          <TranscriptCard
            isActive={isTranscriptActive}
            isOtherActive={isCallActive}
            onTranscriptStateChange={setIsTranscriptActive}
          />
        </div>

        {/* Global Operational Constraint Notice */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(219, 234, 254, 0.8)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: 'var(--text-tertiary)',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={15} style={{ color: 'var(--primary-blue)' }} />
          <span>
            Operational constraint: <strong>Only RESCURO call and speech-to-text are active</strong> (mutually exclusive channel prioritization).
          </span>
        </div>

        {/* Call Audit & Telemetry Activity Logs */}
        <CallLogsCard refreshKey={refreshLogsKey} />
      </main>
    </div>
  );
}
