"""Standard-library tests for local matching inference and the optional FastAPI app."""

from __future__ import annotations

import importlib.util
import math
import sys
import unittest
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from inference import (  # noqa: E402
    MAX_COMPLAINTS,
    MAX_REQUEST_BYTES,
    MODEL_ID,
    ComplaintText,
    InputValidationError,
    LocalSemanticMatcher,
    ModelUnavailableError,
    cosine_similarity,
    load_local_matcher,
    stable_pair_id,
    validate_complaints,
    validate_threshold,
)

API_DEPENDENCIES = ("fastapi", "starlette", "httpx")
MISSING_API_DEPENDENCIES = tuple(name for name in API_DEPENDENCIES if importlib.util.find_spec(name) is None)
if MISSING_API_DEPENDENCIES:
    create_app = None
    TestClient = None
else:
    from api import create_app  # noqa: E402
    from fastapi.testclient import TestClient  # noqa: E402
    from local_cors_app import wrap_for_vite  # noqa: E402


class FakeEncoder:
    def __init__(self, fail: bool = False) -> None:
        self.calls: list[tuple[list[str], dict[str, Any]]] = []
        self.fail = fail

    def encode(self, texts: list[str], **options: Any) -> list[list[float]]:
        self.calls.append((texts, options))
        if self.fail:
            raise RuntimeError("fixture inference failure")
        vectors = {
            "alpha": [1.0, 0.0],
            "beta": [0.8, 0.6],
            "gamma": [0.0, 1.0],
            "opposite": [-1.0, 0.0],
        }
        return [vectors.get(text, [1.0, 0.0]) for text in texts]


def sample_records() -> list[dict[str, str]]:
    return [
        {"id": "c-3", "original_text": "gamma"},
        {"id": "c-1", "original_text": "alpha"},
        {"id": "c-2", "original_text": "beta"},
    ]


def unexpected_model_loader() -> LocalSemanticMatcher:
    raise AssertionError("API tests must use injected fake inference, not load a real model.")


class InferenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.encoder = FakeEncoder()
        self.matcher = LocalSemanticMatcher(self.encoder)

    def test_rejects_missing_fields_blank_text_and_duplicate_ids(self) -> None:
        with self.assertRaises(InputValidationError):
            validate_complaints([{"original_text": "alpha"}, {"id": "two", "original_text": "beta"}])
        with self.assertRaises(InputValidationError):
            validate_complaints([{"id": "one", "original_text": " "}, {"id": "two", "original_text": "beta"}])
        with self.assertRaises(InputValidationError):
            validate_complaints([{"id": "same", "original_text": "alpha"}, {"id": "same", "original_text": "beta"}])
        with self.assertRaises(InputValidationError):
            validate_complaints([{"id": "one", "original_text": "alpha", "expected": "related"}, {"id": "two", "original_text": "beta"}])

    def test_rejects_excessive_or_too_small_batches(self) -> None:
        too_many = [{"id": f"c-{index}", "original_text": "alpha"} for index in range(MAX_COMPLAINTS + 1)]
        with self.assertRaises(InputValidationError):
            validate_complaints(too_many)
        with self.assertRaises(InputValidationError):
            validate_complaints([{"id": "only-one", "original_text": "alpha"}])
        with self.assertRaises(InputValidationError):
            validate_complaints([
                {"id": "one", "original_text": "x" * 8_001},
                {"id": "two", "original_text": "beta"},
            ])

    def test_validates_threshold_range_and_finiteness(self) -> None:
        for threshold in (-1.01, 1.01, math.nan, math.inf, "0.5", True):
            with self.subTest(threshold=threshold), self.assertRaises(InputValidationError):
                validate_threshold(threshold)
        self.assertEqual(validate_threshold(0.5), 0.5)

    def test_cosine_handles_normalized_and_unnormalized_vectors(self) -> None:
        self.assertAlmostEqual(cosine_similarity([3, 4], [6, 8]), 1.0)
        self.assertAlmostEqual(cosine_similarity([1, 0], [0, 1]), 0.0)
        self.assertAlmostEqual(cosine_similarity([0, 0], [1, 0]), 0.0)
        with self.assertRaises(ValueError):
            cosine_similarity([1, 2], [1])

    def test_pair_ids_and_ranking_are_deterministic_for_input_order(self) -> None:
        pairs = self.matcher.match(sample_records(), threshold=-1.0)
        reverse_pairs = self.matcher.match(list(reversed(sample_records())), threshold=-1.0)
        self.assertEqual([pair.pair_id for pair in pairs], [pair.pair_id for pair in reverse_pairs])
        self.assertEqual(pairs[0].pair_id, stable_pair_id("c-1", "c-2"))
        self.assertEqual(stable_pair_id("c-1", "c-2"), stable_pair_id("c-2", "c-1"))

    def test_generates_only_distinct_unique_unreversed_pairs(self) -> None:
        matches = self.matcher.match(sample_records(), threshold=-1.0)
        self.assertEqual(len(matches), 3)
        ids = [pair.pair_id for pair in matches]
        self.assertEqual(len(ids), len(set(ids)))
        for pair in matches:
            self.assertNotEqual(pair.complaint_a_id, pair.complaint_b_id)
            self.assertEqual(pair.complaint_a_id, min(pair.complaint_a_id, pair.complaint_b_id))

    def test_original_text_is_passed_unchanged_and_encoder_reused(self) -> None:
        text = "  Original mixed-language complaint text.  "
        records = [{"id": "one", "original_text": text}, {"id": "two", "original_text": "beta"}]
        self.matcher.match(records, threshold=-1.0)
        self.matcher.match(records, threshold=-1.0)
        self.assertEqual(self.encoder.calls[0][0], [text, "beta"])
        self.assertEqual(len(self.encoder.calls), 2)
        self.assertTrue(self.encoder.calls[0][1]["normalize_embeddings"])
        self.assertTrue(self.encoder.calls[0][1]["convert_to_numpy"])

    def test_threshold_filters_pairs_without_changing_score_semantics(self) -> None:
        matches = self.matcher.match(sample_records(), threshold=0.75)
        self.assertEqual(len(matches), 1)
        self.assertAlmostEqual(matches[0].similarity, 0.8)
        self.assertEqual(self.matcher.model_id, MODEL_ID)

    def test_model_loader_is_local_only_and_constructs_encoder_once(self) -> None:
        resolver_calls: list[tuple[str, bool]] = []
        factory_calls: list[tuple[str, str, bool]] = []
        encoder = FakeEncoder()

        def resolver(model_id: str, *, local_files_only: bool) -> str:
            resolver_calls.append((model_id, local_files_only))
            return "/fixture/local-snapshot"

        def factory(path: str, *, device: str, local_files_only: bool) -> FakeEncoder:
            factory_calls.append((path, device, local_files_only))
            return encoder

        matcher = load_local_matcher(snapshot_resolver=resolver, encoder_factory=factory)
        self.assertEqual(resolver_calls, [(MODEL_ID, True)])
        self.assertEqual(factory_calls, [("/fixture/local-snapshot", "cpu", True)])
        self.assertIs(matcher._encoder, encoder)

    def test_missing_cached_weights_fail_without_retry_or_encoder_load(self) -> None:
        resolver_calls: list[bool] = []
        factory_calls: list[str] = []

        def resolver(_model_id: str, *, local_files_only: bool) -> str:
            resolver_calls.append(local_files_only)
            raise FileNotFoundError("not cached")

        def factory(path: str, **_options: Any) -> FakeEncoder:
            factory_calls.append(path)
            return FakeEncoder()

        with self.assertRaisesRegex(ModelUnavailableError, "automatic downloads are disabled"):
            load_local_matcher(snapshot_resolver=resolver, encoder_factory=factory)
        self.assertEqual(resolver_calls, [True])
        self.assertEqual(factory_calls, [])

    def test_inference_and_api_do_not_read_evaluation_or_review_inputs(self) -> None:
        forbidden = ("labels.json", "results/latest.json", "review_id_mapping.json", "complaint_pairs.json")
        for filename in (ROOT / "inference.py", ROOT / "api.py"):
            source = filename.read_text(encoding="utf-8")
            for phrase in forbidden:
                with self.subTest(file=filename.name, phrase=phrase):
                    self.assertNotIn(phrase, source)


@unittest.skipIf(
    MISSING_API_DEPENDENCIES,
    "API test dependencies are missing: " + ", ".join(MISSING_API_DEPENDENCIES),
)
class ApiTests(unittest.TestCase):
    def test_cors_allows_only_loopback_vite_origins(self) -> None:
        app = wrap_for_vite(create_app(matcher=object(), matcher_loader=unexpected_model_loader))
        with TestClient(app) as client:
            allowed = client.options("/api/v1/matches", headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            self.assertEqual(allowed.status_code, 200)
            self.assertEqual(allowed.headers["access-control-allow-origin"], "http://localhost:5173")

            blocked = client.options("/api/v1/matches", headers={
                "Origin": "https://example.invalid",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            self.assertEqual(blocked.status_code, 400)
            self.assertNotIn("access-control-allow-origin", blocked.headers)

    def test_api_schemas_health_success_and_safe_inference_error(self) -> None:
        matcher = LocalSemanticMatcher(FakeEncoder())
        app = create_app(matcher=matcher, matcher_loader=unexpected_model_loader)
        with TestClient(app) as client:
            health = client.get("/health")
            self.assertEqual(health.status_code, 200)
            self.assertEqual(health.json(), {"status": "running", "model_ready": True, "model_id": MODEL_ID})

            response = client.post("/api/v1/matches", json={
                "complaints": sample_records(),
                "threshold": 0.5,
            })
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(set(body), {"model_id", "score_type", "score_semantics", "threshold", "matches"})
            self.assertEqual(body["model_id"], MODEL_ID)
            self.assertEqual(body["score_type"], "cosine_similarity")
            self.assertIn("not a probability or confidence", body["score_semantics"])
            self.assertEqual(body["matches"], sorted(body["matches"], key=lambda pair: (-pair["similarity"], pair["pair_id"])))
            self.assertTrue(all(set(pair) == {"pair_id", "complaint_a_id", "complaint_b_id", "similarity"} for pair in body["matches"]))

        failing_app = create_app(
            matcher=LocalSemanticMatcher(FakeEncoder(fail=True)),
            matcher_loader=unexpected_model_loader,
        )
        with TestClient(failing_app) as client:
            failed = client.post("/api/v1/matches", json={
                "complaints": sample_records(), "threshold": 0.0,
            })
            self.assertEqual(failed.status_code, 500)
            self.assertEqual(failed.json(), {"detail": "Local inference failed."})

    def test_api_rejects_invalid_inputs_and_oversize_body(self) -> None:
        app = create_app(matcher=LocalSemanticMatcher(FakeEncoder()), matcher_loader=unexpected_model_loader)
        with TestClient(app) as client:
            invalid = client.post("/api/v1/matches", json={
                "complaints": sample_records(), "threshold": 1.2,
            })
            self.assertEqual(invalid.status_code, 422)
            self.assertEqual(invalid.json(), {"detail": "Invalid match request."})
            self.assertNotIn("alpha", invalid.text)
            extra = client.post("/api/v1/matches", json={
                "complaints": sample_records(), "threshold": 0.0, "labels": [],
            })
            self.assertEqual(extra.status_code, 422)
            too_many = [{"id": str(index), "original_text": "text"} for index in range(MAX_COMPLAINTS + 1)]
            excessive = client.post("/api/v1/matches", json={
                "complaints": too_many, "threshold": 0.0,
            })
            self.assertEqual(excessive.status_code, 422)
            complaint_text = "private complaint content " * 100_000
            oversized = client.post("/api/v1/matches", content=complaint_text.encode())
            self.assertEqual(oversized.status_code, 413)
            self.assertNotIn("private complaint content", oversized.text)

    def test_model_loader_runs_once_and_not_ready_service_returns_503(self) -> None:
        calls: list[int] = []
        matcher = LocalSemanticMatcher(FakeEncoder())

        def loader() -> LocalSemanticMatcher:
            calls.append(1)
            return matcher

        app = create_app(matcher_loader=loader)

        with TestClient(app) as client:
            self.assertTrue(client.get("/health").json()["model_ready"])
            request = {"complaints": sample_records(), "threshold": 0.0}
            self.assertEqual(client.post("/api/v1/matches", json=request).status_code, 200)
            self.assertEqual(client.post("/api/v1/matches", json=request).status_code, 200)
        self.assertEqual(calls, [1])

        def missing_model() -> LocalSemanticMatcher:
            raise ModelUnavailableError("missing local weights")

        unavailable_app = create_app(matcher_loader=missing_model)

        with TestClient(unavailable_app) as client:
            self.assertFalse(client.get("/health").json()["model_ready"])
            request = {"complaints": sample_records(), "threshold": 0.0}
            response = client.post("/api/v1/matches", json=request)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json(), {"detail": "Local matching model is not ready."})
