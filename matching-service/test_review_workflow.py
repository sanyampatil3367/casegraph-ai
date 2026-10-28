"""Standard-library tests for the blinded, two-reviewer workflow."""

from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
PACKET_PATH = ROOT / "data" / "review_packet.json"
MAPPING_PATH = ROOT / "private" / "review_id_mapping.json"
CANONICAL_PATH = ROOT / "data" / "complaint_pairs.json"
LABELS_PATH = ROOT / "data" / "labels.json"
REPORT_PATH = ROOT / "results" / "latest.json"
SCRIPT_PATH = ROOT / "merge_reviews.py"
REVIEW_FIELDS = {"pair_id", "scenario_group", "complaint_a_text", "complaint_b_text", "judgment", "rationale"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ReviewWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.packet = json.loads(PACKET_PATH.read_text(encoding="utf-8"))
        cls.mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))["pairs"]
        cls.canonical = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
        cls.baseline_hashes = {path: digest(path) for path in (CANONICAL_PATH, LABELS_PATH, REPORT_PATH)}

    @classmethod
    def tearDownClass(cls) -> None:
        for path, before in cls.baseline_hashes.items():
            if digest(path) != before:
                raise AssertionError(f"Baseline input changed during workflow tests: {path}")

    def completed(self, judgment: str = "related") -> list[dict[str, str]]:
        result = copy.deepcopy(self.packet)
        for row in result:
            row["judgment"] = judgment
            row["rationale"] = "Temporary test rationale."
        return result

    def run_cli(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(ROOT / ".venv" / "bin" / "python"), str(SCRIPT_PATH), *arguments],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=False,
        )

    def write_json(self, path: Path, value: object) -> None:
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def test_reviewer_packet_ids_are_opaque_and_metadata_is_blind(self) -> None:
        self.assertEqual(len(self.packet), 88)
        self.assertEqual({row["pair_id"] for row in self.packet}, {row["neutral_pair_id"] for row in self.mapping})
        self.assertEqual({row["pair_id"] for row in self.packet}, {str(uuid.UUID(row["pair_id"])) for row in self.packet})
        self.assertTrue(all(uuid.UUID(row["pair_id"]).version == 4 for row in self.packet))
        self.assertEqual({row["scenario_group"] for row in self.packet}, {row["neutral_scenario_id"] for row in self.mapping})
        forbidden = {"split", "expected", "kind", "rationale_note", "score", "similarity", "prediction", "predicted", "model", "model_name", "language_script_category"}
        for row in self.packet:
            self.assertEqual(set(row), REVIEW_FIELDS)
            self.assertFalse(forbidden.intersection(row))
            self.assertNotIn("dev-", row["pair_id"] + row["scenario_group"])
            self.assertNotIn("test-", row["pair_id"] + row["scenario_group"])
        canonical_ids = {row["pair_id"] for row in self.canonical}
        canonical_by_id = {row["pair_id"]: row for row in self.canonical}
        canonical_groups = {row["scenario_group"] for row in self.canonical}
        self.assertTrue(canonical_ids.isdisjoint({row["pair_id"] for row in self.packet}))
        self.assertTrue(canonical_groups.isdisjoint({row["scenario_group"] for row in self.packet}))
        mapping_by_neutral = {row["neutral_pair_id"]: row for row in self.mapping}
        for row in self.packet:
            mapping = mapping_by_neutral[row["pair_id"]]
            source = canonical_by_id[mapping["canonical_pair_id"]]
            self.assertEqual(row["complaint_a_text"], source["a_text"])
            self.assertEqual(row["complaint_b_text"], source["b_text"])
            self.assertEqual(row["scenario_group"], mapping["neutral_scenario_id"])
        for reviewer_file in (PACKET_PATH, ROOT / "REVIEW_INSTRUCTIONS.md"):
            data = reviewer_file.read_text(encoding="utf-8")
            self.assertNotIn("review_id_mapping.json", data)
            self.assertFalse(any(value in data for value in canonical_ids))

    def test_reviewer_copies_have_same_text_and_no_other_review_fields(self) -> None:
        reviewer_one = copy.deepcopy(self.packet)
        reviewer_two = copy.deepcopy(self.packet)
        self.assertEqual(reviewer_one, reviewer_two)
        for row in reviewer_one + reviewer_two:
            self.assertEqual(set(row), REVIEW_FIELDS)
            self.assertNotIn("reviewer_1_judgment", row)
            self.assertNotIn("reviewer_2_judgment", row)
            self.assertEqual(row["judgment"], "")
            self.assertEqual(row["rationale"], "")

    def test_mapping_is_ignored_and_owner_only(self) -> None:
        check = subprocess.run(["git", "check-ignore", "--quiet", str(MAPPING_PATH.relative_to(REPO))], cwd=REPO)
        self.assertEqual(check.returncode, 0)
        self.assertEqual(MAPPING_PATH.stat().st_mode & 0o077, 0)

    def test_combine_preserves_conflict_and_uncertainty_then_finalize(self) -> None:
        first = self.completed("related")
        second = self.completed("unrelated")
        for row in first:
            row["judgment"] = "uncertain" if row is first[0] else "related"
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            one, two = directory / "one.json", directory / "two.json"
            workspace_path = directory / "workspace.json"
            self.write_json(one, first)
            self.write_json(two, second)
            combined = self.run_cli("combine", "--reviewer-1", str(one), "--reviewer-2", str(two), "--output", str(workspace_path))
            self.assertEqual(combined.returncode, 0, combined.stderr)
            workspace = json.loads(workspace_path.read_text(encoding="utf-8"))["adjudication_workspace"]
            self.assertEqual(len(workspace), 88)
            target_canonical_id = next(row["canonical_pair_id"] for row in self.mapping if row["neutral_pair_id"] == first[0]["pair_id"])
            target_workspace_row = next(row for row in workspace if row["pair_id"] == target_canonical_id)
            self.assertEqual(target_workspace_row["reviewer_1_judgment"], "uncertain")
            self.assertEqual(target_workspace_row["reviewer_2_judgment"], "unrelated")
            self.assertEqual(target_workspace_row["final_adjudicated_judgment"], "")

            final_path = directory / "final.json"
            incomplete = self.run_cli("finalize", "--input", str(workspace_path), "--output", str(final_path))
            self.assertNotEqual(incomplete.returncode, 0)
            self.assertFalse(final_path.exists())

            for row in workspace:
                row["final_adjudicated_judgment"] = "uncertain"
                row["adjudication_rationale"] = "Owner retained uncertainty pending adequate language evidence."
            self.write_json(workspace_path, {"adjudication_workspace": workspace})
            finalized = self.run_cli("finalize", "--input", str(workspace_path), "--output", str(final_path))
            self.assertEqual(finalized.returncode, 0, finalized.stderr)
            final_rows = json.loads(final_path.read_text(encoding="utf-8"))["adjudicated_labels"]
            target_final_row = next(row for row in final_rows if row["pair_id"] == target_canonical_id)
            self.assertEqual(target_final_row["reviewer_1_judgment"], "uncertain")
            self.assertEqual(target_final_row["reviewer_2_judgment"], "unrelated")
            self.assertEqual(target_final_row["final_adjudicated_judgment"], "uncertain")

    def test_rejects_missing_extra_duplicate_unknown_and_incomplete_submissions(self) -> None:
        good = self.completed()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            second_path = directory / "second.json"
            self.write_json(second_path, good)
            cases: list[tuple[str, list[dict[str, object]]]] = [
                ("missing", good[:-1]),
                ("extra", good + [{**good[0], "pair_id": str(uuid.uuid4())}]),
                ("duplicate", good + [copy.deepcopy(good[0])]),
                ("unknown", [{**good[0], "pair_id": str(uuid.uuid4())}, *good[1:]]),
                ("invalid", [{**good[0], "judgment": "maybe"}, *good[1:]]),
                ("malformed-judgment", [{**good[0], "judgment": ["related"]}, *good[1:]]),
                ("blank-rationale", [{**good[0], "rationale": ""}, *good[1:]]),
                ("blank-judgment", [{**good[0], "judgment": ""}, *good[1:]]),
                ("edited-text", [{**good[0], "complaint_a_text": "changed"}, *good[1:]]),
                ("edited-group", [{**good[0], "scenario_group": str(uuid.uuid4())}, *good[1:]]),
            ]
            for name, rows in cases:
                with self.subTest(name=name):
                    first_path = directory / f"{name}.json"
                    output_path = directory / f"{name}-workspace.json"
                    self.write_json(first_path, rows)
                    result = self.run_cli("combine", "--reviewer-1", str(first_path), "--reviewer-2", str(second_path), "--output", str(output_path))
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output_path.exists())

    def test_existing_outputs_are_never_overwritten(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            first, second, output = directory / "first.json", directory / "second.json", directory / "workspace.json"
            self.write_json(first, self.completed())
            self.write_json(second, self.completed())
            output.write_text("preserve me", encoding="utf-8")
            result = self.run_cli("combine", "--reviewer-1", str(first), "--reviewer-2", str(second), "--output", str(output))
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(output.read_text(encoding="utf-8"), "preserve me")

    def test_reviewers_must_submit_separate_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            packet_path = directory / "one-submission.json"
            self.write_json(packet_path, self.completed())
            output_path = directory / "workspace.json"
            result = self.run_cli(
                "combine", "--reviewer-1", str(packet_path), "--reviewer-2", str(packet_path), "--output", str(output_path)
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output_path.exists())

    def test_evaluator_does_not_consume_adjudicated_labels(self) -> None:
        evaluator = (ROOT / "evaluate.py").read_text(encoding="utf-8")
        self.assertIn('DATA / "labels.json"', evaluator)
        self.assertNotIn("adjudicated_labels", evaluator)


if __name__ == "__main__":
    unittest.main()
