import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import wsService from '../services/websocket';
import supabaseService from '../services/supabase';

const LiveStreamContext = createContext(null);

export const INITIAL_CALLS_LIST = [
    { 
        id: 'C-1021', 
        caller: '+91 98110-XXXXX',
        maskedId: '****4521',
        location: 'Sector 18, Noida', 
        incident: 'Road Traffic Collision with Injuries',
        agent: 'Agent Nova-Triage',
        lang: 'Hinglish', 
        durationSec: 222, 
        risk: 'HIGH', 
        riskColor: 'rose',
        urgency: 'CRITICAL',
        snippet: 'Accident ho gaya hai metro station ke paas, ek aadmi ko severe chot lagi hai...',
        supervisorOverridden: false
    },
    { 
        id: 'C-1022', 
        caller: '+91 98765-XXXXX', 
        maskedId: '****7219',
        location: 'Cyber City, Gurugram', 
        incident: 'Severe Chest Pain / Possible Cardiac',
        agent: 'Agent Echo-BLS',
        lang: 'English', 
        durationSec: 98, 
        risk: 'HIGH', 
        riskColor: 'rose',
        urgency: 'HIGH',
        snippet: 'My colleague collapsed in the office corridor, breathing is shallow...',
        supervisorOverridden: false
    },
    { 
        id: 'C-1023', 
        caller: '+91 94120-XXXXX', 
        maskedId: '****4582',
        location: 'Chandni Chowk, Old Delhi', 
        incident: 'Commercial Gas Cylinder Leak',
        agent: 'Agent Aegis-Hazards',
        lang: 'Hindi', 
        durationSec: 145, 
        risk: 'REVIEW', 
        riskColor: 'amber',
        urgency: 'MEDIUM',
        snippet: 'Dukan ke peeche bohot tej gas ki badboo aa rahi hai, log ikattha hain...',
        supervisorOverridden: false
    },
    { 
        id: 'C-1024', 
        caller: '+91 99530-XXXXX', 
        maskedId: '****9831',
        location: 'Indirapuram, Ghaziabad', 
        incident: 'Motorcycle Skid / Minor Laceration',
        agent: 'Agent Rhea-Hindi',
        lang: 'Hinglish', 
        durationSec: 84, 
        risk: 'SAFE', 
        riskColor: 'emerald',
        urgency: 'LOW',
        snippet: 'Bike slip hui thi rain mein, haath mein chhil gaya hai, bandage chahiye...',
        supervisorOverridden: false
    },
    { 
        id: 'C-1025', 
        caller: '+91 97180-XXXXX', 
        maskedId: '****3190',
        location: 'Connaught Place, New Delhi', 
        incident: 'Pedestrian Fall / Ankle Fracture',
        agent: 'Agent Nova-Triage',
        lang: 'English', 
        durationSec: 62, 
        risk: 'SAFE', 
        riskColor: 'emerald',
        urgency: 'LOW',
        snippet: 'Tripped near Inner Circle block B, unable to put weight on right foot...',
        supervisorOverridden: false
    },
    { 
        id: 'C-1026', 
        caller: '+91 98211-XXXXX', 
        maskedId: '****6744',
        location: 'Greater Noida West', 
        incident: 'Apartment Balcony Smoke Reported',
        agent: 'Agent Aegis-Hazards',
        lang: 'Hinglish', 
        durationSec: 190, 
        risk: 'REVIEW', 
        riskColor: 'amber',
        urgency: 'MEDIUM',
        snippet: '14th floor balcony se black smoke nikal raha hai Gaur City tower 4...',
        supervisorOverridden: false
    }
];

export const INITIAL_ALERTS_LIST = [
    {
        id: 'ALT-901',
        title: 'Trauma Code Red: Multi-Vehicle Road Collision',
        location: 'Sector 18 Metro Pillar 42, Noida',
        priority: 'P1 CRITICAL',
        priorityColor: 'rose',
        timeElapsed: '03m 14s',
        nearestUnit: 'Ambulance Amb-02 (4m ETA)',
        supervisorAssigned: 'SUP-004 (Ismayra Parveen)',
        details: 'Caller reports pedestrian struck by speeding SUV. Severe head trauma and hemorrhage detected by AI triage slot-filling.'
    },
    {
        id: 'ALT-902',
        title: 'Cardiac Arrest / Unresponsive Male (48y)',
        location: 'Building 10B, Cyber City, Gurugram',
        priority: 'P1 CRITICAL',
        priorityColor: 'rose',
        timeElapsed: '01m 45s',
        nearestUnit: 'ALS Cardiac Unit-01 (6m ETA)',
        supervisorAssigned: 'SUP-002 (Rahul Sharma)',
        details: 'Bystander initiating CPR with AI Voice Agent Echo instructions. Automated external defibrillator (AED) located on ground floor.'
    },
    {
        id: 'ALT-903',
        title: 'High Pressure Commercial Gas Leak',
        location: 'Katra Neel, Chandni Chowk, Delhi',
        priority: 'P1 CRITICAL',
        priorityColor: 'rose',
        timeElapsed: '04m 20s',
        nearestUnit: 'Fire Tender Unit-07 (8m ETA)',
        supervisorAssigned: 'SUP-001 (Vikram Malhotra)',
        details: 'Heavy odor of LPG in densely populated market lane. AI Agent Aegis recommended immediate electrical grid cutoff for sector.'
    }
];

export const INITIAL_AGENTS_LIST = [
    {
        id: 'agent-nova',
        name: 'Agent Nova-Triage',
        role: 'Critical Trauma & Emergency Medical Triage',
        engine: 'Deepgram Nova-2 + GPT-4o Realtime',
        status: 'ONLINE',
        mode: 'Autonomous',
        latency: '42ms',
        accuracy: '99.4%',
        activeCalls: 2,
        totalCalls: 624,
        ttsVoice: 'Jessica (Calm Clinical)',
        supportedLangs: ['English', 'Hinglish', 'Hindi'],
        gradient: 'from-indigo-600 to-violet-600'
    },
    {
        id: 'agent-rhea',
        name: 'Agent Rhea-Hindi',
        role: 'Bilingual Regional Dispatch & Dialect Translation',
        engine: 'Whisper Large-v3 + Agora ANS Multi-Band',
        status: 'ONLINE',
        mode: 'Autonomous',
        latency: '58ms',
        accuracy: '98.8%',
        activeCalls: 1,
        totalCalls: 489,
        ttsVoice: 'Aditi (Bilingual Hindi-Eng)',
        supportedLangs: ['Hindi', 'Hinglish', 'Bhojpuri'],
        gradient: 'from-emerald-600 to-teal-600'
    },
    {
        id: 'agent-aegis',
        name: 'Agent Aegis-Hazards',
        role: 'Fire, Gas Leak & Structural Collapse Triage',
        engine: 'Claude 3.5 Sonnet + Fast NER Geo-Extractor',
        status: 'ONLINE',
        mode: 'Supervisor Guarded',
        latency: '64ms',
        accuracy: '99.1%',
        activeCalls: 2,
        totalCalls: 215,
        ttsVoice: 'Marcus (Authoritative Dispatch)',
        supportedLangs: ['English', 'Hindi'],
        gradient: 'from-amber-600 to-rose-600'
    },
    {
        id: 'agent-echo',
        name: 'Agent Echo-BLS',
        role: 'Caller Guidance & Basic Life Support (BLS / CPR)',
        engine: 'ElevenLabs Turbo v2.5 + Low-Jitter Stream',
        status: 'ONLINE',
        mode: 'Autonomous',
        latency: '35ms',
        accuracy: '99.6%',
        activeCalls: 1,
        totalCalls: 182,
        ttsVoice: 'Elena (Empathetic De-escalator)',
        supportedLangs: ['English', 'Hinglish'],
        gradient: 'from-cyan-600 to-blue-600'
    }
];

export const LiveStreamProvider = ({ children }) => {
    const [streamStatus, setStreamStatus] = useState('CONNECTING');
    const [latencies, setLatencies] = useState([12, 8, 45, 120, 32]);
    const [packetLoss, setPacketLoss] = useState('0.01%');
    const [jitterBuffer, setJitterBuffer] = useState('4.2ms');
    
    // Core Shared Reactive Operations State
    const [activeCalls, setActiveCalls] = useState(INITIAL_CALLS_LIST);
    const [alerts, setAlerts] = useState(INITIAL_ALERTS_LIST);
    const [agents, setAgents] = useState(INITIAL_AGENTS_LIST);

    const [transcriptSegments, setTranscriptSegments] = useState([
        {
            id: 't-1',
            timestamp: '00:01.8',
            speaker: 'SPEAKER_01 (Caller)',
            confidence: '98.6% Conf',
            text: 'Accident ho gaya hai, Sector 18 Noida mein metro station ke paas!',
            isAi: false
        },
        {
            id: 't-2',
            timestamp: '00:05.3',
            speaker: 'AI AGENT NOVA (Triage)',
            confidence: '42ms Latency',
            text: 'Please stay calm. Emergency services are being notified. Can you confirm if anyone is injured?',
            isAi: true
        },
        {
            id: 't-3',
            timestamp: '00:09.6',
            speaker: 'SPEAKER_01 (Caller)',
            confidence: '97.2% Conf',
            text: 'Ek aadmi ko bahut chot lagi hai, khoon beh raha hai... Jaldi kijiye!',
            isAi: false
        }
    ]);

    const [chatMessages, setChatMessages] = useState([
        { id: 1, author: 'CALLER (Channel 1)', text: 'Accident ho gaya hai, Sector 18 Noida mein metro station ke paas!', isAi: false },
        { id: 2, author: 'RESCURO AI ASSISTANT', text: 'Please stay calm. Emergency services are being notified. Can you confirm if anyone is injured?', isAi: true },
        { id: 3, author: 'CALLER (Channel 1)', text: 'Ek aadmi ko bahut chot lagi hai, khoon beh raha hai... Jaldi kijiye!', isAi: false }
    ]);

    // Live Ticking Timers for active calls
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveCalls(prev => prev.map(call => ({
                ...call,
                durationSec: call.durationSec + 1
            })));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Live WebSocket connection & updates
    useEffect(() => {
        wsService.connect();

        const unsubStatus = wsService.on('status_change', ({ status }) => {
            setStreamStatus(status);
        });

        const unsubTelemetry = wsService.on('telemetry_update', (data) => {
            if (data.pipeline) setLatencies(data.pipeline);
            if (data.packetLoss) setPacketLoss(data.packetLoss);
            if (data.jitterBuffer) setJitterBuffer(data.jitterBuffer);
        });

        // Bridge EchoSphere backend events → Rescuro chat panel
        const handleTranscript = (msg) => {
            const payload = msg.payload || msg;
            const text = payload.transcript || payload.text || msg.text;
            if (!text) return;
            const isAi = msg.isAi
                || msg.event_type === 'TTS_READY'
                || msg.event === 'TTS_READY'
                || (msg.author && msg.author.includes('AI'))
                || false;
            setChatMessages(prev => [
                ...prev,
                {
                    id: Date.now() + Math.random(),
                    author: isAi ? '🤖 RESCURO AI ASSISTANT' : '👤 CALLER (Hinglish)',
                    text: text,
                    isAi: isAi
                }
            ]);
        };

        const unsubTranscription = wsService.on('transcription_delta', handleTranscript);
        const unsubTr2 = wsService.on('TRANSCRIPT_RECEIVED', handleTranscript);
        const unsubTr3 = wsService.on('TRANSCRIPT_UPDATE', handleTranscript);
        const unsubTr4 = wsService.on('TTS_READY', (m) => handleTranscript({ ...m, isAi: true }));

        return () => {
            unsubStatus();
            unsubTelemetry();
            unsubTranscription();
            unsubTr2();
            unsubTr3();
            unsubTr4();
            wsService.disconnect();
        };
    }, []);

    // Interactive Action Handlers (Reactive across all views)
    const takeOverCall = useCallback((callId) => {
        setActiveCalls(prev => prev.map(c => {
            if (c.id === callId) {
                return {
                    ...c,
                    supervisorOverridden: true,
                    status: 'Supervisor Active (SUP-004)',
                    risk: 'REVIEW',
                    riskColor: 'amber'
                };
            }
            return c;
        }));
    }, []);

    const resolveCall = useCallback((callId) => {
        setActiveCalls(prev => prev.filter(c => c.id !== callId));
    }, []);

    const resolveAlert = useCallback((alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    const toggleAgentMode = useCallback((agentId) => {
        setAgents(prev => prev.map(ag => {
            if (ag.id === agentId) {
                return {
                    ...ag,
                    mode: ag.mode === 'Autonomous' ? 'Supervisor Guarded' : 'Autonomous'
                };
            }
            return ag;
        }));
    }, []);

    // General Action dispatcher
    const dispatchAction = async (actionType, payload, supervisorId = 'SUP-004') => {
        wsService.sendAction(actionType, { ...payload, supervisorId });
        await supabaseService.logSupervisorAction({
            action: actionType,
            callId: payload.callId || 'C-1021',
            supervisorId,
            notes: payload.notes
        });
    };

    return (
        <LiveStreamContext.Provider value={{
            streamStatus,
            latencies,
            packetLoss,
            jitterBuffer,
            transcriptSegments,
            chatMessages,
            activeCalls,
            alerts,
            agents,
            takeOverCall,
            resolveCall,
            resolveAlert,
            toggleAgentMode,
            dispatchAction
        }}>
            {children}
        </LiveStreamContext.Provider>
    );
};

export const useLiveStream = () => {
    const context = useContext(LiveStreamContext);
    if (!context) {
        throw new Error('useLiveStream must be used within a LiveStreamProvider');
    }
    return context;
};

export default LiveStreamContext;
