// RESCURO Mock Data & Configuration
export const INITIAL_METRICS = {
    activeCalls: 12,
    emergencies: 3,
    supervisors: "08/12",
    deepgramSttAccuracy: 99.2,
    packetLoss: "0.01%",
    latencyTotal: 217,
    pipeline: [
        { name: "Twilio Trunk", latency: 12, status: "stable", jitter: 1.2 },
        { name: "Agora ANS", latency: 8, status: "live", jitter: 0.8 },
        { name: "Deepgram Nova-2", latency: 45, status: "live", jitter: 2.1 },
        { name: "RESCURO Triage", latency: 120, status: "live", jitter: 4.5 },
        { name: "ElevenLabs TTS", latency: 32, status: "stable", jitter: 1.9 }
    ]
};

export const CARD_DATA = {
    'active-calls': {
        id: 'active-calls',
        title: 'Active Concurrent Calls Telemetry',
        icon: '📞',
        badge: '12 CONCURRENT',
        badgeColor: 'indigo',
        subtitle: 'Noida Sector 18 Regional Exchange • Carrier Route A-09',
        telemetry: {
            activeChannels: 12,
            peakBandwidth: '3.4 Mbps',
            concurrentMax: 20,
            avgCallDuration: '2m 45s',
            dropRate: '0.00%'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    },
    'audio-stream': {
        id: 'audio-stream',
        title: 'Agora ANS & AI-VAD Audio Stream Deep Dive',
        icon: '🎙️',
        badge: 'LIVE ANS NOISE REDUCTION',
        badgeColor: 'emerald',
        subtitle: 'Real-time WebRTC 24kHz Stream • Agora AI Acoustic Suppression',
        telemetry: {
            noiseSuppressionDb: '-24.5 dB',
            vadConfidence: '98.8%',
            sampleRate: '24,000 Hz',
            bitrate: '48 kbps Opus',
            codec: 'Opus Fullband Stereo'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    },
    'emergencies': {
        id: 'emergencies',
        title: 'Emergency Triage & Escalation Dispatch',
        icon: '⚠️',
        badge: 'PRIORITY 1 - SEVERE',
        badgeColor: 'rose',
        subtitle: 'Automated Multi-Agency Dispatch Protocol Active',
        telemetry: {
            urgencyScore: '94/100',
            traumaProbability: '89%',
            nearestAmbulanceDist: '1.2 km (4 mins ETA)',
            policeSectorUnit: 'PCR-14 Stationed Atta Market',
            fireDepartment: 'Standby Unit 3'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    },
    'transcription': {
        id: 'transcription',
        title: 'Live Bilingual Audio Transcription & NLP Diagnostics',
        icon: '💬',
        badge: 'DEEPGRAM NOVA-2 STREAM',
        badgeColor: 'indigo',
        subtitle: 'Hinglish Mixed-Language Speech-to-Text Model',
        telemetry: {
            wordErrorRate: '1.4%',
            detectedLanguage: 'Hinglish (Hindi 62% + English 38%)',
            speakerDiarization: 'Caller (Speaker 0) / AI (Speaker 1)',
            tokenLatency: '68ms',
            sentimentPolarity: '-0.82 (High Distress)'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    },
    'metadata': {
        id: 'metadata',
        title: 'AI Entity Extraction & Incident Classification',
        icon: '⚡',
        badge: 'AUTO-TRIAGE MODEL 4.2',
        badgeColor: 'indigo',
        subtitle: 'Real-time JSON schema slot extraction from voice dialogue',
        telemetry: {
            slotAccuracy: '99.1%',
            entitiesExtracted: 8,
            confidenceAvg: '94.2%',
            hazardCategory: 'Trauma / Road Safety',
            geoResolution: 'High Confidence Geocoding'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    },
    'risk-override': {
        id: 'risk-override',
        title: 'High Risk Incident Telemetry & Supervisor Override',
        icon: '🚨',
        badge: 'OVERRIDE ACTION REQUIRED',
        badgeColor: 'rose',
        subtitle: 'AI Risk Confidence 92% • Immediate Supervisor Intervention Recommended',
        telemetry: {
            riskScore: '92%',
            escalationLevel: 'Level 3 Emergency',
            supervisorRole: 'SUP-004 (Active)',
            safetyStatus: 'Critical Intervention Threshold Exceeded',
            overrideHoldTime: '00:42'
        },
        callId: 'C-1021',
        caller: '+91 98110-XXXXX',
        location: 'Sector 18, Noida, Uttar Pradesh',
        incident: 'Road Traffic Collision with Injuries'
    }
};

export const CALL_QUEUE_DATA = [
    { id: "****4521", duration: "03:42", lang: "Hinglish", risk: "HIGH", riskClass: "bg-rose-50 text-rose-600 border border-rose-200/60", location: "Noida Sector 18" },
    { id: "****7219", duration: "01:38", lang: "Hindi", risk: "REVIEW", riskClass: "bg-amber-50 text-amber-700 border border-amber-200/60", location: "Gurugram" },
    { id: "****4582", duration: "02:14", lang: "Hinglish", risk: "SAFE", riskClass: "bg-emerald-50 text-emerald-600 border border-emerald-200/60", location: "South Delhi" },
    { id: "****9831", duration: "00:51", lang: "English", risk: "SAFE", riskClass: "bg-emerald-50 text-emerald-600 border border-emerald-200/60", location: "Faridabad" }
];

export const CALL_HISTORY_DATA = [
    { callId: "C-1021", incident: "Road Accident", risk: "HIGH", status: "In Progress", statusColor: "text-amber-600", desc: "Dispatched Medical Squad" },
    { callId: "C-1020", incident: "Medical Help", risk: "LOW", status: "AI Resolved", statusColor: "text-emerald-600", desc: "Resolved by AI Assistant" },
    { callId: "C-1019", incident: "Fire Incident", risk: "MEDIUM", status: "Handed Over", statusColor: "text-indigo-600", desc: "Handed Over to Supervisor" },
    { callId: "C-1018", incident: "Gas Leak", risk: "HIGH", status: "Dispatched", statusColor: "text-emerald-600", desc: "Gas Leak Response Team Dispatched" }
];

// Backwards compatibility for window globals if needed
if (typeof window !== 'undefined') {
    window.Rescuro = window.Rescuro || {};
    window.Rescuro.INITIAL_METRICS = INITIAL_METRICS;
    window.Rescuro.CARD_DATA = CARD_DATA;
    window.Rescuro.CALL_QUEUE_DATA = CALL_QUEUE_DATA;
    window.Rescuro.CALL_HISTORY_DATA = CALL_HISTORY_DATA;
}
