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
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        riskColor: 'blue',
        urgency: 'LOW',
        snippet: 'Bike slip hui thi rain mein, haath mein chhil gaya hai, bandage chahiye...',
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        riskColor: 'blue',
        urgency: 'LOW',
        snippet: 'Tripped near Inner Circle block B, unable to put weight on right foot...',
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        supervisorOverridden: false,
        isMock: true,
        isLive: false
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
        id: 'agent-core',
        name: 'RESCURO Core — Unified Multilingual Agent',
        role: 'Autonomous Emergency Medical Triage, Multi-Dialect Code-Switching & Hazard Dispatch',
        engine: 'Deepgram Nova-2 + GPT-4o Realtime RTC',
        status: 'ONLINE',
        mode: 'Autonomous',
        latency: '34ms',
        accuracy: '99.4%',
        activeCalls: 6,
        totalCalls: 1510,
        ttsVoice: 'Aditi-Jessica Neural Hybrid',
        supportedLangs: ['English', 'Hindi', 'Hinglish'],
        gradient: 'from-indigo-600 via-blue-600 to-indigo-700'
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
                    author: isAi ? 'RESCURO AI ASSISTANT' : 'CALLER (Hinglish)',
                    text: text,
                    isAi: isAi
                }
            ]);
            const sessionId = msg.session_id || msg.payload?.session_id || msg.payload?.call_id || msg.call_id;
            if (sessionId) {
                setActiveCalls(prev => prev.map(c => (c.id === sessionId || c.call_id === sessionId) ? { ...c, snippet: text } : c));
            }
        };

        const handleNewCall = (msg) => {
            const payload = msg.payload || msg;
            const sessionId = payload.session_id || payload.call_id || msg.session_id || msg.call_id;
            if (!sessionId) return;
            setActiveCalls(prev => {
                const callData = {
                    id: sessionId,
                    call_id: sessionId,
                    caller: payload.caller || payload.from || '+91 Live Line',
                    maskedId: '****' + (sessionId.slice(-4)),
                    location: payload.location || 'Realtime Exotel Voice Line',
                    incident: payload.incident || payload.category || 'Active Emergency Line',
                    agent: 'Agent Nova-Triage',
                    lang: payload.language || 'Hinglish',
                    durationSec: 0,
                    risk: 'HIGH',
                    riskColor: 'rose',
                    urgency: 'HIGH',
                    snippet: 'Live voice session connected...',
                    supervisorOverridden: false,
                    source: payload.source || 'exotel',
                    isLive: true,
                    isMock: false
                };
                // When an active call is going on, filter out all mock calls so the dashboard displays ONLY the live active call
                const liveCalls = prev.filter(c => (c.isLive || c.source === 'exotel' || c.id?.startsWith('EXO-')) && !c.isMock && c.id !== sessionId);
                return [callData, ...liveCalls];
            });
        };

        const handleTriageUpdate = (msg) => {
            const payload = msg.payload || msg;
            const sessionId = msg.session_id || payload.session_id;
            const priority = payload.priority || 'MEDIUM';
            const isEmergency = msg.event === 'EMERGENCY_ALERT' || msg.event_type === 'EMERGENCY_DETECTED' || priority === 'CRITICAL' || priority === 'HIGH';

            if (sessionId) {
                setActiveCalls(prev => prev.map(c => {
                    if (c.id === sessionId) {
                        return {
                            ...c,
                            incident: payload.category || payload.incident || c.incident,
                            urgency: priority,
                            risk: isEmergency ? 'HIGH' : (priority === 'LOW' ? 'SAFE' : 'REVIEW'),
                            riskColor: isEmergency ? 'rose' : (priority === 'LOW' ? 'blue' : 'amber'),
                            snippet: payload.reason || payload.summary || c.snippet
                        };
                    }
                    return c;
                }));
            }

            if (isEmergency) {
                setAlerts(prev => [
                    {
                        id: `ALT-${Date.now().toString().slice(-3)}`,
                        title: payload.title || payload.reason || 'Critical Emergency Triage Alert',
                        location: payload.location || 'Live Voice Call Session',
                        priority: 'P1 CRITICAL',
                        priorityColor: 'rose',
                        timeElapsed: '00m 01s',
                        nearestUnit: 'Dispatch Pending (P1)',
                        supervisorAssigned: 'SUP-004 (Ismayra Parveen)',
                        details: payload.reason || 'AI triage flagged high severity emergency condition.'
                    },
                    ...prev
                ]);
            }
        };

        const handleSupervisorConnected = (msg) => {
            const payload = msg.payload || msg;
            const sessionId = msg.session_id || payload.session_id;
            if (sessionId) {
                setActiveCalls(prev => prev.map(c => c.id === sessionId ? { ...c, supervisorOverridden: true, status: 'Supervisor Active (SUP-004)', risk: 'REVIEW', riskColor: 'amber' } : c));
            }
        };

        const handleCallEnded = (msg) => {
            const payload = msg.payload || msg;
            const sessionId = msg.session_id || payload.session_id || payload.call_id;
            if (sessionId) {
                setActiveCalls(prev => prev.filter(c => c.id !== sessionId && c.call_id !== sessionId));
            }
        };

        const handleSupervisorTakeoverRequest = (msg) => {
            const payload = msg.payload || msg;
            const sessionId = msg.session_id || payload.session_id || payload.call_id;
            if (sessionId) {
                setActiveCalls(prev => {
                    const liveCalls = prev.filter(c => !c.isMock);
                    const exists = liveCalls.some(c => c.id === sessionId);
                    let base = liveCalls;
                    if (!exists) {
                        const newLive = {
                            id: sessionId,
                            call_id: sessionId,
                            caller: payload.caller || '+91 Live Line',
                            maskedId: '****' + (sessionId.slice(-4)),
                            location: 'Realtime Exotel Voice Line',
                            incident: 'Caller Demands Human Supervisor',
                            agent: 'Agent Nova-Triage',
                            lang: 'Hinglish',
                            durationSec: 0,
                            risk: 'HIGH',
                            riskColor: 'rose',
                            urgency: 'CRITICAL',
                            snippet: payload.reason || 'Caller verbally requested human supervisor takeover.',
                            supervisorOverridden: false,
                            source: 'exotel',
                            isLive: true,
                            isMock: false
                        };
                        base = [newLive, ...liveCalls];
                    }
                    return base.map(c => {
                        if (c.id === sessionId) {
                            return {
                                ...c,
                                urgency: 'CRITICAL',
                                risk: 'HIGH',
                                riskColor: 'rose',
                                status: 'Supervisor Requested by Caller',
                                snippet: payload.reason || 'Caller verbally requested human supervisor takeover.'
                            };
                        }
                        return c;
                    });
                });
                setAlerts(prev => [
                    {
                        id: `ALT-SUP-${Date.now().toString().slice(-3)}`,
                        title: 'CRITICAL: Caller Demands Human Supervisor',
                        location: sessionId,
                        priority: 'P1 CRITICAL',
                        priorityColor: 'rose',
                        timeElapsed: '00m 01s',
                        nearestUnit: 'Supervisor Console (Immediate Voice Bridge)',
                        supervisorAssigned: 'SUP-004 (Ismayra Parveen)',
                        details: payload.reason || 'Caller on active line requested immediate human supervisor takeover.'
                    },
                    ...prev
                ]);
                setTakeoverModalCallId(sessionId);
            }
        };

        const unsubTranscription = wsService.on('transcription_delta', handleTranscript);
        const unsubTr2 = wsService.on('TRANSCRIPT_RECEIVED', handleTranscript);
        const unsubTr3 = wsService.on('TRANSCRIPT_UPDATE', handleTranscript);
        const unsubTr4 = wsService.on('TTS_READY', (m) => handleTranscript({ ...m, isAi: true }));
        const unsubNewCall = wsService.on('NEW_CALL', handleNewCall);
        const unsubCallStarted = wsService.on('CALL_STARTED', handleNewCall);
        const unsubIncoming = wsService.on('INCOMING_CALL', handleNewCall);
        const unsubExotelStart = wsService.on('EXOTEL_CALL_STARTED', handleNewCall);
        const unsubTriage = wsService.on('TRIAGE_UPDATE', handleTriageUpdate);
        const unsubTriageComp = wsService.on('TRIAGE_COMPLETED', handleTriageUpdate);
        const unsubEmergAlert = wsService.on('EMERGENCY_ALERT', handleTriageUpdate);
        const unsubEmergDet = wsService.on('EMERGENCY_DETECTED', handleTriageUpdate);
        const unsubSupConn = wsService.on('SUPERVISOR_CONNECTED', handleSupervisorConnected);
        const unsubSupReq = wsService.on('SUPERVISOR_REQUESTED', handleSupervisorTakeoverRequest);
        const unsubSupReq2 = wsService.on('SUPERVISOR_CALL_TAKEOVER_REQUEST', handleSupervisorTakeoverRequest);
        const unsubCallEnded = wsService.on('CALL_ENDED', handleCallEnded);

        return () => {
            unsubStatus();
            unsubTelemetry();
            unsubTranscription();
            unsubTr2();
            unsubTr3();
            unsubTr4();
            unsubNewCall();
            unsubCallStarted();
            unsubIncoming();
            unsubExotelStart();
            unsubTriage();
            unsubTriageComp();
            unsubEmergAlert();
            unsubEmergDet();
            unsubSupConn();
            unsubSupReq();
            unsubSupReq2();
            unsubCallEnded();
            wsService.disconnect();
        };
    }, []);

    // Audio Override State (Human-in-the-Loop)
    const [isSupervisorMicMuted, setIsSupervisorMicMuted] = useState(false);
    const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
    const [isSupervisorOnHold, setIsSupervisorOnHold] = useState(false);
    const [supervisorVolume, setSupervisorVolume] = useState(85);
    const [takeoverModalCallId, setTakeoverModalCallId] = useState(null);

    const toggleSupervisorMic = useCallback(() => {
        setIsSupervisorMicMuted(prev => !prev);
    }, []);

    const toggleSpeakerMute = useCallback(() => {
        setIsSpeakerMuted(prev => !prev);
    }, []);

    const toggleSupervisorHold = useCallback(() => {
        setIsSupervisorOnHold(prev => !prev);
    }, []);

    const openTakeoverModal = useCallback((callId) => {
        setTakeoverModalCallId(callId);
    }, []);

    const closeTakeoverModal = useCallback(() => {
        setTakeoverModalCallId(null);
    }, []);

    // Interactive Action Handlers (Reactive across all views)
    const takeOverCall = useCallback((callId, openModal = true) => {
        let targetId = callId;
        setActiveCalls(prev => {
            const liveCall = prev.find(c => c.isLive || c.source === 'exotel' || c.id?.startsWith('EXO-'));
            if ((!targetId || targetId === 'C-1021') && liveCall) {
                targetId = liveCall.id;
            }
            return prev.map(c => {
                if (c.id === callId || c.id === targetId) {
                    return {
                        ...c,
                        originalRisk: c.originalRisk || c.risk,
                        supervisorOverridden: true,
                        supervisorId: 'SUP-004',
                        status: 'Supervisor Active (SUP-004)',
                        risk: 'REVIEW',
                        riskColor: 'amber'
                    };
                }
                return c;
            });
        });
        const finalId = targetId || callId || 'C-1021';
        if (openModal) {
            setTakeoverModalCallId(finalId);
        }
        wsService.sendAction('SUPERVISOR_TAKEOVER', {
            callId: finalId,
            session_id: finalId,
            notes: 'Supervisor manual audio line intervention via Rescuro Console'
        });
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('rescuro_jwt') : null;
            if (token) {
                fetch('/supervisor/override', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ session_id: finalId, reason: 'Supervisor manual audio line intervention via Rescuro Console' })
                }).catch(() => {});
            }
        } catch (_) {}
    }, []);

    const releaseCallToAi = useCallback((callId) => {
        let targetId = callId;
        setActiveCalls(prev => {
            const liveCall = prev.find(c => c.isLive || c.source === 'exotel' || c.id?.startsWith('EXO-'));
            if ((!targetId || targetId === 'C-1021') && liveCall) {
                targetId = liveCall.id;
            }
            return prev.map(c => {
                if (c.id === callId || c.id === targetId) {
                    return {
                        ...c,
                        supervisorOverridden: false,
                        status: 'AI Autonomous',
                        risk: c.originalRisk || (c.id === 'C-1021' || c.id === 'C-1022' ? 'HIGH' : 'SAFE'),
                        riskColor: (c.originalRisk === 'HIGH' || c.id === 'C-1021' || c.id === 'C-1022') ? 'rose' : 'blue'
                    };
                }
                return c;
            });
        });
        const finalId = targetId || callId || 'C-1021';
        setIsSupervisorOnHold(false);
        setTakeoverModalCallId(prev => (prev === callId || prev === finalId) ? null : prev);
        wsService.sendAction('RELEASE_TO_AI', { callId: finalId, session_id: finalId });
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('rescuro_jwt') : null;
            if (token) {
                fetch('/supervisor/release', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ session_id: finalId, notes: 'Supervisor returned call to autonomous AI' })
                }).catch(() => {});
            }
        } catch (_) {}
    }, []);

    const resolveCall = useCallback((callId) => {
        setActiveCalls(prev => prev.filter(c => c.id !== callId));
        setTakeoverModalCallId(prev => prev === callId ? null : prev);
    }, []);

    const resolveAlert = useCallback((alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    const toggleAgentMode = useCallback((agentId = 'agent-core') => {
        setAgents(prev => prev.map(ag => {
            if (ag.id === agentId || ag.id === 'agent-core') {
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
            releaseCallToAi,
            resolveCall,
            resolveAlert,
            toggleAgentMode,
            dispatchAction,
            isSupervisorMicMuted,
            isSpeakerMuted,
            isSupervisorOnHold,
            supervisorVolume,
            takeoverModalCallId,
            openTakeoverModal,
            closeTakeoverModal,
            toggleSupervisorMic,
            toggleSpeakerMute,
            toggleSupervisorHold,
            setSupervisorVolume
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
