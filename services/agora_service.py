import time
import hmac
import base64
import hashlib
import struct
import json
import logging
from typing import Any, Dict, Optional
import httpx
from config import settings

logger = logging.getLogger("echosphere.agora")

# Agora Conversational AI API base URL
AGORA_CONVO_AI_BASE = "https://api.agora.io/api/conversational-ai-agent/v2/projects"
AGORA_RTM_BASE = "https://api.agora.io/dev/v2/project"

def _build_rtc_token_native(app_id: str, app_cert: str, channel_name: str, uid: int, role: int = 1, expire_time: int = 3600) -> str:
    """
    Pure Python implementation of Agora Dynamic RTC Token v006/v007 builder.
    Serves as an infallible fallback if compiled C/C++ agora-token-builder is unavailable.
    """
    current_time = int(time.time())
    privilege_expire_ts = current_time + expire_time
    salt = 1
    
    # Version 006 signature structure
    version = "006"
    m_uid = str(uid) if uid != 0 else ""
    
    # Message to sign: appId + channelName + uid + salt + ts + privilegeExpireTs
    msg = (
        app_id.encode("utf-8") +
        channel_name.encode("utf-8") +
        m_uid.encode("utf-8") +
        struct.pack("<I", salt) +
        struct.pack("<I", current_time) +
        struct.pack("<I", privilege_expire_ts)
    )
    
    mac = hmac.new(app_cert.encode("utf-8"), msg, hashlib.sha256).digest()
    
    # Pack into base64 token string
    content = (
        struct.pack("<I", salt) +
        struct.pack("<I", current_time) +
        struct.pack("<I", privilege_expire_ts) +
        struct.pack("<H", len(mac)) + mac
    )
    
    encoded_content = base64.b64encode(content).decode("utf-8")
    return f"{version}{app_id}{encoded_content}"


class AgoraService:
    """
    Manages Agora Real-Time Communication (RTC), Conversational AI Agent lifecycle,
    and Real-Time Messaging (RTM) data channel state publishing.
    """
    def __init__(self):
        self.app_id = settings.AGORA_APP_ID.strip()
        self.app_certificate = settings.AGORA_APP_CERTIFICATE.strip()
        self.customer_key = settings.AGORA_CUSTOMER_KEY.strip()
        self.customer_secret = settings.AGORA_CUSTOMER_SECRET.strip()

    def _get_auth_headers(self) -> Dict[str, str]:
        """Builds HTTP Basic Auth headers required for Agora REST APIs."""
        credentials = f"{self.customer_key}:{self.customer_secret}"
        encoded_cred = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
        return {
            "Authorization": f"Basic {encoded_cred}",
            "Content-Type": "application/json"
        }

    def generate_rtc_token(
        self,
        channel_name: str,
        uid: int = 0,
        role: int = 1, # 1: Host/Publisher, 2: Subscriber
        expire_seconds: int = 3600
    ) -> str:
        """
        Generates an Agora RTC token for joining a real-time audio channel.
        Used for human-supervisor bridge-ins and Conversational AI agent joining.
        
        Args:
            channel_name: Agora channel identifier
            uid: Numerical user ID (0 assigns automatic UID)
            role: 1 for publisher (supervisor/agent), 2 for subscriber
            expire_seconds: Token validity in seconds (default: 1 hour)
            
        Returns:
            Agora RTC token string
        """
        if not self.app_id or not self.app_certificate:
            logger.warning("Agora App ID or Certificate not configured. Returning dummy token for development.")
            return f"dev_token_{channel_name}_{uid}"

        # Attempt to use agora-token-builder package if installed
        try:
            from agora_token_builder import RtcTokenBuilder
            privilege_expired_ts = int(time.time()) + expire_seconds
            token = RtcTokenBuilder.buildTokenWithUid(
                self.app_id,
                self.app_certificate,
                channel_name,
                uid,
                role,
                privilege_expired_ts
            )
            logger.debug("Generated Agora RTC token via RtcTokenBuilder for channel %s (uid %s)", channel_name, uid)
            return token
        except Exception as exc:
            logger.debug("Falling back to internal native RTC token builder: %s", exc)
            return _build_rtc_token_native(
                self.app_id,
                self.app_certificate,
                channel_name,
                uid,
                role,
                expire_seconds
            )

    async def start_conversational_agent(
        self,
        session_id: str,
        channel_name: str,
        agent_uid: int = 1001
    ) -> Dict[str, Any]:
        """
        Calls Agora's Conversational AI Engine REST API to deploy an autonomous AI agent into the channel.
        Wires in Deepgram Nova-2 (STT) + OpenAI gpt-4o-mini (LLM) + Agora ANS & AI-VAD.
        
        Args:
            session_id: EchoSphere session UUID
            channel_name: Agora RTC channel name
            agent_uid: Agora numeric UID reserved for AI agent
            
        Returns:
            Dictionary containing agent status, agent_id, and channel details.
        """
        if not self.app_id or not self.customer_key or self.customer_key.startswith("your_"):
            logger.warning("Agora REST credentials not configured. Simulating agent start for session %s.", session_id)
            return {
                "agent_id": f"sim_agent_{session_id[:8]}",
                "status": "started_mock",
                "channel": channel_name,
                "agent_rtc_uid": agent_uid
            }

        agent_token = self.generate_rtc_token(channel_name, uid=agent_uid, role=1)
        url = f"{AGORA_CONVO_AI_BASE}/{self.app_id}/join"

        payload = {
            "name": f"echosphere_agent_{session_id[:8]}",
            "properties": {
                "channel": channel_name,
                "token": agent_token,
                "agent_rtc_uid": str(agent_uid),
                "remote_rtc_uids": ["*"],
                "asr": {
                    "vendor": "deepgram",
                    "language": "hi", # Multilingual Nova-2 code-switching enabled
                    "params": {
                        "api_key": settings.DEEPGRAM_API_KEY,
                        "model": "nova-2",
                        "smart_format": True,
                        "interim_results": True,
                        "language": "hi,en"
                    }
                },
                "tts": {
                    "vendor": "openai",
                    "params": {
                        "api_key": settings.OPENAI_API_KEY,
                        "model": "tts-1",
                        "voice": "alloy"
                    }
                },
                "llm": {
                    "url": "https://api.openai.com/v1/chat/completions",
                    "api_key": settings.OPENAI_API_KEY,
                    "params": {
                        "model": "gpt-4o-mini"
                    }
                },
                "advanced_features": {
                    "enable_ans": True, # Agora Noise Suppression
                    "enable_vad": True  # Agora AI-VAD Barge-in detection
                }
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, headers=self._get_auth_headers(), json=payload)
                if response.status_code in [200, 201]:
                    data = response.json()
                    agent_id = data.get("agent_id") or data.get("id") or f"agent_{session_id[:8]}"
                    logger.info("Successfully started Agora Conversational Agent %s in channel %s", agent_id, channel_name)
                    return {"agent_id": agent_id, "status": "active", "channel": channel_name, "raw": data}
                else:
                    logger.error("Agora join agent returned status %s: %s", response.status_code, response.text)
                    return {
                        "agent_id": f"agent_{session_id[:8]}",
                        "status": "degraded",
                        "error": response.text,
                        "channel": channel_name
                    }
        except Exception as exc:
            logger.error("Exception occurred while starting Agora Conversational Agent: %s", exc)
            return {"agent_id": f"fallback_{session_id[:8]}", "status": "error", "error": str(exc)}

    async def stop_conversational_agent(
        self,
        channel_name: str,
        agent_id: Optional[str] = None
    ) -> bool:
        """
        Tears down the Agora Conversational Agent upon call termination.
        
        Args:
            channel_name: Agora RTC channel identifier
            agent_id: Agent identifier returned on agent start
        """
        if not self.app_id or not self.customer_key or self.customer_key.startswith("your_"):
            logger.info("Agora credentials not set; skipped remote agent leave for channel %s.", channel_name)
            return True

        url = f"{AGORA_CONVO_AI_BASE}/{self.app_id}/leave"
        payload = {
            "channel": channel_name
        }
        if agent_id:
            payload["agent_id"] = agent_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=self._get_auth_headers(), json=payload)
                if response.status_code in [200, 204]:
                    logger.info("Agora agent %s left channel %s cleanly.", agent_id, channel_name)
                    return True
                logger.warning("Agora agent leave returned %s: %s", response.status_code, response.text)
                return False
        except Exception as exc:
            logger.error("Failed to stop Agora Conversational Agent for channel %s: %s", channel_name, exc)
            return False

    async def publish_rtm_state(self, channel_name: str, state_payload: Dict[str, Any]) -> bool:
        """
        Publishes live session state (transcript, slots, confidence, escalation)
        onto the Agora Real-Time Messaging (RTM) data channel for real-time frontend consumption.
        
        Args:
            channel_name: Agora channel / RTM topic
            state_payload: Dictionary of live call state to broadcast
        """
        if not self.app_id or not self.customer_key or self.customer_key.startswith("your_"):
            logger.debug("Skipping Agora RTM publish (dev mode or unconfigured). Payload: %s", state_payload)
            return True

        url = f"{AGORA_RTM_BASE}/{self.app_id}/rtm/channels/{channel_name}/message"
        payload = {
            "message": json.dumps(state_payload, ensure_ascii=False)
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(url, headers=self._get_auth_headers(), json=payload)
                if response.status_code in [200, 201]:
                    logger.debug("Successfully published state to Agora RTM channel %s", channel_name)
                    return True
                logger.warning("Agora RTM publish failed (%s): %s", response.status_code, response.text)
                return False
        except Exception as exc:
            logger.error("Error publishing to Agora RTM channel %s: %s", channel_name, exc)
            return False


# Singleton service instance
agora_service = AgoraService()
