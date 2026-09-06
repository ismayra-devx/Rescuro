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

    # 2. Language defaults to en-IN (Indian English)
    assert param_dict.get("language") == "en-IN"

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
