import logging
from typing import Any, Dict, List, Optional
from config import settings

logger = logging.getLogger("echosphere.supabase")

class SupabaseServiceError(Exception):
    """Custom exception raised when Supabase database operations fail."""
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.original_error = original_error

# Singleton client reference
_supabase_client = None

def get_supabase_client():
    """
    Initializes and returns the shared Supabase client using the service_role key.
    Ensures safe initialization and clear error reporting.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL.strip()
    key = settings.SUPABASE_SERVICE_ROLE_KEY.strip()

    if not url or not key or "your_" in key.lower() or url.startswith("https://your-project"):
        logger.warning("Supabase credentials not configured or set to placeholder. Operations will fail gracefully.")
        return None

    try:
        from supabase import create_client, ClientOptions
        _supabase_client = create_client(
            url,
            key,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10
            )
        )
        logger.info("Supabase client initialized successfully with service_role key.")
        return _supabase_client
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        raise SupabaseServiceError(f"Supabase client initialization failed: {exc}", exc)


def create_call_session(
    call_sid: str,
    from_number: str,
    to_number: str,
    channel_name: str,
    initial_slots: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Inserts a new call session record into call_sessions table.
    
    Args:
        call_sid: Unique Twilio Call SID
        from_number: Inbound caller phone number
        to_number: Dialed helpline phone number
        channel_name: Dedicated Agora RTC channel name
        initial_slots: Optional dictionary of starting slot values
        
    Returns:
        The inserted call_session record as a dictionary.
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot create call session: Supabase is not configured.")

    payload = {
        "call_sid": call_sid,
        "caller_phone": from_number,
        "to_number": to_number,
        "status": "in-progress",
        "channel_name": channel_name,
        "slots": initial_slots or {},
        "escalated": False,
        "confidence": 1.0,
    }

    try:
        response = client.table("call_sessions").insert(payload).execute()
        if response.data:
            session_data = response.data[0]
            logger.info("Created call session %s for CallSid %s", session_data.get("id"), call_sid)
            return session_data
        raise SupabaseServiceError("No data returned while creating call session")
    except Exception as exc:
        logger.error("Error creating call session for CallSid %s: %s", call_sid, exc)
        raise SupabaseServiceError(f"Failed to create call session: {exc}", exc)


def update_call_slots(session_id: str, slots: Dict[str, Any], confidence: Optional[float] = None) -> Dict[str, Any]:
    """
    Updates the extracted slot state and overall confidence for a call session.
    
    Args:
        session_id: Call session UUID
        slots: Dictionary containing updated slots
        confidence: Optional updated confidence score (0.0 to 1.0)
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot update call slots: Supabase is not configured.")

    update_payload: Dict[str, Any] = {"slots": slots}
    if confidence is not None:
        update_payload["confidence"] = round(confidence, 3)

    try:
        response = client.table("call_sessions").update(update_payload).eq("id", session_id).execute()
        if response.data:
            logger.debug("Updated slots for session %s: %s", session_id, slots)
            return response.data[0]
        raise SupabaseServiceError(f"Session {session_id} not found for slot update")
    except Exception as exc:
        logger.error("Error updating slots for session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to update slots: {exc}", exc)


def append_transcript_line(
    session_id: str,
    speaker: str,
    text: str,
    language: str = "hi-en",
    confidence: float = 1.0
) -> Dict[str, Any]:
    """
    Appends a new transcript turn to the transcripts table.
    
    Args:
        session_id: Call session UUID
        speaker: 'caller', 'agent', 'supervisor', or 'system'
        text: Transcribed or spoken text
        language: Detected language ('hi', 'en', 'hi-en', etc.)
        confidence: Deepgram or STT turn confidence
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot append transcript: Supabase is not configured.")

    payload = {
        "session_id": session_id,
        "speaker": speaker,
        "text": text,
        "language": language,
        "confidence": round(confidence, 3),
    }

    try:
        response = client.table("transcripts").insert(payload).execute()
        if response.data:
            return response.data[0]
        raise SupabaseServiceError("Failed to insert transcript row, no data returned")
    except Exception as exc:
        logger.error("Error appending transcript for session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to append transcript: {exc}", exc)


def create_ticket(
    session_id: str,
    ticket_id: str,
    summary: str,
    caller_name: Optional[str] = None,
    location: Optional[str] = None,
    issue: Optional[str] = None,
    confidence: float = 1.0,
    status: str = "open"
) -> Dict[str, Any]:
    """
    Persists an optimistically generated trouble ticket into tickets table.
    
    Args:
        session_id: Call session UUID
        ticket_id: Human/system readable ticket ID (e.g. TKT-xxxxxx)
        summary: Brief summary of caller request
        caller_name: Caller name if extracted
        location: Caller location if extracted
        issue: Specific issue details
        confidence: Confidence score at time of ticket creation
        status: Ticket status ('open', 'escalated', etc.)
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot create ticket: Supabase is not configured.")

    payload = {
        "id": ticket_id,
        "session_id": session_id,
        "summary": summary,
        "caller_name": caller_name,
        "location": location,
        "issue": issue,
        "confidence": round(confidence, 3),
        "status": status,
    }

    try:
        response = client.table("tickets").upsert(payload).execute()
        if response.data:
            logger.info("Created/upserted ticket %s for session %s", ticket_id, session_id)
            return response.data[0]
        raise SupabaseServiceError(f"Failed to persist ticket {ticket_id}")
    except Exception as exc:
        logger.error("Error creating ticket %s for session %s: %s", ticket_id, session_id, exc)
        raise SupabaseServiceError(f"Failed to create ticket: {exc}", exc)


def mark_session_escalated(session_id: str, reason: str) -> Dict[str, Any]:
    """
    Marks a session as escalated in the database with the given reason.
    
    Args:
        session_id: Call session UUID
        reason: Justification (e.g., 'low_confidence', 'emergency_keyword', 'manual')
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot escalate session: Supabase is not configured.")

    payload = {
        "escalated": True,
        "escalation_reason": reason,
        "status": "escalated"
    }

    try:
        response = client.table("call_sessions").update(payload).eq("id", session_id).execute()
        if response.data:
            logger.warning("Session %s marked as ESCALATED. Reason: %s", session_id, reason)
            return response.data[0]
        raise SupabaseServiceError(f"Session {session_id} not found to mark escalated")
    except Exception as exc:
        logger.error("Error escalating session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to mark session escalated: {exc}", exc)


def update_session_status(session_id: str, status: str, agent_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Updates the overall status of a call session (e.g., in-progress, completed, failed).
    """
    client = get_supabase_client()
    if not client:
        raise SupabaseServiceError("Cannot update session status: Supabase is not configured.")

    payload: Dict[str, Any] = {"status": status}
    if agent_id:
        payload["agent_id"] = agent_id

    try:
        response = client.table("call_sessions").update(payload).eq("id", session_id).execute()
        if response.data:
            return response.data[0]
        raise SupabaseServiceError(f"Session {session_id} not found to update status")
    except Exception as exc:
        logger.error("Error updating status for session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to update session status: {exc}", exc)


def get_call_session_by_sid(call_sid: str) -> Optional[Dict[str, Any]]:
    """Fetches a call session record by Twilio CallSid."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        response = client.table("call_sessions").select("*").eq("call_sid", call_sid).execute()
        return response.data[0] if response.data else None
    except Exception as exc:
        logger.error("Error fetching session by CallSid %s: %s", call_sid, exc)
        raise SupabaseServiceError(f"Failed to fetch session by CallSid: {exc}", exc)


def get_call_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a call session record by primary UUID."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        response = client.table("call_sessions").select("*").eq("id", session_id).execute()
        return response.data[0] if response.data else None
    except Exception as exc:
        logger.error("Error fetching session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to fetch session: {exc}", exc)


def get_transcript_history(session_id: str) -> List[Dict[str, Any]]:
    """Retrieves all chronological transcripts for a call session."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        response = client.table("transcripts").select("*").eq("session_id", session_id).order("created_at").execute()
        return response.data or []
    except Exception as exc:
        logger.error("Error fetching transcripts for session %s: %s", session_id, exc)
        raise SupabaseServiceError(f"Failed to fetch transcript history: {exc}", exc)
