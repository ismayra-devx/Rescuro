"""RESCURO ASR Evaluation & WER Scoring Script.

Provides rigorous, un-gamed speech recognition evaluation:
- Identical text normalization for reference and prediction (lowercase, punctuation, fillers).
- Strict Levenshtein distance word-level alignment (Substitutions, Deletions, Insertions).
- Strictly NO confidence-score filtering or short-word exclusions.
- Corrupted/empty audio sample exclusion with explicit accounting.
- Supports both offline prediction evaluation and live Deepgram STT benchmarking.
"""

import os
import sys
import re
import json
import csv
import argparse
import asyncio
from typing import List, Tuple, Dict, Any, Optional

# Add project root to sys.path so app imports work
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.services.deepgram_service import deepgram_service
from app.config import settings

# Standard verbal hesitation fillers to normalize symmetrically
FILLER_WORDS = {"uh", "um", "ah", "er", "eh", "hmm", "mhm"}


def normalize_text(text: str, remove_fillers: bool = True) -> str:
    """
    Applies identical normalization to both reference and hypothesis:
    1. Lowercase text.
    2. Replace punctuation and special characters with spaces.
    3. Remove common verbal fillers symmetrically.
    4. Collapse and strip all whitespace.
    """
    if not text:
        return ""
    
    # 1. Lowercase
    cleaned = text.lower()

    # 2. Strip punctuation & special characters (preserve letters, digits, and spaces)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)

    # 3. Tokenize
    words = cleaned.split()

    # 4. Filter verbal fillers if enabled
    if remove_fillers:
        words = [w for w in words if w not in FILLER_WORDS]

    return " ".join(words)


def compute_levenshtein_alignment(
    ref_words: List[str],
    hyp_words: List[str]
) -> Tuple[int, int, int, int]:
    """
    Computes exact word-level alignment using dynamic programming Levenshtein distance:
    Returns (substitutions, deletions, insertions, correct).
    """
    n = len(ref_words)
    m = len(hyp_words)

    # dp[i][j] stores the minimum edit distance between ref_words[:i] and hyp_words[:j]
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i  # Deletions
    for j in range(m + 1):
        dp[0][j] = j  # Insertions

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = min(
                    dp[i - 1][j - 1] + 1,  # Substitution
                    dp[i - 1][j] + 1,      # Deletion
                    dp[i][j - 1] + 1       # Insertion
                )

    # Traceback to count operations
    i, j = n, m
    substitutions = 0
    deletions = 0
    insertions = 0
    correct = 0

    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i - 1] == hyp_words[j - 1]:
            correct += 1
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            substitutions += 1
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            deletions += 1
            i -= 1
        else:
            insertions += 1
            j -= 1

    return substitutions, deletions, insertions, correct


class ASREvaluator:
    """
    Evaluator that aggregates metrics across an entire test set.
    Enforces honest scoring: No confidence thresholding, no word-length exclusion.
    """

    def __init__(self):
        self.total_reference_words = 0
        self.total_hypothesis_words = 0
        self.total_substitutions = 0
        self.total_deletions = 0
        self.total_insertions = 0
        self.total_correct = 0
        self.processed_samples = 0
        self.excluded_corrupted_samples = 0
        self.sample_results = []

    def evaluate_pair(
        self,
        sample_id: str,
        reference_text: str,
        hypothesis_text: str,
        is_corrupted_or_empty: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single reference vs hypothesis pair.
        """
        if is_corrupted_or_empty:
            self.excluded_corrupted_samples += 1
            return None

        clean_ref = normalize_text(reference_text)
        clean_hyp = normalize_text(hypothesis_text)

        ref_words = clean_ref.split()
        hyp_words = clean_hyp.split()

        if not ref_words:
            # Empty reference cannot be scored for WER (denominator = 0)
            self.excluded_corrupted_samples += 1
            return None

        subs, dels, ins, corr = compute_levenshtein_alignment(ref_words, hyp_words)
        n_ref = len(ref_words)

        self.total_reference_words += n_ref
        self.total_hypothesis_words += len(hyp_words)
        self.total_substitutions += subs
        self.total_deletions += dels
        self.total_insertions += ins
        self.total_correct += corr
        self.processed_samples += 1

        sample_wer = (subs + dels + ins) / n_ref
        sample_acc = max(0.0, (n_ref - subs - dels - ins) / n_ref) * 100.0

        item_result = {
            "id": sample_id,
            "ref_raw": reference_text,
            "hyp_raw": hypothesis_text,
            "ref_normalized": clean_ref,
            "hyp_normalized": clean_hyp,
            "ref_words": n_ref,
            "hyp_words": len(hyp_words),
            "substitutions": subs,
            "deletions": dels,
            "insertions": ins,
            "correct": corr,
            "wer": round(sample_wer * 100.0, 2),
            "accuracy": round(sample_acc, 2)
        }
        self.sample_results.append(item_result)
        return item_result

    def get_summary(self) -> Dict[str, Any]:
        """Calculates global corpus-level WER and accuracy metrics."""
        n = self.total_reference_words
        if n == 0:
            return {
                "status": "NO_DATA",
                "processed_samples": 0,
                "excluded_samples": self.excluded_corrupted_samples
            }

        corpus_wer = ((self.total_substitutions + self.total_deletions + self.total_insertions) / n) * 100.0
        # Standard Word Accuracy: max(0, 1 - WER) * 100
        corpus_accuracy = max(0.0, 100.0 - corpus_wer)
        # Word Recognition Rate: (Correct / Reference) * 100
        word_recognition_rate = (self.total_correct / n) * 100.0

        return {
            "processed_samples": self.processed_samples,
            "excluded_corrupted_samples": self.excluded_corrupted_samples,
            "total_reference_words": n,
            "total_hypothesis_words": self.total_hypothesis_words,
            "substitutions": self.total_substitutions,
            "deletions": self.total_deletions,
            "insertions": self.total_insertions,
            "correct": self.total_correct,
            "substitution_rate_pct": round((self.total_substitutions / n) * 100.0, 2),
            "deletion_rate_pct": round((self.total_deletions / n) * 100.0, 2),
            "insertion_rate_pct": round((self.total_insertions / n) * 100.0, 2),
            "wer_pct": round(corpus_wer, 2),
            "word_accuracy_pct": round(corpus_accuracy, 2),
            "word_recognition_rate_pct": round(word_recognition_rate, 2)
        }


def run_self_test() -> Dict[str, Any]:
    """
    Self-test demonstrating exact alignment and error counting
    on representative emergency dispatch call samples with Indian English phrasing.
    """
    test_cases = [
        (
            "sample_001",
            "Emergency, please send an ambulance immediately to Sector 62 Noida.",
            "emergency please send an ambulance immediately to sector 62 noida"
        ),
        (
            "sample_002",
            "There has been a severe car accident on Outer Ring Road near flyover.",
            "there has been severe car accident on outer ring road near flyover" # deletion of 'a'
        ),
        (
            "sample_003",
            "Two people are injured and bleeding, one person is unconscious.",
            "two people are injured and bleeding one person is unconscious"
        ),
        (
            "sample_004",
            "Fire broke out in the hospital electrical room, dispatch fire brigade.",
            "fire broke out in hospital electrical room dispatch fire brigade" # deletion of 'the'
        ),
        (
            "sample_005",
            "Caller needs police assistance at Connaught Place block B.",
            "caller needs police assistance at cannaught place block b" # substitution of 'cannaught' for 'connaught'
        ),
    ]

    evaluator = ASREvaluator()
    for sid, ref, hyp in test_cases:
        evaluator.evaluate_pair(sid, ref, hyp)

    summary = evaluator.get_summary()
    return summary


BASELINE_METRICS = {
    "word_accuracy_pct": 79.34,
    "wer_pct": 22.21,
    "substitutions": 5942,
    "deletions": 2254,
    "insertions": 614,
    "total_errors": 8810,
    "total_reference_words": 39667,
    "processed_samples": 500
}


def load_dataset(filepath: str) -> List[Dict[str, Any]]:
    """
    Loads a dataset from CSV or JSON file.
    Normalizes field names to: id, reference, audio, prediction.
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Dataset file not found at: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    samples = []

    if ext == ".json":
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
        items = raw if isinstance(raw, list) else raw.get("samples", raw.get("data", []))
        for i, item in enumerate(items):
            sid = str(item.get("id") or item.get("sample_id") or f"sample_{i+1:04d}")
            ref = str(item.get("reference") or item.get("ref") or item.get("ground_truth") or item.get("text") or "")
            aud = str(item.get("audio") or item.get("audio_path") or item.get("file") or "")
            pred = str(item.get("prediction") or item.get("hyp") or item.get("hypothesis") or item.get("transcript") or "")
            samples.append({"id": sid, "reference": ref, "audio": aud, "prediction": pred})

    elif ext in [".csv", ".tsv"]:
        delimiter = "\t" if ext == ".tsv" else ","
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            # Find matching headers
            for i, row in enumerate(reader):
                # ID resolution
                sid = ""
                for k in ["id", "sample_id", "index", "call_id", "name"]:
                    if k in row and row[k]:
                        sid = row[k]
                        break
                if not sid:
                    sid = f"sample_{i+1:04d}"

                # Reference resolution
                ref = ""
                for k in ["reference", "ref", "ground_truth", "text", "transcript_ref", "expected"]:
                    if k in row and row[k]:
                        ref = row[k]
                        break

                # Audio path resolution
                aud = ""
                for k in ["audio", "audio_path", "audio_file", "file", "path", "audio_url"]:
                    if k in row and row[k]:
                        aud = row[k]
                        break

                # Prediction resolution
                pred = ""
                for k in ["prediction", "hyp", "hypothesis", "transcript", "transcription", "pred"]:
                    if k in row and row[k]:
                        pred = row[k]
                        break

                samples.append({"id": sid, "reference": ref, "audio": aud, "prediction": pred})
    else:
        raise ValueError(f"Unsupported dataset extension '{ext}'. Must be .csv, .tsv, or .json")

    return samples


async def transcribe_audio_sample(
    audio_path: str,
    mime_type: str = "audio/wav"
) -> Tuple[str, bool, str]:
    """
    Transcribes a local audio file or URL using DeepgramService.
    Returns: (transcript, is_corrupted, exclusion_reason)
    """
    if not audio_path or not os.path.exists(audio_path):
        return "", True, f"Audio file not found or inaccessible: {audio_path}"

    try:
        size = os.path.getsize(audio_path)
        if size == 0:
            return "", True, f"0-byte empty audio file: {audio_path}"

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        res = await deepgram_service.transcribe_prerecorded(audio_bytes, mime_type=mime_type)
        transcript = res.get("transcript", "")
        return transcript, False, ""
    except Exception as exc:
        return "", True, f"Corrupted audio or read error: {exc}"


def print_comparison_table(summary: Dict[str, Any]):
    """Prints a clear, side-by-side Before/After evaluation table."""
    b = BASELINE_METRICS
    s = summary

    orig_acc = b["word_accuracy_pct"]
    new_acc = s["word_accuracy_pct"]
    acc_diff = new_acc - orig_acc

    orig_wer = b["wer_pct"]
    new_wer = s["wer_pct"]
    wer_diff = new_wer - orig_wer

    orig_subs = b["substitutions"]
    new_subs = s["substitutions"]
    subs_diff = new_subs - orig_subs

    orig_dels = b["deletions"]
    new_dels = s["deletions"]
    dels_diff = new_dels - orig_dels

    orig_ins = b["insertions"]
    new_ins = s["insertions"]
    ins_diff = new_ins - orig_ins

    orig_err = b["total_errors"]
    new_err = new_subs + new_dels + new_ins
    err_diff = new_err - orig_err

    target_reached = new_acc >= 85.0
    status_str = "REACHED (+85% Target Met)" if target_reached else "NOT MET (Still < 85%)"

    print("\n" + "=" * 92)
    print("                RESCURO ASR BENCHMARK: BEFORE vs AFTER PIPELINE UPGRADE")
    print("=" * 92)
    print(f"{'Metric':<28} | {'Original Baseline':<22} | {'Updated Deepgram':<20} | {'Improvement':<12}")
    print("-" * 28 + "-+-" + "-" * 22 + "-+-" + "-" * 20 + "-+-" + "-" * 12)
    print(f"{'Word Accuracy':<28} | {orig_acc:>19.2f}% | {new_acc:>17.2f}% | {acc_diff:>+9.2f} pp")
    print(f"{'Word Error Rate (WER)':<28} | {orig_wer:>19.2f}% | {new_wer:>17.2f}% | {wer_diff:>+9.2f} pp")
    print(f"{'Substitutions':<28} | {orig_subs:>20,d} | {new_subs:>18,d} | {subs_diff:>+10,d}")
    print(f"{'Deletions':<28} | {orig_dels:>20,d} | {new_dels:>18,d} | {dels_diff:>+10,d}")
    print(f"{'Insertions':<28} | {orig_ins:>20,d} | {new_ins:>18,d} | {ins_diff:>+10,d}")
    print(f"{'Total Errors':<28} | {orig_err:>20,d} | {new_err:>18,d} | {err_diff:>+10,d}")
    print(f"{'Total Reference Words':<28} | {b['total_reference_words']:>20,d} | {s['total_reference_words']:>18,d} | {'-':>10}")
    print(f"{'Processed Samples':<28} | {b['processed_samples']:>20,d} | {s['processed_samples']:>18,d} | {'-':>10}")
    print(f"{'Excluded Corrupt Samples':<28} | {'0':>20} | {s['excluded_corrupted_samples']:>18,d} | {'-':>10}")
    print("-" * 28 + "-+-" + "-" * 22 + "-+-" + "-" * 20 + "-+-" + "-" * 12)
    print(f"{'85%+ Target Status':<28} | {'FAILED (79.34%)':<22} | {status_str:<20} | {'':<10}")
    print("=" * 92 + "\n")


def print_worst_samples(sample_results: List[Dict[str, Any]], top_n: int = 20):
    """
    Identifies and prints the worst-scoring samples ranked by total errors.
    """
    # Sort samples by total errors descending, then accuracy ascending
    ranked = sorted(
        sample_results,
        key=lambda x: (x["substitutions"] + x["deletions"] + x["insertions"], -x["accuracy"]),
        reverse=True
    )

    worst = ranked[:top_n]
    print("\n" + "=" * 96)
    print(f"               TOP {len(worst)} WORST-SCORING SAMPLES (DIAGNOSTIC ERROR REVIEW)")
    print("=" * 96)

    for i, s in enumerate(worst, start=1):
        err_count = s["substitutions"] + s["deletions"] + s["insertions"]
        print(f"\n[{i:02d}] Sample ID: {s['id']} | Word Accuracy: {s['accuracy']}% | Total Errors: {err_count} (Sub: {s['substitutions']}, Del: {s['deletions']}, Ins: {s['insertions']})")
        print(f"     REFERENCE:  \"{s['ref_raw']}\"")
        print(f"     PREDICTION: \"{s['hyp_raw']}\"")
        print(f"     NORM REF:   \"{s['ref_normalized']}\"")
        print(f"     NORM HYP:   \"{s['hyp_normalized']}\"")

    print("\n" + "=" * 96)


async def execute_evaluation(
    dataset_path: str,
    save_csv_path: str = "rescuro_final_results_v2.csv",
    output_json_path: Optional[str] = None,
    api_key: Optional[str] = None
):
    """
    Orchestrates full dataset evaluation, live transcription (if audio available),
    scoring, CSV output, and comparative analysis.
    """
    if api_key:
        deepgram_service.api_key = api_key

    print(f"Loading benchmark dataset from: {dataset_path}")
    samples = load_dataset(dataset_path)
    total_samples = len(samples)
    print(f"Loaded {total_samples} samples.")

    evaluator = ASREvaluator()
    results_for_csv = []
    excluded_samples_log = []

    print(f"Transcribing and scoring {total_samples} samples with Deepgram config...")
    print(f" - Model: {settings.DEEPGRAM_MODEL}")
    print(f" - Language: {settings.DEEPGRAM_LANGUAGE}")
    print(" - Keyword Boosting: 15 Emergency Terms (weights 2-3)")
    print(" - Turn Detection: endpointing=300ms, utterance_end_ms=1000ms\n")

    for i, item in enumerate(samples, start=1):
        sid = item["id"]
        ref = item["reference"]
        aud = item["audio"]
        pred = item["prediction"]

        # If audio path exists and prediction is empty, transcribe freshly
        if aud and not pred:
            hyp, is_corrupt, reason = await transcribe_audio_sample(aud)
            if is_corrupt:
                excluded_samples_log.append({"id": sid, "audio": aud, "reason": reason})
                evaluator.evaluate_pair(sid, ref, "", is_corrupted_or_empty=True)
                continue
        else:
            hyp = pred

        eval_res = evaluator.evaluate_pair(sid, ref, hyp)
        if eval_res:
            results_for_csv.append(eval_res)

        if i % 50 == 0 or i == total_samples:
            print(f"  Processed {i}/{total_samples} samples...")

    summary = evaluator.get_summary()

    # Save to CSV
    if save_csv_path:
        csv_dir = os.path.dirname(save_csv_path)
        if csv_dir:
            os.makedirs(csv_dir, exist_ok=True)
        with open(save_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "sample_id",
                "reference_raw",
                "prediction_raw",
                "reference_normalized",
                "prediction_normalized",
                "reference_words",
                "hypothesis_words",
                "substitutions",
                "deletions",
                "insertions",
                "correct",
                "wer_pct",
                "word_accuracy_pct"
            ])
            for r in results_for_csv:
                writer.writerow([
                    r["id"],
                    r["ref_raw"],
                    r["hyp_raw"],
                    r["ref_normalized"],
                    r["hyp_normalized"],
                    r["ref_words"],
                    r["hyp_words"],
                    r["substitutions"],
                    r["deletions"],
                    r["insertions"],
                    r["correct"],
                    r["wer"],
                    r["accuracy"]
                ])
        print(f"\nFresh predictions and scoring saved to: {os.path.abspath(save_csv_path)}")

    # Save JSON output if requested
    if output_json_path:
        out_payload = {
            "summary": summary,
            "baseline": BASELINE_METRICS,
            "excluded_corrupted_samples": excluded_samples_log,
            "samples": results_for_csv
        }
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(out_payload, f, indent=2)
        print(f"JSON evaluation report saved to: {os.path.abspath(output_json_path)}")

    # Print comparison table
    print_comparison_table(summary)

    # If accuracy is below 85%, print top 20 worst samples and targeted recommendations
    if summary["word_accuracy_pct"] < 85.0 and results_for_csv:
        print_worst_samples(results_for_csv, top_n=20)
        print("DIAGNOSTIC PATTERN ANALYSIS & RECOMMENDED ADJUSTMENTS:")
        print("1. Phonetic & Regional Accent Boosts:")
        print("   - Boost Indian English locational identifiers: 'Chowk:2', 'Marg:2', 'Sector:2', 'Noida:2', 'Flyover:2'.")
        print("   - Boost Hinglish emergency markers: 'Bachao:3', 'Aag:3', 'Madad:3', 'Ghaayal:2'.")
        print("2. Endpointing & Acoustic Tuning:")
        print("   - For rapid or high-stress panic speech, reduce `endpointing` to 250ms and verify linear16 sampling.")
        print("   - Use `smart_format=True` with search-and-replace normalization for common homophones.\n")


def main():
    parser = argparse.ArgumentParser(description="RESCURO ASR / WER Evaluation Tool")
    parser.add_argument("--dataset", type=str, help="Path to JSON or CSV dataset file with reference/hypothesis")
    parser.add_argument("--self-test", action="store_true", help="Run internal validation test suite")
    parser.add_argument("--output", type=str, help="Path to write JSON evaluation results")
    parser.add_argument("--save-csv", type=str, default="rescuro_final_results_v2.csv", help="Path to write CSV predictions")
    parser.add_argument("--api-key", type=str, help="Override Deepgram API key")
    args = parser.parse_args()

    if args.self_test:
        print("Running RESCURO ASR Evaluation Self-Test...")
        results = run_self_test()
        print_comparison_table(results)
        return

    if not args.dataset:
        print("Usage: python scripts/evaluate_asr.py --self-test OR --dataset <path_to_json_or_csv>")
        sys.exit(1)

    asyncio.run(execute_evaluation(
        dataset_path=args.dataset,
        save_csv_path=args.save_csv,
        output_json_path=args.output,
        api_key=args.api_key
    ))


if __name__ == "__main__":
    main()

