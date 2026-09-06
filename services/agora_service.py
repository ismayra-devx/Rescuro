"""RESCURO Agora Service Shim.
Re-exports agora_service and AgoraService from app.services.agora_service.
"""
from app.services.agora_service import AgoraService, agora_service, generate_rtc_token

__all__ = ["AgoraService", "agora_service", "generate_rtc_token"]
