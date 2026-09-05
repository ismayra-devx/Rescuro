/**
 * RESCURO WebSocket & Real-Time Event Stream Service
 * Connects to FastAPI backend WebSocket endpoints (/ws/dashboard or /api/v1/stream/calls)
 * Features auto-reconnect and ping/pong heartbeat.
 * Real data only — all mock fallback simulators have been removed.
 */

class WebSocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.baseReconnectDelay = 2000;
        this.heartbeatTimer = null;
        this.status = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let defaultHost = 'localhost:8000';
        if (typeof window !== 'undefined') {
            if (window.location.port === '3000' || window.location.port === '5173') {
                defaultHost = `${window.location.hostname}:8000`;
            } else {
                defaultHost = window.location.host;
            }
        }
        const token = typeof window !== 'undefined' ? (localStorage.getItem('rescuro_jwt') || '') : '';
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        this.wsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL)
            ? import.meta.env.VITE_WS_URL
            : (token ? `${protocol}//${defaultHost}/ws/dashboard${tokenParam}` : `${protocol}//${defaultHost}/api/v1/stream/calls`);
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
                console.warn('[WS] Connection issue detected:', error);
                this.updateStatus('ERROR');
                this.emit('connection_error', { message: 'WebSocket connection issue detected.' });
            };

            this.socket.onclose = () => {
                this.stopHeartbeat();
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
                    this.updateStatus('CONNECTING');
                    setTimeout(() => this.connect(this.wsUrl), delay);
                } else {
                    this.updateStatus('DISCONNECTED');
                    this.emit('connection_change', { status: 'DISCONNECTED', message: 'Backend unreachable. Reconnect attempts exhausted.' });
                }
            };
        } catch (e) {
            console.error('[WS] WebSocket initialization failed:', e);
            this.updateStatus('ERROR');
            this.emit('connection_error', { message: 'Failed to initialize WebSocket connection.' });
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

    updateStatus(newStatus) {
        this.status = newStatus;
        this.emit('status_change', { status: newStatus });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const filtered = this.listeners.get(event).filter(cb => cb !== callback);
        this.listeners.set(event, filtered);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => {
                try { cb(data); } catch (e) { console.error('[WS] Error in listener for event:', event, e); }
            });
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.updateStatus('DISCONNECTED');
    }
}

export const wsService = new WebSocketService();
export default wsService;
