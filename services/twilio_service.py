"""RESCURO Twilio Service Shim.
Re-exports twilio_service and TwilioService from app.services.twilio_service.
"""
from app.services.twilio_service import TwilioService, twilio_service

__all__ = ["TwilioService", "twilio_service"]
