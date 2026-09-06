"""Unit and integration tests for RESCURO Deepgram ASR configuration and evaluation."""

import pytest
from app.services.deepgram_service import deepgram_service, EMERGENCY_KEYWORDS
from scripts.evaluate_asr import normalize_text, compute_levenshtein_alignment, ASREvaluator


def test_deepgram_query_params_defaults():
    """Verify Deepgram streaming query parameters incorporate nova-3, en-IN, endpointing, and boosts."""
    params_str = deepgram_service._get_query_params(sample_rate=8000, encoding="linear16")
    params = params_str.split("&")
    param_dict = {}
    keywords = []

    for p in params:
        if "=" in p:
            k, v = p.split("=", 1)
            if k == "keywords":
                keywords.append(v)
            else:
                param_dict[k] = v

    # 1. Model tier defaults to nova-3
    assert param_dict.get("model") == "nova-3"

    # 2. Language defaults to multi (Nova-3 multilingual code-switching)
    assert param_dict.get("language") == "multi"

    # 3. Smart formatting and punctuation enabled
    assert param_dict.get("smart_format") == "true"
    assert param_dict.get("punctuate") == "true"

    # 4. Turn detection parameters tuned
    assert param_dict.get("endpointing") == "300"
    assert param_dict.get("utterance_end_ms") == "1000"

    # 5. Native linear16 encoding
    assert param_dict.get("encoding") == "linear16"
    assert param_dict.get("sample_rate") == "8000"

    # 6. Verify domain emergency keywords boosted
    assert "ambulance:3" in keywords
    assert "emergency:3" in keywords
    assert "accident:2" in keywords
    assert "police:2" in keywords
    assert "fire:2" in keywords
    assert "injured:2" in keywords
    assert "unconscious:2" in keywords
    assert "bleeding:2" in keywords
    assert "hospital:2" in keywords


def test_deepgram_query_params_custom_overrides():
    """Verify custom language or model override is honored."""
    params_str = deepgram_service._get_query_params(
        model="nova-2",
        language="hi",
        sample_rate=16000,
        encoding="linear16"
    )
    assert "model=nova-2" in params_str
    assert "language=hi" in params_str
    assert "sample_rate=16000" in params_str
    assert "extra=code_switch:true" in params_str


def test_normalization_identical_and_filler_removal():
    """Verify identical text normalization strips punctuation and verbal fillers."""
    ref = "Uh, emergency! Please send an ambulance immediately to Delhi, sector 12."
    hyp = "emergency please send an ambulance immediately to delhi sector 12"

    clean_ref = normalize_text(ref)
    clean_hyp = normalize_text(hyp)

    assert clean_ref == clean_hyp
    assert "uh" not in clean_ref.split()


def test_levenshtein_alignment_math():
    """Verify exact count of substitutions, deletions, and insertions."""
    ref_words = ["send", "an", "ambulance", "immediately"]
    # 1 substitution ("car" instead of "ambulance"), 1 deletion ("immediately" missing)
    hyp_words = ["send", "an", "car"]

    subs, dels, ins, corr = compute_levenshtein_alignment(ref_words, hyp_words)
    assert subs == 1
    assert dels == 1
    assert ins == 0
    assert corr == 2

    # Insertion test
    hyp_with_ins = ["please", "send", "an", "ambulance", "immediately", "now"]
    subs_i, dels_i, ins_i, corr_i = compute_levenshtein_alignment(ref_words, hyp_with_ins)
    assert subs_i == 0
    assert dels_i == 0
    assert ins_i == 2
    assert corr_i == 4


def test_evaluator_un_gamed_metrics():
    """Verify ASREvaluator computes honest corpus metrics without threshold filtering."""
    evaluator = ASREvaluator()

    # Sample 1: Perfect match
    evaluator.evaluate_pair("s1", "fire at factory", "fire at factory")

    # Sample 2: 1 substitution
    evaluator.evaluate_pair("s2", "call the police", "call the cops")

    # Total reference words = 3 + 3 = 6
    # Total correct = 3 + 2 = 5, Substitutions = 1
    # WER = 1/6 = 16.67%
    # Word Accuracy = (1 - 1/6) = 83.33%
    summary = evaluator.get_summary()
    assert summary["processed_samples"] == 2
    assert summary["total_reference_words"] == 6
    assert summary["substitutions"] == 1
    assert summary["deletions"] == 0
    assert summary["insertions"] == 0
    assert summary["wer_pct"] == 16.67
    assert summary["word_accuracy_pct"] == 83.33


def test_load_dataset_csv_and_json(tmp_path):
    """Verify load_dataset parses CSV and JSON formats with varied header names."""
    from scripts.evaluate_asr import load_dataset

    # 1. Test CSV format
    csv_file = tmp_path / "test_benchmark.csv"
    csv_file.write_text(
        "call_id,ground_truth,hypothesis\n"
        "call_01,ambulance needed immediately,ambulance needed immediately\n"
        "call_02,major fire near bridge,major fire near bridge\n",
        encoding="utf-8"
    )
    samples = load_dataset(str(csv_file))
    assert len(samples) == 2
    assert samples[0]["id"] == "call_01"
    assert samples[0]["reference"] == "ambulance needed immediately"
    assert samples[0]["prediction"] == "ambulance needed immediately"

    # 2. Test JSON format
    json_file = tmp_path / "test_benchmark.json"
    import json
    json_data = [
        {"id": "j1", "reference": "two people injured", "prediction": "two people injured"},
        {"id": "j2", "reference": "send police to market", "prediction": "send police to bazaar"}
    ]
    json_file.write_text(json.dumps(json_data), encoding="utf-8")
    json_samples = load_dataset(str(json_file))
    assert len(json_samples) == 2
    assert json_samples[1]["prediction"] == "send police to bazaar"


@pytest.mark.asyncio
async def test_execute_evaluation_runner(tmp_path):
    """Verify execute_evaluation produces valid rescuro_final_results_v2.csv and summary."""
    from scripts.evaluate_asr import execute_evaluation
    import csv

    test_csv = tmp_path / "eval_input.csv"
    test_csv.write_text(
        "id,reference,prediction\n"
        "s1,emergency please send ambulance to sector 62,emergency please send ambulance to sector 62\n"
        "s2,fire broke out in electrical room,fire broke out in room\n", # deletion of "electrical"
        encoding="utf-8"
    )

    out_csv = tmp_path / "rescuro_final_results_v2.csv"
    out_json = tmp_path / "eval_report.json"

    await execute_evaluation(
        dataset_path=str(test_csv),
        save_csv_path=str(out_csv),
        output_json_path=str(out_json)
    )

    assert out_csv.exists()
    assert out_json.exists()

    with open(out_csv, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
        assert len(reader) == 2
        assert reader[0]["sample_id"] == "s1"
        assert float(reader[0]["word_accuracy_pct"]) == 100.0
        assert reader[1]["sample_id"] == "s2"
        assert int(reader[1]["deletions"]) == 1


@pytest.mark.asyncio
async def test_deepgram_fallback_model_caching():
    """Verify that deepgram_service requests nova-3 with language=multi and does not permanently cache nova-2 on 400."""
    from unittest.mock import patch, MagicMock
    from app.services.deepgram_service import DeepgramService

    svc = DeepgramService()
    svc.api_key = "test_deepgram_key_123"

    mock_resp_400 = MagicMock()
    mock_resp_400.status_code = 400
    mock_resp_400.text = '{"err_code": "INVALID_PARAM", "err_msg": "Feature code_switch is not supported for model nova-3"}'

    mock_resp_200 = MagicMock()
    mock_resp_200.status_code = 200
    mock_resp_200.json.return_value = {
        "results": {
            "channels": [
                {"alternatives": [{"transcript": "Mera accident ho gaya hai", "confidence": 0.95, "languages": ["hi", "en"]}]}
            ]
        }
    }

    requests_recorded = []

    async def mock_post(client, url, *args, **kwargs):
        params = kwargs.get("params", [])
        param_dict = dict(params)
        requests_recorded.append(param_dict)
        # Turn 1: nova-3 with invalid params returns 400
        if len(requests_recorded) == 1:
            return mock_resp_400
        return mock_resp_200

    with patch("httpx.AsyncClient.post", new=mock_post):
        # Turn 1: HTTP 400 error returns empty transcript safely without crashing
        res1 = await svc.transcribe_prerecorded(b"\x00" * 3200)
        assert res1["transcript"] == ""
        assert requests_recorded[0]["model"] == "nova-3"
        assert requests_recorded[0]["language"] == "multi"
        # Verify nova-2 is NOT permanently cached
        assert not hasattr(svc, "_active_model") or svc._active_model is None

        # Turn 2: nova-3 is attempted again (no permanent fallback on 400)
        res2 = await svc.transcribe_prerecorded(b"\x00" * 3200)
        assert res2["transcript"] == "Mera accident ho gaya hai"
        assert requests_recorded[1]["model"] == "nova-3"
        assert requests_recorded[1]["language"] == "multi"

