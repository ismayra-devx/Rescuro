import { getApiBaseUrl } from './api';

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
        this.wsUrl = this.getWsUrl();
    }

    getWsUrl() {
        const token = typeof window !== 'undefined' ? (localStorage.getItem('rescuro_jwt') || '') : '';
        const tokenParam = token ? `token=${encodeURIComponent(token)}` : '';

        // 1. Explicit VITE_WS_URL environment variable
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
            let rawWs = import.meta.env.VITE_WS_URL.trim();
            if (rawWs.endsWith('.onrender.co')) {
                rawWs += 'm';
            }
            if (!token) return rawWs;
            const sep = rawWs.includes('?') ? '&' : '?';
            return rawWs.includes('token=') ? rawWs : `${rawWs}${sep}${tokenParam}`;
        }

        // 2. Derived from single source of truth getApiBaseUrl()
        const apiUrl = getApiBaseUrl();
        if (apiUrl) {
            const wsBase = apiUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
            return token ? `${wsBase}/ws/dashboard?${tokenParam}` : `${wsBase}/api/v1/stream/calls`;
        }

        // 3. Dynamic browser window host resolution (localhost or production domain)
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let defaultHost = 'localhost:8000';
        if (typeof window !== 'undefined') {
            if (window.location.port === '3000' || window.location.port === '5173' || window.location.port === '5174') {
                defaultHost = `${window.location.hostname}:8000`;
            } else {
                defaultHost = window.location.host;
            }
        }

        return token
            ? `${protocol}//${defaultHost}/ws/dashboard?${tokenParam}`
            : `${protocol}//${defaultHost}/api/v1/stream/calls`;
    }

    connect(url = null) {
        this.wsUrl = url || this.getWsUrl();
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
                    setTimeout(() => this.connect(this.getWsUrl()), delay);
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

    sendAction(action, payload = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: action, action, payload, timestamp: Date.now() }));
        } else {
            console.warn('[WS] Cannot send action, socket is not open:', action);
        }
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const payload = typeof data === 'string' ? data : JSON.stringify(data);
            this.socket.send(payload);
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
