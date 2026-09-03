-- EchoSphere - Minimum Database Schema (Supabase / PostgreSQL)
-- Tables: sessions, transcripts, triage_events, events, recordings, tickets
-- Every child record strictly references session_id on delete cascade.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SESSIONS TABLE: Core call and triage session lifecycle
CREATE TABLE IF NOT EXISTS public.sessions (
    session_id TEXT PRIMARY KEY,
    call_sid TEXT,
    from_number TEXT,
    to_number TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, SUPERVISOR_CONNECTED
    tts_halted BOOLEAN NOT NULL DEFAULT FALSE,
    supervisor_takeover_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TRANSCRIPTS TABLE: Final transcripts with STT confidence scores
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    stt_confidence NUMERIC(4, 3) NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TRIAGE_EVENTS TABLE: Deterministic & LLM triage scores, routing, escalation reasons
CREATE TABLE IF NOT EXISTS public.triage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    route TEXT NOT NULL, -- automated | human_supervisor
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL | HIGH | CRITICAL
    combined_confidence NUMERIC(4, 3) NOT NULL,
    stt_confidence NUMERIC(4, 3) NOT NULL,
    llm_confidence NUMERIC(4, 3) NOT NULL,
    reason TEXT NOT NULL, -- escalation reason or rationale
    matched_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EVENTS TABLE: Critical Event Contract audit log
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RECORDINGS TABLE: Call audio recording storage paths
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    recording_path TEXT NOT NULL, -- GCS, S3, or Supabase Storage bucket path
    duration_seconds NUMERIC(8, 2),
    channels INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TICKETS TABLE: Trouble tickets with extracted slot details
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    caller_name TEXT,
    location TEXT,
    issue TEXT,
    confidence NUMERIC(4, 3) DEFAULT 1.000,
    status TEXT NOT NULL DEFAULT 'open', -- open, escalated, resolved
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-efficiency querying by session_id
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON public.transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_triage_events_session_id ON public.triage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON public.events(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON public.recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_session_id ON public.tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- Row-Level Security (RLS) configuration
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (backend server-side operations only)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'service_role_all_sessions'
    ) THEN
        CREATE POLICY service_role_all_sessions ON public.sessions TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transcripts' AND policyname = 'service_role_all_transcripts'
    ) THEN
        CREATE POLICY service_role_all_transcripts ON public.transcripts TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'triage_events' AND policyname = 'service_role_all_triage'
    ) THEN
        CREATE POLICY service_role_all_triage ON public.triage_events TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'service_role_all_events'
    ) THEN
        CREATE POLICY service_role_all_events ON public.events TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recordings' AND policyname = 'service_role_all_recordings'
    ) THEN
        CREATE POLICY service_role_all_recordings ON public.recordings TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'service_role_all_tickets'
    ) THEN
        CREATE POLICY service_role_all_tickets ON public.tickets TO service_role USING (true) WITH CHECK (true);
    END IF;
END
$$;
