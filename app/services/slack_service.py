import logging
from typing import Any, Dict, List
import httpx
try:
    from app.config import settings
except ImportError:
    from config import settings

logger = logging.getLogger("echosphere.slack")

class SlackService:
    """
    Delivers rich Slack Block Kit notifications to supervisor channels
    when calls are escalated due to low confidence, distress keywords, or manual triggers.
    """
    def __init__(self):
        self.webhook_url = (settings.SLACK_WEBHOOK_URL or "").strip()

    def _build_block_kit_payload(self, context_packet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Constructs a structured Slack Block Kit message payload with formatted fields,
        distress badges, confirmed/missing slots, and Agora audio bridge coordinates.
        """
        session_id = context_packet.get("session_id", "N/A")
        ticket_id = context_packet.get("ticket_id", "N/A")
        caller_name = context_packet.get("caller_name") or "Unknown / Not Disclosed"
        caller_phone = context_packet.get("caller_phone") or "Anonymous"
        location = context_packet.get("location") or "Unspecified"
        language = context_packet.get("language") or "Hinglish"
        issue = context_packet.get("issue") or "No issue description extracted yet."
        escalation_reason = context_packet.get("escalation_reason") or "Manual or automated escalation triggered"
        confidence = float(context_packet.get("combined_confidence", 0.0))
        threshold = float(context_packet.get("confidence_threshold", settings.CONFIDENCE_ESCALATION_THRESHOLD))
        safety_flag = bool(context_packet.get("safety_flag", False))
        channel_name = context_packet.get("channel_name", f"echosphere_{session_id[:8]}")
        confirmed_slots = context_packet.get("confirmed_slots", {})
        missing_slots: List[str] = context_packet.get("missing_slots", [])

        status_indicator = "🚨 *EMERGENCY / SAFETY OVERRIDE*" if safety_flag else "⚠️ *LOW CONFIDENCE ESCALATION*"
        confidence_color = "🔴" if confidence < threshold else "🟢"

        confirmed_str = ", ".join(f"`{k}`: {v}" for k, v in confirmed_slots.items() if v) or "_None yet_"
        missing_str = ", ".join(f"`{s}`" for s in missing_slots) if missing_slots else "_None (Complete)_"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 EchoSphere Helpline: Call Escalated to Human Supervisor",
                    "emoji": True
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:* {status_indicator}  |  *Ticket ID:* `{ticket_id}`  |  *Session:* `{session_id}`"
                    }
                ]
            },
            {"type": "divider"},
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*👤 Caller:* {caller_name}"},
                    {"type": "mrkdwn", "text": f"*📞 Phone:* {caller_phone}"},
                    {"type": "mrkdwn", "text": f"*📍 Location:* {location}"},
                    {"type": "mrkdwn", "text": f"*🗣️ Language:* {language}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*📝 Issue / Reported Grievance:*\n>{issue}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*🎯 Confidence:* {confidence_color} `{confidence:.2f}` (Threshold: `{threshold:.2f}`)"},
                    {"type": "mrkdwn", "text": f"*🚨 Safety Flag:* {'`TRUE`' if safety_flag else '`FALSE`'}"},
                    {"type": "mrkdwn", "text": f"*✅ Confirmed Slots:*\n{confirmed_str}"},
                    {"type": "mrkdwn", "text": f"*❓ Missing Slots:*\n{missing_str}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*⚠️ Reason for Escalation:*\n`{escalation_reason}`"
                }
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🎙️ Agora Real-Time Supervisor Bridge:*\nJoin RTC channel: `{channel_name}` to take over live audio."
                }
            }
        ]

        return {"blocks": blocks, "text": f"EchoSphere Alert: Call escalated for Ticket {ticket_id}"}

    async def send_escalation_alert(self, context_packet: Dict[str, Any]) -> bool:
        """
        Sends an asynchronous HTTP POST request with formatted Block Kit blocks
        to the configured SLACK_WEBHOOK_URL. Degrades gracefully on network/webhook errors.
        """
        if not self.webhook_url or "hooks.slack.com/services/T00" in self.webhook_url or self.webhook_url.startswith("your_"):
            logger.debug("Slack webhook URL not configured or using placeholder; skipping alert dispatch.")
            return False

        payload = self._build_block_kit_payload(context_packet)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.webhook_url, json=payload)
                if response.status_code == 200:
                    logger.info("Slack escalation alert dispatched successfully for session %s", context_packet.get("session_id"))
                    return True
                else:
                    logger.error("Slack webhook returned error %s: %s", response.status_code, response.text)
                    return False
        except Exception as exc:
            logger.error("Failed to send Slack escalation alert for session %s: %s", context_packet.get("session_id"), exc)
            return False


# Singleton service instance
slack_service = SlackService()
