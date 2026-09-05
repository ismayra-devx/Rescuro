/**
 * Rescuro Command - Fetch-Shaped Data Service
 * Standardized async API calls with realistic mock fallbacks for seamless FastAPI integration.
 */

export async function fetchActiveLines() {
    try {
        const res = await fetch('/api/active-lines');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return {
        activeCount: Math.floor(Math.random() * 4) + 4, // 4-7 open lines
        totalCapacity: 12,
        sipHealth: 'HEALTHY',
        latencyMs: 38,
        trunkStatus: '100% OPERATIONAL'
    };
}

export async function fetchAgoraMetrics() {
    try {
        const res = await fetch('/api/metrics/agora');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    const noiseFloor = (-42.0 + (Math.random() * 2 - 1)).toFixed(1);
    const snrGain = (+18.0 + (Math.random() * 1.5 - 0.75)).toFixed(1);
    return {
        noiseFloorDb: `${noiseFloor} dB`,
        snrGainDb: `+${snrGain} dB`,
        codec: 'HD OPUS (24kHz)',
        ansStatus: 'Neural Noise Suppression Active',
        packetLossRate: '0.01%'
    };
}

export async function fetchTriageFlags() {
    try {
        const res = await fetch('/api/triage/flags');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        {
            id: 'FLAG-901',
            callId: 'C-1021',
            priority: 'P1 CRITICAL',
            title: 'Multi-Vehicle Collision with Severe Head Trauma',
            location: 'Sector 18 Metro Pillar 42, Noida',
            timestamp: '02m 15s ago',
            urgencyWindow: '< 6 mins',
            status: 'ACTION REQUIRED'
        },
        {
            id: 'FLAG-902',
            callId: 'C-1022',
            priority: 'P1 CRITICAL',
            title: 'Unresponsive Male (48y) / Bystander CPR Initiated',
            location: 'Building 10B, Cyber City, Gurugram',
            timestamp: '01m 40s ago',
            urgencyWindow: '< 4 mins',
            status: 'ACTION REQUIRED'
        },
        {
            id: 'FLAG-903',
            callId: 'C-1023',
            priority: 'P1 CRITICAL',
            title: 'Commercial LPG Cylinder Leak in Dense Market',
            location: 'Katra Neel, Chandni Chowk, Delhi',
            timestamp: '04m 10s ago',
            urgencyWindow: '< 10 mins',
            status: 'REVIEWING'
        }
    ];
}

export async function fetchTranscriptFeed() {
    try {
        const res = await fetch('/api/transcripts/live');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        {
            id: 'tr-1',
            speaker: 'SPEAKER_01 (Caller)',
            time: '00:01.8',
            lang: 'Hinglish',
            text: 'Accident ho gaya hai, Sector 18 Noida mein metro station ke paas!',
            isAi: false
        },
        {
            id: 'tr-2',
            speaker: 'AI AGENT (Nova-Triage)',
            time: '00:05.3',
            lang: 'English',
            text: 'Please stay calm. Emergency services are being notified. Can you confirm if anyone is injured?',
            isAi: true
        },
        {
            id: 'tr-3',
            speaker: 'SPEAKER_01 (Caller)',
            time: '00:09.6',
            lang: 'Hinglish',
            text: 'Ek aadmi ko bahut chot lagi hai, khoon beh raha hai... Jaldi kijiye!',
            isAi: false
        },
        {
            id: 'tr-4',
            speaker: 'AI AGENT (Nova-Triage)',
            time: '00:14.2',
            lang: 'Hinglish',
            text: 'Samajh gaya. Ambulance team ko Sector 18 dispatched kar diya gaya hai. Kripya victim ko stable rakhein.',
            isAi: true
        }
    ];
}

export async function fetchExtractedSlots() {
    try {
        const res = await fetch('/api/triage/slots');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        { key: 'Incident Location', value: 'Sector 18, Metro Pillar 42, Noida', confidence: '99.2%', status: 'CONFIRMED' },
        { key: 'Injury Severity', value: 'Critical (Severe Hemorrhage / Unconscious)', confidence: '98.5%', status: 'HIGH_PRIORITY' },
        { key: 'Urgency Window', value: '< 6 mins (Trauma Golden Hour)', confidence: '97.8%', status: 'CRITICAL' },
        { key: 'Caller Language', value: 'Mixed Hinglish / Hindi', confidence: '99.4%', status: 'CONFIRMED' },
        { key: 'Hazards Present', value: 'Combustion Fuel Spill on Roadway', confidence: '94.1%', status: 'ATTENTION' }
    ];
}

export async function fetchDispatchUnits() {
    try {
        const res = await fetch('/api/dispatch/units');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        { id: 'UNIT-ALS-02', type: 'Ambulance ALS Unit', code: 'Amb-02', eta: '3 mins', distance: '1.2 km', status: 'AVAILABLE' },
        { id: 'UNIT-PCR-14', type: 'Police Patrol Unit', code: 'PCR-14', eta: '2 mins', distance: '0.8 km', status: 'AVAILABLE' },
        { id: 'UNIT-FIRE-07', type: 'Heavy Fire Tender', code: 'FT-07', eta: '6 mins', distance: '3.1 km', status: 'STANDBY' }
    ];
}

export async function fetchAnalyticsSummary() {
    try {
        const res = await fetch('/api/analytics/load');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return {
        totalIngestion: '1,510',
        totalIngestionDelta: '+12.4% vs last 24h',
        aiResolutionRate: '68.4%',
        avgTriageSpeed: '1m 42s',
        noiseReductionDb: '-24.5 dB',
        activeSupervisors: 4,
        avgLatencyMs: '42ms',
        hourlyLoad: [
            { hour: '00:00', total: 42, p1: 4 },
            { hour: '03:00', total: 28, p1: 2 },
            { hour: '06:00', total: 35, p1: 3 },
            { hour: '09:00', total: 85, p1: 9 },
            { hour: '12:00', total: 110, p1: 14 },
            { hour: '15:00', total: 98, p1: 11 },
            { hour: '18:00', total: 125, p1: 18 },
            { hour: '21:00', total: 72, p1: 7 }
        ],
        languageMix: [
            { language: 'Mixed Hinglish', percentage: 62, color: '#6B8F71' },
            { language: 'Pure Hindi', percentage: 24, color: '#D9A441' },
            { language: 'Indian English', percentage: 14, color: '#B5544A' }
        ]
    };
}

export async function fetchCallHistory() {
    try {
        const res = await fetch('/api/calls/history');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        {
            id: 'C-1021',
            timestamp: '2026-09-04 15:22:10',
            caller: '+91 98110-XXXXX',
            location: 'Sector 18 Metro, Noida',
            riskTier: 'CRITICAL',
            duration: '03m 42s',
            status: 'ACTIVE',
            dispatchedUnit: 'Amb-02 (3m ETA)',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        },
        {
            id: 'C-1020',
            timestamp: '2026-09-04 14:55:04',
            caller: '+91 98765-XXXXX',
            location: 'Building 10B, Cyber City, Gurugram',
            riskTier: 'CRITICAL',
            duration: '05m 12s',
            status: 'RESOLVED',
            dispatchedUnit: 'ALS Unit-01',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
        },
        {
            id: 'C-1019',
            timestamp: '2026-09-04 14:18:22',
            caller: '+91 94120-XXXXX',
            location: 'Katra Neel, Chandni Chowk, Delhi',
            riskTier: 'REVIEW',
            duration: '02m 45s',
            status: 'RESOLVED',
            dispatchedUnit: 'FT-07 (Fire Tender)',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        },
        {
            id: 'C-1018',
            timestamp: '2026-09-04 13:40:15',
            caller: '+91 99530-XXXXX',
            location: 'Indirapuram, Ghaziabad',
            riskTier: 'STABLE',
            duration: '01m 24s',
            status: 'RESOLVED',
            dispatchedUnit: 'Self Managed Guidance',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
        },
        {
            id: 'C-1017',
            timestamp: '2026-09-04 12:15:30',
            caller: '+91 97180-XXXXX',
            location: 'Connaught Place, New Delhi',
            riskTier: 'STABLE',
            duration: '01m 58s',
            status: 'RESOLVED',
            dispatchedUnit: 'PCR Patrol-04',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
        }
    ];
}

export async function fetchAlertsLog() {
    try {
        const res = await fetch('/api/alerts/history');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return [
        {
            id: 'BCAST-401',
            timestamp: '2026-09-04 14:30:00',
            initiator: 'SUP-004 (Ismayra Parveen)',
            summary: 'Sector 18 Emergency Grid Lockout & Multi-Unit Priority Dispatch',
            notifiedUnits: 'Ambulance Amb-02, PCR-14, Traffic Unit-08',
            channel: 'Agora SIP Multi-Band Broadcast'
        },
        {
            id: 'BCAST-400',
            timestamp: '2026-09-04 11:15:00',
            initiator: 'SUP-002 (Rahul Sharma)',
            summary: 'Cyber City Building 10 Cardiac Trauma Dispatch Alert',
            notifiedUnits: 'ALS Cardiac Unit-01, Cyber City Security',
            channel: 'Agora SIP Multi-Band Broadcast'
        }
    ];
}

export async function fetchSupervisorProfile() {
    try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback mock
    }
    return {
        name: 'Ismayra Parveen',
        supervisorId: 'SUP-004',
        callSign: 'ALPHA-COMMAND-1',
        jurisdiction: 'Delhi NCR Region (Zone 4)',
        role: 'Chief Emergency Operations Supervisor',
        status: 'ACTIVE_DUTY'
    };
}

export async function dispatchUnit(unitId, callId = 'C-1021') {
    try {
        const res = await fetch(`/api/dispatch/${unitId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId, timestamp: Date.now() })
        });
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback
    }
    return { success: true, unitId, status: 'DISPATCHED', eta: '3 mins' };
}

export async function broadcastAllUnits(summary) {
    try {
        const res = await fetch('/api/dispatches/broadcast-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary, initiator: 'SUP-004' })
        });
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback
    }
    return { success: true, broadcastId: `BCAST-${Date.now().toString().slice(-3)}` };
}

export async function updatePreferences(preferences) {
    try {
        const res = await fetch('/api/settings/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences)
        });
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback
    }
    return { success: true, updated: preferences };
}

export async function logoutSupervisor() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) return await res.json();
    } catch (e) {
        // Fallback
    }
    return { success: true, loggedOut: true };
}
