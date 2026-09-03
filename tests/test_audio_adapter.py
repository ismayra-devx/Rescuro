"""Tests for clean AudioAdapter interface, Agora service isolation, and Mock fallback."""

import pytest
from app.orchestrator import BattleBuddyOrchestrator
from app.services.agora_service import (
    AgoraAudioAdapter,
    AgoraConfigurationError,
    AgoraSDKError,
)
from app.services.audio_adapter import (
    AudioAdapter,
    BaseAudioAdapter,
    MockAudioAdapter,
    RecordedAudioAdapter,
    get_audio_adapter,
)


class TestAudioAdapterInterfaceContract:
    """Verify that BaseAudioAdapter strictly enforces the required interface methods."""

    def test_incomplete_subclass_cannot_be_instantiated(self):
        """A subclass missing any of start_session, receive_audio, send_audio, stop_session, is_active must fail."""
        class IncompleteAdapter(BaseAudioAdapter):
            async def start_session(self, session_id: str, **kwargs):
                pass

        with pytest.raises(TypeError) as excinfo:
            IncompleteAdapter()  # type: ignore
        assert "Can't instantiate abstract class" in str(excinfo.value)


class TestMockAndRecordedAudioAdapter:
    """Verify MockAudioAdapter and RecordedAudioAdapter functionality and test stream."""

    @pytest.mark.asyncio
    async def test_session_lifecycle_and_chunk_tracking(self):
        adapter = MockAudioAdapter()
        session_id = "test_session_001"

        assert adapter.is_active(session_id) is False

        # 1. Start session
        await adapter.start_session(session_id)
        assert adapter.is_active(session_id) is True

        # 2. Receive and send audio chunks
        in_chunk = b"RAW_AUDIO_IN_CHUNK_1"
        out_chunk = b"SYNTHESIZED_AUDIO_OUT_CHUNK_1"

        await adapter.receive_audio(session_id, in_chunk)
        await adapter.send_audio(session_id, out_chunk)

        assert adapter.get_received_chunks(session_id) == [in_chunk]
        assert adapter.get_sent_chunks(session_id) == [out_chunk]

        # 3. Stop session
        await adapter.stop_session(session_id)
        assert adapter.is_active(session_id) is False

        # 4. Error on inactive session
        with pytest.raises(RuntimeError) as exc_rec:
            await adapter.receive_audio(session_id, b"chunk_after_stop")
        assert "not active" in str(exc_rec.value)

        with pytest.raises(RuntimeError) as exc_send:
            await adapter.send_audio(session_id, b"chunk_after_stop")
        assert "not active" in str(exc_send.value)

    @pytest.mark.asyncio
    async def test_stream_prerecorded_test_stream(self):
        adapter = MockAudioAdapter()
        session_id = "test_prerecorded_session"

        chunks = []
        async for chunk in adapter.stream_prerecorded_test_stream(
            session_id=session_id,
            simulated_transcript="Emergency reported at Main Street",
            chunk_count=3,
        ):
            chunks.append(chunk)

        assert len(chunks) == 3
        assert adapter.is_active(session_id) is True
        assert len(adapter.get_received_chunks(session_id)) == 3

    def test_recorded_adapter_alias(self):
        recorded = RecordedAudioAdapter()
        assert isinstance(recorded, BaseAudioAdapter)
        assert isinstance(recorded, MockAudioAdapter)

    def test_backward_compatible_audio_adapter_alias(self):
        adapter = AudioAdapter()
        assert isinstance(adapter, BaseAudioAdapter)
        assert isinstance(adapter, MockAudioAdapter)


class TestAgoraServiceIsolation:
    """Verify Agora details remain strictly isolated within the agora_service module."""

    def test_agora_credentials_validation_fails_on_missing(self):
        """Missing or placeholder credentials must raise AgoraConfigurationError."""
        with pytest.raises(AgoraConfigurationError) as exc1:
            AgoraAudioAdapter(app_id=None, app_certificate=None)
        assert "Invalid or missing AGORA_APP_ID" in str(exc1.value)

        with pytest.raises(AgoraConfigurationError) as exc2:
            AgoraAudioAdapter(app_id="your_agora_app_id", app_certificate="your_agora_app_certificate")
        assert "Invalid or missing AGORA_APP_ID" in str(exc2.value)

        with pytest.raises(AgoraConfigurationError) as exc3:
            AgoraAudioAdapter(app_id="valid_dummy_app_id", app_certificate="")
        assert "Invalid or missing AGORA_APP_CERTIFICATE" in str(exc3.value)

    @pytest.mark.asyncio
    async def test_agora_session_lifecycle_with_credentials(self):
        """AgoraAudioAdapter starts RTC session, generates token, and streams audio."""
        agora = AgoraAudioAdapter(
            app_id="agora_app_id_valid_12345",
            app_certificate="agora_app_cert_valid_67890",
        )
        session_id = "agora_test_session_10"

        # 1. Start session
        await agora.start_session(session_id, channel_name="test_channel", uid=1001)
        assert agora.is_active(session_id) is True

        info = agora.get_channel_info(session_id)
        assert info is not None
        assert info["channel_name"] == "test_channel"
        assert info["uid"] == 1001
        assert info["token"].startswith("AGORA_TOKEN_") or len(info["token"]) > 20

        # 2. Receive and send audio
        await agora.receive_audio(session_id, b"AGORA_INBOUND_VOICE")
        await agora.send_audio(session_id, b"AGORA_OUTBOUND_VOICE")

        assert agora.get_received_chunks(session_id) == [b"AGORA_INBOUND_VOICE"]
        assert agora.get_sent_chunks(session_id) == [b"AGORA_OUTBOUND_VOICE"]

        # 3. Stop session
        await agora.stop_session(session_id)
        assert agora.is_active(session_id) is False

        with pytest.raises(RuntimeError):
            await agora.receive_audio(session_id, b"chunk")


class TestFactoryAndFallback:
    """Verify get_audio_adapter factory and graceful fallback to MockAudioAdapter."""

    def test_factory_returns_mock_by_default(self):
        adapter = get_audio_adapter("mock")
        assert isinstance(adapter, MockAudioAdapter)

    def test_factory_returns_recorded(self):
        adapter = get_audio_adapter("recorded")
        assert isinstance(adapter, RecordedAudioAdapter)

    def test_agora_fallback_when_credentials_invalid(self):
        """When Agora credentials/SDK fail, get_audio_adapter gracefully falls back to MockAudioAdapter."""
        # By default fallback_to_mock is True
        adapter = get_audio_adapter(
            adapter_type="agora",
            fallback_to_mock=True,
            app_id="",
            app_certificate="",
        )
        assert isinstance(adapter, MockAudioAdapter)
        assert not isinstance(adapter, AgoraAudioAdapter)

    def test_agora_strict_mode_raises_when_fallback_disabled(self):
        """When fallback_to_mock is False, configuration error is raised."""
        with pytest.raises(AgoraConfigurationError):
            get_audio_adapter(
                adapter_type="agora",
                fallback_to_mock=False,
                app_id="",
                app_certificate="",
            )

    def test_agora_succeeds_when_credentials_valid(self):
        adapter = get_audio_adapter(
            adapter_type="agora",
            app_id="valid_agora_app_id_999",
            app_certificate="valid_agora_cert_999",
        )
        assert isinstance(adapter, AgoraAudioAdapter)


class TestBattleBuddyOrchestratorDecoupling:
    """Verify BattleBuddyOrchestrator works without Agora coupling."""

    @pytest.mark.asyncio
    async def test_orchestrator_initializes_with_clean_adapter(self):
        orchestrator = BattleBuddyOrchestrator()
        assert isinstance(orchestrator.audio_adapter, BaseAudioAdapter)

    @pytest.mark.asyncio
    async def test_orchestrator_custom_audio_adapter(self):
        custom_adapter = RecordedAudioAdapter()
        orchestrator = BattleBuddyOrchestrator(audio_adapter=custom_adapter)
        assert orchestrator.audio_adapter is custom_adapter

    @pytest.mark.asyncio
    async def test_orchestrator_audio_flow_and_triage(self):
        """Verify complete audio stream simulation through EchoSphere orchestrator."""
        adapter = MockAudioAdapter()
        orchestrator = BattleBuddyOrchestrator(audio_adapter=adapter)

        # 1. Create session
        session = await orchestrator.create_session()
        await orchestrator.audio_adapter.start_session(session.session_id)

        # 2. Simulate streaming test audio into adapter
        chunks = []
        async for chunk in orchestrator.audio_adapter.stream_prerecorded_test_stream(
            session_id=session.session_id,
            simulated_transcript="Sir building mein aag lagi hai bachao!",
            chunk_count=2,
        ):
            chunks.append(chunk)

        assert len(chunks) == 2

        # 3. Process transcript through triage pipeline
        result = await orchestrator.process_transcript(
            session_id=session.session_id,
            transcript="Sir building mein aag lagi hai bachao!",
            stt_confidence=0.92,
        )

        assert result["triage_result"]["route"] == "human_supervisor"
        assert "bachao" in result["triage_result"]["matched_keywords"]

        # 4. Clean up audio session
        await orchestrator.audio_adapter.stop_session(session.session_id)
        assert orchestrator.audio_adapter.is_active(session.session_id) is False
