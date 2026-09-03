import logging
from typing import Any, Dict, Optional
try:
    from twilio.rest import Client
    from twilio.twiml.voice_response import VoiceResponse, Connect, Stream, Say, Parameter
    from twilio.request_validator import RequestValidator
except ImportError:
    Client = None
    VoiceResponse = None
    Connect = None
    Stream = None
    Say = None
    Parameter = None
    RequestValidator = None

from config import settings

logger = logging.getLogger("echosphere.twilio")

class TwilioService:
    """
    Manages Twilio telephony interactions, TwiML generation for Agora bridge streaming,
    and webhook cryptographic signature validation.
    """
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID.strip()
        self.auth_token = settings.TWILIO_AUTH_TOKEN.strip()
        self.phone_number = settings.TWILIO_PHONE_NUMBER.strip()
        
        self.client: Optional[Any] = None
        if Client and self.account_sid and self.auth_token and not self.account_sid.startswith("your_"):
            try:
                self.client = Client(self.account_sid, self.auth_token)
                logger.info("Twilio client initialized for account %s", self.account_sid[:6] + "...")
            except Exception as exc:
                logger.error("Failed to initialize Twilio REST client: %s", exc)
        else:
            logger.warning("Twilio credentials not configured or SDK not installed; REST calls will be skipped.")

    def generate_twiml_bridge(
        self,
        stream_url: str,
        session_id: str,
        channel_name: str,
        welcome_greeting: Optional[str] = "नमस्ते, इकोस्फेयर हेल्पलाइन में आपका स्वागत है। How can we help you today?"
    ) -> str:
        """
        Generates TwiML instructions that connect incoming telephone audio to an Agora/WebSocket
        bidirectional media stream for real-time speech processing and ANS/AI-VAD filtering.
        
        Args:
            stream_url: Target WebSocket stream URL (e.g. wss://api.yourdomain.com/voice/stream)
            session_id: EchoSphere call session UUID
            channel_name: Dedicated Agora RTC channel name
            welcome_greeting: Optional introductory speech prompt
            
        Returns:
            Valid XML TwiML string
        """
        if VoiceResponse:
            response = VoiceResponse()
            if welcome_greeting:
                response.say(welcome_greeting, voice="Polly.Aditi", language="hi-IN")
            connect = Connect()
            stream = Stream(url=stream_url)
            stream.parameter(name="session_id", value=session_id)
            stream.parameter(name="channel_name", value=channel_name)
            connect.append(stream)
            response.append(connect)
            twiml_str = str(response)
        else:
            # Pure XML generation fallback when twilio SDK is not yet installed
            say_tag = f'  <Say language="hi-IN" voice="Polly.Aditi">{welcome_greeting}</Say>\n' if welcome_greeting else ""
            twiml_str = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<Response>\n'
                f'{say_tag}'
                '  <Connect>\n'
                f'    <Stream url="{stream_url}">\n'
                f'      <Parameter name="session_id" value="{session_id}" />\n'
                f'      <Parameter name="channel_name" value="{channel_name}" />\n'
                '    </Stream>\n'
                '  </Connect>\n'
                '</Response>'
            )

        logger.debug("Generated TwiML for session %s (channel %s)", session_id, channel_name)
        return twiml_str


    def validate_webhook_signature(
        self,
        url: str,
        post_data: Dict[str, Any],
        signature: Optional[str]
    ) -> bool:
        """
        Cryptographically validates incoming Twilio webhook HTTP requests using HMAC-SHA1.
        
        Args:
            url: Exact incoming request URL with protocol and query params
            post_data: Dictionary of form parameters received in POST body
            signature: X-Twilio-Signature header value
            
        Returns:
            True if signature matches; False otherwise.
        """
        if not signature:
            logger.warning("Missing X-Twilio-Signature header on request to %s", url)
            return False

        if not self.auth_token or self.auth_token.startswith("your_"):
            logger.warning("Twilio auth token not set; skipping signature validation in dev mode.")
            return True

        if RequestValidator:
            try:
                validator = RequestValidator(self.auth_token)
                clean_params = {k: str(v) for k, v in post_data.items()}
                is_valid = validator.validate(url, clean_params, signature)
                if not is_valid:
                    logger.warning("Invalid Twilio signature verification for URL: %s", url)
                return is_valid
            except Exception as exc:
                logger.error("Error during Twilio signature verification: %s", exc)
                return False
        else:
            # Pure Python HMAC-SHA1 fallback
            import hmac
            import hashlib
            import base64
            data_to_sign = url + "".join(f"{k}{post_data[k]}" for k in sorted(post_data.keys()))
            computed = base64.b64encode(hmac.new(self.auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()).decode("utf-8")
            return hmac.compare_digest(computed, signature)

    def bridge_human_agent_to_call(self, call_sid: str, supervisor_phone_number: str) -> bool:
        """
        Redirects an active Twilio call leg to dial a human supervisor's phone directly.
        """
        if not self.client:
            logger.error("Twilio client not initialized; cannot redirect call %s", call_sid)
            return False

        try:
            if VoiceResponse:
                twiml_redirect = VoiceResponse()
                twiml_redirect.say("Connecting you to a human supervisor now. कृपया लाइन पर बने रहें।", voice="Polly.Aditi", language="hi-IN")
                twiml_redirect.dial(supervisor_phone_number)
                twiml_str = str(twiml_redirect)
            else:
                twiml_str = (
                    '<Response>'
                    '<Say language="hi-IN" voice="Polly.Aditi">Connecting you to a human supervisor now. कृपया लाइन पर बने रहें।</Say>'
                    f'<Dial>{supervisor_phone_number}</Dial>'
                    '</Response>'
                )
            
            self.client.calls(call_sid).update(twiml=twiml_str)
            logger.info("Call %s redirected to supervisor %s", call_sid, supervisor_phone_number)
            return True
        except Exception as exc:
            logger.error("Failed to redirect Twilio call %s to supervisor: %s", call_sid, exc)
            return False


# Shared singleton instance
twilio_service = TwilioService()
