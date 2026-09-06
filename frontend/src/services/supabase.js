/**
 * RESCURO Supabase State Synchronization Service
 * Manages incident records, audit logs, and real-time subscription synchronization.
 */

class SupabaseService {
    constructor() {
        this.supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) 
            || 'https://api.supabase.rescuro.internal';
        this.supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) 
            || 'sb-anon-demo-token';
        this.auditLogs = [];
        this.subscribers = new Set();
    }

    /**
     * Records supervisor actions (Takeover, Dispatch, Mute, Whisper) to the audit log.
     */
    async logSupervisorAction({ action, callId, supervisorId, notes }) {
        const logEntry = {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            call_id: callId,
            supervisor_id: supervisorId,
            action_type: action,
            notes: notes || 'Direct supervisor intervention via Command Center',
            status: 'COMMITTED'
        };

        this.auditLogs.unshift(logEntry);
        this.notifySubscribers('audit_created', logEntry);

        // Simulated HTTP POST to Supabase REST /rest/v1/supervisor_audit_logs
        console.log('[Supabase Sync] Audit Log Persisted:', logEntry);
        return { data: logEntry, error: null };
    }

    /**
     * Subscribes to real-time table events
     */
    subscribeToAudits(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(event, data) {
        this.subscribers.forEach(cb => {
            try {
                cb({ event, payload: data });
            } catch (err) {
                console.error('[Supabase] Subscription error:', err);
            }
        });
    }

    getAuditHistory() {
        return [...this.auditLogs];
    }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
