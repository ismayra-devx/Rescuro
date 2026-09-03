import React, { createContext, useContext, useState, useEffect } from 'react';
import wsService from '../services/websocket';
import supabaseService from '../services/supabase';

const LiveStreamContext = createContext(null);

export const LiveStreamProvider = ({ children }) => {
    const [streamStatus, setStreamStatus] = useState('CONNECTING');
    const [latencies, setLatencies] = useState([12, 8, 45, 120, 32]);
    const [packetLoss, setPacketLoss] = useState('0.01%');
    const [jitterBuffer, setJitterBuffer] = useState('4.2ms');
    const [chatMessages, setChatMessages] = useState([
        { id: 1, author: '👤 CALLER (Hinglish)', text: 'Accident ho gaya hai, Sector 18 Noida mein metro station ke paas!', isAi: false },
        { id: 2, author: '🤖 RESCURO AI ASSISTANT', text: 'Please stay calm. Emergency services are being notified. Can you confirm if anyone is injured?', isAi: true },
        { id: 3, author: '👤 CALLER (Hinglish)', text: 'Ek aadmi ko bahut chot lagi hai, khoon beh raha hai... Jaldi kijiye!', isAi: false }
    ]);

    useEffect(() => {
        // Connect to live WebSocket stream
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

    // Action dispatcher
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
            chatMessages,
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
