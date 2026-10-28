#!/usr/bin/env python3
"""Offline, grouped synthetic evaluation for lexical baselines and cached embeddings."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import resource
import sys
import time
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))

STOP_WORDS = {
    "a", "about", "after", "all", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by",
    "can", "could", "did", "do", "for", "from", "had", "has", "have", "he", "her", "here", "him", "his",
    "i", "if", "in", "into", "is", "it", "its", "kindly", "me", "my", "of", "on", "or", "our", "please",
    "regarding", "she", "should", "so", "some", "that", "the", "their", "them", "there", "these", "they",
    "this", "those", "to", "too", "was", "we", "were", "what", "when", "which", "who", "will", "with", "would",
    "you", "your",
}
TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
MODEL_IDS = {
    "minilm": ("MiniLM multilingual", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"),
    "labse": ("LaBSE", "sentence-transformers/LaBSE"),
}
METHODS = ("jaccard", "idf_weighted")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def validate_dataset(pairs: list[dict[str, Any]], labels: list[dict[str, Any]]) -> None:
    pair_ids = [pair.get("pair_id") for pair in pairs]
    label_ids = [label.get("pair_id") for label in labels]
    if len(pair_ids) < 80:
        raise ValueError(f"Expected at least 80 pairs; found {len(pair_ids)}.")
    if len(set(pair_ids)) != len(pair_ids):
        raise ValueError("Pair IDs must be unique.")
    if len(set(label_ids)) != len(label_ids) or set(pair_ids) != set(label_ids):
        raise ValueError("Labels must have exactly one unique entry for every pair.")

    complaint_ids = [pair.get(key) for pair in pairs for key in ("a_id", "b_id")]
    if any(not complaint_id for complaint_id in complaint_ids) or len(set(complaint_ids)) != len(complaint_ids):
        raise ValueError("Every complaint ID must be present and unique in the dataset.")
    if any(pair["a_id"] == pair["b_id"] for pair in pairs):
        raise ValueError("A pair cannot compare a complaint with itself.")
    if any(not pair.get("a_text", "").strip() or not pair.get("b_text", "").strip() for pair in pairs):
        raise ValueError("Complaint text cannot be empty.")

    group_splits: dict[str, set[str]] = {}
    for pair in pairs:
        group = pair.get("scenario_group")
        split = pair.get("split")
        if not group or split not in {"dev", "test"}:
            raise ValueError("Every pair must have a scenario_group and a dev or test split.")
        group_splits.setdefault(group, set()).add(split)
    overlap = sorted(group for group, splits in group_splits.items() if len(splits) != 1)
    if overlap:
        raise ValueError(f"Scenario groups overlap development/test splits: {overlap}")

    label_by_id = {label["pair_id"]: label for label in labels}
    if any(label.get("expected") not in {"related", "unrelated"} or not label.get("rationale", "").strip() for label in labels):
        raise ValueError("Every human-authored label must be related/unrelated and include a rationale.")
    for split in ("dev", "test"):
        split_pairs = [pair for pair in pairs if pair["split"] == split]
        counts = Counter(label_by_id[pair["pair_id"]]["expected"] for pair in split_pairs)
        if not split_pairs or counts["related"] == 0 or counts["unrelated"] == 0:
            raise ValueError(f"Both labels must occur in the {split} split.")
    for group, group_pairs in {
        group: [pair for pair in pairs if pair["scenario_group"] == group]
        for group in group_splits
    }.items():
        group_counts = Counter(label_by_id[pair["pair_id"]]["expected"] for pair in group_pairs)
        if group_counts["related"] != group_counts["unrelated"]:
            raise ValueError(f"Scenario group {group} is not label-balanced.")


def tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).lower()
    return [token for token in TOKEN_PATTERN.findall(normalized) if token not in STOP_WORDS]


def jaccard(left: list[str], right: list[str]) -> float:
    left_set, right_set = set(left), set(right)
    union = left_set | right_set
    return len(left_set & right_set) / len(union) if union else 0.0


def idf_scores(dev_documents: list[list[str]]) -> dict[str, float]:
    """Fit IDF on development complaint texts only; df counts each complaint once."""
    document_frequency: Counter[str] = Counter()
    for document in dev_documents:
        document_frequency.update(set(document))
    total_documents = len(dev_documents)
    return {
        term: math.log((total_documents + 1) / (frequency + 1)) + 1
        for term, frequency in document_frequency.items()
    }


def idf_cosine(left: list[str], right: list[str], weights: dict[str, float]) -> float:
    left_set, right_set = set(left), set(right)
    left_norm = math.sqrt(sum(weights.get(term, 1.0) ** 2 for term in left_set))
    right_norm = math.sqrt(sum(weights.get(term, 1.0) ** 2 for term in right_set))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    dot = sum(weights.get(term, 1.0) ** 2 for term in left_set & right_set)
    return dot / (left_norm * right_norm)


def metric_counts(rows: list[dict[str, Any]], score_key: str, threshold: float) -> dict[str, Any]:
    tp = sum(row["expected"] == "related" and row[score_key] >= threshold for row in rows)
    tn = sum(row["expected"] == "unrelated" and row[score_key] < threshold for row in rows)
    fp = sum(row["expected"] == "unrelated" and row[score_key] >= threshold for row in rows)
    fn = sum(row["expected"] == "related" and row[score_key] < threshold for row in rows)
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
    accuracy = (tp + tn) / len(rows) if rows else None
    return {
        "n": len(rows), "true_positive": tp, "true_negative": tn,
        "false_positive": fp, "false_negative": fn,
        "precision": precision, "recall": recall, "f1": f1, "accuracy": accuracy,
    }


def choose_development_threshold(rows: list[dict[str, Any]], score_key: str) -> tuple[float, dict[str, Any]]:
    scores = sorted({row[score_key] for row in rows})
    candidates = {0.0, 1.0, *scores}
    candidates.update((left + right) / 2 for left, right in zip(scores, scores[1:]))
    scored = [(metric_counts(rows, score_key, threshold), threshold) for threshold in candidates]
    # Maximize development F1; ties select the higher cutoff to reduce review volume.
    best_metrics, best_threshold = max(scored, key=lambda item: (item[0]["f1"] or 0.0, item[1]))
    return best_threshold, best_metrics


def peak_rss_bytes() -> int:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(peak if sys.platform == "darwin" else peak * 1024)


def cache_bytes() -> int:
    cache = ROOT / ".cache"
    if not cache.exists():
        return 0
    resolved_files = {path.resolve() for path in cache.rglob("*") if path.is_file()}
    return sum(path.stat().st_size for path in resolved_files)


def rounded_metrics(rows: list[dict[str, Any]], score_key: str, threshold: float) -> dict[str, Any]:
    metrics = metric_counts(rows, score_key, threshold)
    return {key: round(value, 4) if isinstance(value, float) else value for key, value in metrics.items()}


def breakdown(rows: list[dict[str, Any]], score_key: str, threshold: float, field: str) -> dict[str, Any]:
    values = sorted({row[field] for row in rows})
    output = {}
    for value in values:
        group = [row for row in rows if row[field] == value]
        scenario_count = len({row["scenario_group"] for row in group})
        output[value] = {
            **rounded_metrics(group, score_key, threshold),
            "scenario_groups": scenario_count,
            "exploratory": scenario_count < 10,
        }
    return output


def classified_pairs(rows: list[dict[str, Any]], method: str, score_key: str, threshold: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    false_positives, false_negatives = [], []
    for row in rows:
        prediction = "related" if row[score_key] >= threshold else "unrelated"
        if prediction == row["expected"]:
            continue
        failure = {
            "pair_id": row["pair_id"], "scenario_group": row["scenario_group"],
            "score": row[score_key], "expected": row["expected"],
            "predicted": prediction, "language": row["language"],
            "kind": row["kind"], "rationale": row["rationale"],
        }
        (false_positives if prediction == "related" else false_negatives).append(failure)
    return false_positives, false_negatives


def result_for_method(
    rows: list[dict[str, Any]], development: list[dict[str, Any]], score_key: str, score_type: str,
) -> dict[str, Any]:
    threshold, dev_metrics = choose_development_threshold(development, score_key)
    test_metrics = rounded_metrics(rows, score_key, threshold)
    false_positives, false_negatives = classified_pairs(rows, score_key, score_key, threshold)
    predictions = [
        {
            "pair_id": row["pair_id"], "scenario_group": row["scenario_group"],
            "score_type": score_type, "score": row[score_key],
            "expected": row["expected"],
            "predicted": "related" if row[score_key] >= threshold else "unrelated",
            "language": row["language"], "kind": row["kind"],
            "rationale": row["rationale"],
        }
        for row in rows
    ]
    return {
        "score_type": score_type,
        "threshold": threshold,
        "threshold_source": "development split only; maximum F1, ties choose higher threshold",
        "development_metrics": rounded_metrics(development, score_key, threshold),
        "test_metrics": test_metrics,
        "by_language": breakdown(rows, score_key, threshold, "language"),
        "by_complaint_type": breakdown(rows, score_key, threshold, "kind"),
        "predictions": predictions,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
    }


def validate_report(report: dict[str, Any], test_pair_ids: set[str]) -> None:
    if report["split_counts"]["test"]["pairs"] != len(test_pair_ids):
        raise ValueError("Report test count does not match the held-out dataset.")
    for method, result in report["model_results"].items():
        predictions = result["predictions"]
        prediction_ids = [row["pair_id"] for row in predictions]
        if len(prediction_ids) != len(test_pair_ids) or set(prediction_ids) != test_pair_ids:
            raise ValueError(f"{method} predictions do not cover each held-out pair exactly once.")
        counts = metric_counts(predictions, "score", result["threshold"])
        expected_counts = result["test_metrics"]
        for key in ("true_positive", "true_negative", "false_positive", "false_negative"):
            if counts[key] != expected_counts[key]:
                raise ValueError(f"{method} report confusion counts do not match predictions ({key}).")
        fp_ids = {row["pair_id"] for row in result["false_positives"]}
        fn_ids = {row["pair_id"] for row in result["false_negatives"]}
        predicted_fp = {row["pair_id"] for row in predictions if row["expected"] == "unrelated" and row["predicted"] == "related"}
        predicted_fn = {row["pair_id"] for row in predictions if row["expected"] == "related" and row["predicted"] == "unrelated"}
        if fp_ids != predicted_fp or fn_ids != predicted_fn:
            raise ValueError(f"{method} false-positive/negative rationale lists do not match its predictions.")


def print_method(name: str, result: dict[str, Any]) -> None:
    metrics = result["test_metrics"]
    print(f"\n{name} · {result['score_type']} · development threshold={result['threshold']:.4f}")
    print(
        f"  held-out confusion: TP={metrics['true_positive']} TN={metrics['true_negative']} "
        f"FP={metrics['false_positive']} FN={metrics['false_negative']} · n={metrics['n']}"
    )
    print(
        f"  precision={metrics['precision']} recall={metrics['recall']} "
        f"F1={metrics['f1']} accuracy={metrics['accuracy']}"
    )
    print(f"  false positives: {len(result['false_positives'])}; false negatives: {len(result['false_negatives'])}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", choices=["minilm", "labse"], default=["minilm", "labse"],
                        help="Models to try from the existing local Hugging Face cache only; no downloads occur.")
    args = parser.parse_args()

    pairs = load_json(DATA / "complaint_pairs.json")
    labels = load_json(DATA / "labels.json")
    validate_dataset(pairs, labels)
    label_by_id = {label["pair_id"]: label for label in labels}
    dev_pairs = [pair for pair in pairs if pair["split"] == "dev"]
    test_pairs = [pair for pair in pairs if pair["split"] == "test"]

    # Fit token IDF from development complaint records only, excluding all test text.
    dev_texts = [pair[key] for pair in dev_pairs for key in ("a_text", "b_text")]
    dev_tokens = [tokens(text) for text in dev_texts]
    inverse_document_frequencies = idf_scores(dev_tokens)
    text_tokens = {text: tokens(text) for pair in pairs for text in (pair["a_text"], pair["b_text"])}
    raw_rows = []
    for pair in pairs:
        a_tokens, b_tokens = text_tokens[pair["a_text"]], text_tokens[pair["b_text"]]
        raw_rows.append({
            **pair,
            "jaccard": jaccard(a_tokens, b_tokens),
            "idf_weighted": idf_cosine(a_tokens, b_tokens, inverse_document_frequencies),
        })

    # Labels are attached only after all lexical scores have been computed.
    scored_rows = [{**row, **label_by_id[row["pair_id"]]} for row in raw_rows]
    development = [row for row in scored_rows if row["split"] == "dev"]
    test = [row for row in scored_rows if row["split"] == "test"]

    results: dict[str, Any] = {}
    for method, title in (("jaccard", "Jaccard"), ("idf_weighted", "IDF-weighted cosine")):
        result = result_for_method(
            [row for row in test], [row for row in development], method,
            "Jaccard lexical similarity" if method == "jaccard" else "IDF-weighted lexical cosine similarity",
        )
        results[title] = result
        print_method(title, result)

    model_status: dict[str, Any] = {}
    try:
        import numpy as np
        from huggingface_hub import snapshot_download
        from huggingface_hub.errors import LocalEntryNotFoundError
        from sentence_transformers import SentenceTransformer
    except ImportError as error:
        for model_key in args.models:
            display_name, model_id = MODEL_IDS[model_key]
            model_status[display_name] = {"status": "skipped", "model_id": model_id, "reason": f"Local ML dependencies unavailable: {error.name}"}
    else:
        for model_key in args.models:
            display_name, model_id = MODEL_IDS[model_key]
            try:
                local_model_path = snapshot_download(model_id, local_files_only=True)
            except (LocalEntryNotFoundError, OSError) as error:
                model_status[display_name] = {
                    "status": "skipped-not-cached", "model_id": model_id,
                    "reason": f"Model is not fully available in the local cache ({type(error).__name__}); no download attempted.",
                }
                print(f"\n{display_name} skipped: weights not available in local cache; no download attempted.")
                continue

            cache_before = cache_bytes()
            rss_before = peak_rss_bytes()
            load_started = time.perf_counter()
            model = SentenceTransformer(local_model_path, device="cpu", local_files_only=True)
            load_seconds = time.perf_counter() - load_started
            rss_after_load = peak_rss_bytes()

            corpus_texts = sorted(text_tokens)
            inference_started = time.perf_counter()
            embeddings = model.encode(
                corpus_texts, batch_size=16, normalize_embeddings=True,
                convert_to_numpy=True, show_progress_bar=False,
            )
            inference_seconds = time.perf_counter() - inference_started
            embedding_by_text = {text: embeddings[index] for index, text in enumerate(corpus_texts)}
            model_key_in_scores = model_key
            for row in raw_rows:
                left = embedding_by_text[row["a_text"]]
                right = embedding_by_text[row["b_text"]]
                row[model_key_in_scores] = float(np.clip(np.dot(left, right), -1.0, 1.0))

            # Labels are read for threshold fitting only after embeddings for every pair exist.
            model_scored = [{**row, **label_by_id[row["pair_id"]]} for row in raw_rows]
            model_dev = [row for row in model_scored if row["split"] == "dev"]
            model_test = [row for row in model_scored if row["split"] == "test"]
            model_result = result_for_method(
                model_test, model_dev, model_key,
                "cosine similarity of L2-normalized sentence embeddings",
            )
            model_result.update({
                "model_id": model_id,
                "weights_source": "pre-existing local cache; inference and metrics freshly recomputed",
                "device": "CPU",
                "loading_seconds_cached_weights": round(load_seconds, 3),
                "inference_seconds": round(inference_seconds, 3),
                "process_peak_rss_after_load_bytes": rss_after_load,
                "process_peak_rss_delta_from_before_load_bytes": max(0, rss_after_load - rss_before),
                "cache_bytes_added": max(0, cache_bytes() - cache_before),
            })
            results[display_name] = model_result
            model_status[display_name] = {"status": "evaluated", "model_id": model_id, "weights_source": "cached-local"}
            print_method(display_name, model_result)
            print(
                f"  cached model load={load_seconds:.2f}s, inference={inference_seconds:.2f}s, "
                f"process peak RSS={rss_after_load / (1024 ** 2):.0f} MiB (cumulative process high-water mark)"
            )
            print("  held-out per-pair scores:")
            for prediction in model_result["predictions"]:
                print(f"    {prediction['pair_id']}: {prediction['score']:.4f} → {prediction['predicted']} (expected {prediction['expected']})")
            del model

    split_counts = {
        split: {
            "pairs": sum(pair["split"] == split for pair in pairs),
            "groups": len({pair["scenario_group"] for pair in pairs if pair["split"] == split}),
            "related": sum(label_by_id[pair["pair_id"]]["expected"] == "related" for pair in pairs if pair["split"] == split),
            "unrelated": sum(label_by_id[pair["pair_id"]]["expected"] == "unrelated" for pair in pairs if pair["split"] == split),
        }
        for split in ("dev", "test")
    }
    report = {
        "notice": "Synthetic evaluation only; these examples do not establish real-world accuracy.",
        "run": {
            "completed_at_utc": datetime.now(timezone.utc).isoformat(),
            "python_version": sys.version.split()[0], "platform": sys.platform,
            "scores_freshly_computed": True,
            "model_weights_policy": "local cache only; evaluator makes no model download requests",
            "model_status": model_status,
        },
        "label_note": "Expected labels and rationales are separate from model inputs; manually assigned synthetic judgments have not been independently reviewed by a domain or native-language expert.",
        "split_method": "Scenario groups are assigned wholly to development or test before threshold selection. The same scenario_group never occurs in both splits.",
        "split_counts": split_counts,
        "threshold_policy": "Each method's threshold maximizes development F1 only; ties choose the higher threshold. Held-out test labels are used once for reporting.",
        "idf_formula": "idf(t)=ln((N_dev+1)/(df_dev(t)+1))+1; IDF is fit from development complaint texts only.",
        "model_results": results,
        "test_pairs": [
            {"pair_id": row["pair_id"], "scenario_group": row["scenario_group"],
             "expected": row["expected"], "language": row["language"],
             "kind": row["kind"], "rationale": row["rationale"]}
            for row in test
        ],
    }
    validate_report(report, {row["pair_id"] for row in test})
    output = ROOT / "results" / "latest.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nDataset validation passed: {len(pairs)} pairs / {len(group_splits := {p['scenario_group'] for p in pairs})} groups; split groups do not overlap.")
    print(f"Model status: {json.dumps(model_status, ensure_ascii=False)}")
    print(f"Full report: {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
