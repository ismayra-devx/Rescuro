/**
 * RESCURO WebSocket & Real-Time Event Stream Service
 * Connects to FastAPI backend WebSocket endpoints (/api/v1/stream/calls)
 * Features auto-reconnect, ping/pong heartbeat, and resilient fallback simulator.
 */

class WebSocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.baseReconnectDelay = 2000;
        this.heartbeatTimer = null;
        this.status = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FALLBACK_SIMULATOR'
        this.simulationTimer = null;
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let defaultHost = 'localhost:8000';
        if (typeof window !== 'undefined') {
            if (window.location.port === '3000' || window.location.port === '5173') {
                defaultHost = `${window.location.hostname}:8000`;
            } else {
                defaultHost = window.location.host;
            }
        }
        this.wsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL)
            ? import.meta.env.VITE_WS_URL
            : `${protocol}//${defaultHost}/api/v1/stream/calls`;
    }

    connect(url = this.wsUrl) {
        this.wsUrl = url;
        this.updateStatus('CONNECTING');

        try {
            this.socket = new WebSocket(this.wsUrl);

            this.socket.onopen = () => {
                this.updateStatus('CONNECTED');
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.emit('connection_change', { status: 'CONNECTED', url: this.wsUrl });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'PONG') return;
                    this.emit(data.event || data.type || 'message', data.payload || data);
                } catch (err) {
                    console.warn('[WS] Failed to parse message:', event.data);
                }
            };

            this.socket.onerror = (error) => {
                console.warn('[WS] Connection issue detected. Initiating fallback stream.', error);
            };

            this.socket.onclose = () => {
                this.stopHeartbeat();
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
                    this.updateStatus('CONNECTING');
                    setTimeout(() => this.connect(this.wsUrl), delay);
                } else {
                    // Start resilient fallback simulation for demo & offline testing
                    this.startFallbackSimulation();
                }
            };
        } catch (e) {
            console.warn('[WS] WebSocket initialization failed. Starting simulated stream.', e);
            this.startFallbackSimulation();
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
            }
        }, 15000);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Resilient Fallback Simulator:
     * Continuously emits realistic latency jitters, live transcription tokens,
     * and telemetry updates when external FastAPI server is not currently running.
     */
    startFallbackSimulation() {
        this.updateStatus('FALLBACK_SIMULATOR');
        if (this.simulationTimer) clearInterval(this.simulationTimer);

        let utteranceStep = 0;
        const mockUtterances = [
            { author: 'CALLER (Hinglish)', words: ['Ambulance ', 'ko ', 'bhejiye ', 'jaldi, ', 'Sector ', '18 ', 'mein ', 'bheed ', 'jama ', 'hai!'] },
            { author: 'RESCURO AI ASSISTANT', words: ['Units ', 'dispatched. ', 'Please ', 'keep ', 'the ', 'victim ', 'stable.'] },
            { author: 'CALLER (Hinglish)', words: ['Haan, ', 'hum ', 'pass ', 'hi ', 'hain, ', 'saans ', 'chal ', 'rahi ', 'hai.'] }
        ];

        this.simulationTimer = setInterval(() => {
            // 1. Emit live latency telemetry jitter
            const baseLatencies = [12, 8, 45, 120, 32];
            const jittered = baseLatencies.map(b => Math.max(1, b + Math.floor(Math.random() * 8) - 4));
            this.emit('telemetry_update', {
                pipeline: jittered,
                packetLoss: (0.01 + Math.random() * 0.02).toFixed(2) + '%',
                jitterBuffer: (4.0 + Math.random() * 0.5).toFixed(1) + 'ms',
                timestamp: Date.now()
            });

            // 2. Periodically stream real-time word token deltas
            if (Math.random() > 0.6) {
                const item = mockUtterances[utteranceStep % mockUtterances.length];
                this.emit('transcription_delta', {
                    callId: 'C-1021',
                    author: item.author,
                    isAi: item.author.includes('RESCURO'),
                    text: item.words.join(''),
                    timestamp: new Date().toLocaleTimeString()
                });
                utteranceStep++;
            }
        }, 2200);
    }

    sendAction(actionType, payload = {}) {
        const message = {
            type: actionType,
            payload: {
                ...payload,
                clientTimestamp: Date.now(),
                source: 'RESCURO_SUPERVISOR_CONSOLE'
            }
        };

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            // Echo locally in fallback mode
            console.log(`[WS Simulated Action] ${actionType}:`, message);
            this.emit('action_confirmed', { type: actionType, success: true, payload });
        }

        // Supervisor takeover → also call backend REST API directly
        if (actionType === 'SUPERVISOR_TAKEOVER') {
            const body = JSON.stringify({
                session_id: payload.callId || 'C-1021',
                reason: payload.notes || 'Supervisor manual audio line intervention via Rescuro Console'
            });
            fetch('/supervisor/override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            }).catch(() => {
                const restHost = typeof window !== 'undefined' ? `${window.location.hostname}:8000` : 'localhost:8000';
                const restProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
                fetch(`${restProtocol}//${restHost}/supervisor/override`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body
                }).catch(err => console.warn('[Takeover API error]', err));
            });
        }
    }

    updateStatus(newStatus) {
        this.status = newStatus;
        this.emit('status_change', { status: newStatus });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`[WS] Error in listener for ${event}:`, err);
                }
            });
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.simulationTimer) clearInterval(this.simulationTimer);
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.updateStatus('DISCONNECTED');
    }
}

export const wsService = new WebSocketService();
export default wsService;
