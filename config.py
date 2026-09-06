"""RESCURO Configuration Shim.
Re-exports settings and Settings from the single source of truth: app.config.
"""

from app.config import settings, Settings, verify_required_keys

__all__ = ["settings", "Settings", "verify_required_keys"]
