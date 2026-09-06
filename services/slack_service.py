"""RESCURO Slack Service Shim.
Re-exports slack_service and SlackService from app.services.slack_service.
"""
from app.services.slack_service import SlackService, slack_service

__all__ = ["SlackService", "slack_service"]
