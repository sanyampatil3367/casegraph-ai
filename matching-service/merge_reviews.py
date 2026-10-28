#!/usr/bin/env python3
"""Combine two blinded submissions and finalize owner-adjudicated labels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CANONICAL_DATA = ROOT / "data" / "complaint_pairs.json"
OWNER_MAPPING = ROOT / "private" / "review_id_mapping.json"
ALLOWED_JUDGMENTS = {"related", "unrelated", "uncertain"}
REVIEW_FIELDS = {"pair_id", "scenario_group", "complaint_a_text", "complaint_b_text", "judgment", "rationale"}
WORKSPACE_FIELDS = {
    "pair_id", "scenario_group", "complaint_a_text", "complaint_b_text",
    "reviewer_1_judgment", "reviewer_1_rationale",
    "reviewer_2_judgment", "reviewer_2_rationale",
    "final_adjudicated_judgment", "adjudication_rationale",
}


def read_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as source:
            return json.load(source)
    except FileNotFoundError as error:
        raise ValueError(f"Required file not found: {path}") from error


def load_owner_context(mapping_path: Path, canonical_path: Path) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    mapping_data = read_json(mapping_path)
    mapping = mapping_data.get("pairs") if isinstance(mapping_data, dict) else None
    canonical_rows = read_json(canonical_path)
    if not isinstance(mapping, list) or not isinstance(canonical_rows, list):
        raise ValueError("Owner mapping and canonical complaint data must be JSON arrays/objects in the expected format.")

    canonical_by_id = {row.get("pair_id"): row for row in canonical_rows}
    if len(canonical_by_id) != len(canonical_rows) or None in canonical_by_id:
        raise ValueError("Canonical complaint pair IDs must be present and unique.")

    neutral_by_id: dict[str, dict[str, str]] = {}
    canonical_ids: set[str] = set()
    neutral_group_by_canonical: dict[str, str] = {}
    canonical_group_by_neutral: dict[str, str] = {}
    for row in mapping:
        if not isinstance(row, dict):
            raise ValueError("Every private mapping entry must be an object.")
        neutral_id = row.get("neutral_pair_id")
        canonical_id = row.get("canonical_pair_id")
        neutral_group = row.get("neutral_scenario_id")
        canonical_group = row.get("canonical_scenario_group")
        if not all(isinstance(value, str) and value for value in (neutral_id, canonical_id, neutral_group, canonical_group)):
            raise ValueError("Private mapping entries need all neutral and canonical IDs.")
        if neutral_id in neutral_by_id or canonical_id in canonical_ids:
            raise ValueError("Neutral and canonical pair mappings must each be unique.")
        source = canonical_by_id.get(canonical_id)
        if source is None or source.get("scenario_group") != canonical_group:
            raise ValueError(f"Private mapping does not match canonical pair {canonical_id}.")
        prior_neutral = neutral_group_by_canonical.setdefault(canonical_group, neutral_group)
        prior_canonical = canonical_group_by_neutral.setdefault(neutral_group, canonical_group)
        if prior_neutral != neutral_group or prior_canonical != canonical_group:
            raise ValueError("Neutral scenario groups must map one-to-one to canonical scenario groups.")
        neutral_by_id[neutral_id] = row
        canonical_ids.add(canonical_id)

    if canonical_ids != set(canonical_by_id):
        raise ValueError("Private mapping must cover every canonical pair exactly once.")
    return neutral_by_id, canonical_by_id


def validate_review_submission(
    path: Path,
    reviewer_name: str,
    neutral_by_id: dict[str, dict[str, str]],
    canonical_by_id: dict[str, dict[str, str]],
) -> dict[str, dict[str, str]]:
    rows = read_json(path)
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"{reviewer_name} submission must be a non-empty JSON array.")
    by_id: dict[str, dict[str, str]] = {}
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict) or set(row) != REVIEW_FIELDS:
            raise ValueError(f"{reviewer_name} entry {index} must contain exactly the neutral reviewer fields.")
        pair_id = row.get("pair_id")
        if not isinstance(pair_id, str) or pair_id not in neutral_by_id:
            raise ValueError(f"{reviewer_name} entry {index} has an unknown pair ID.")
        if pair_id in by_id:
            raise ValueError(f"{reviewer_name} has a duplicate pair ID: {pair_id}.")
        mapping_row = neutral_by_id[pair_id]
        source = canonical_by_id[mapping_row["canonical_pair_id"]]
        if row["scenario_group"] != mapping_row["neutral_scenario_id"]:
            raise ValueError(f"{reviewer_name} changed the neutral scenario ID for {pair_id}.")
        if row["complaint_a_text"] != source["a_text"] or row["complaint_b_text"] != source["b_text"]:
            raise ValueError(f"{reviewer_name} changed original complaint text for {pair_id}.")
        if not isinstance(row["judgment"], str) or row["judgment"] not in ALLOWED_JUDGMENTS:
            raise ValueError(f"{reviewer_name} judgment for {pair_id} must be related, unrelated, or uncertain.")
        if not isinstance(row["rationale"], str) or not row["rationale"].strip():
            raise ValueError(f"{reviewer_name} rationale is required for {pair_id}.")
        by_id[pair_id] = row

    if set(by_id) != set(neutral_by_id):
        missing = len(set(neutral_by_id) - set(by_id))
        extra = len(set(by_id) - set(neutral_by_id))
        raise ValueError(f"{reviewer_name} must submit every neutral pair exactly once (missing={missing}, extra={extra}).")
    return by_id


def validate_workspace(
    path: Path,
    neutral_by_id: dict[str, dict[str, str]],
    canonical_by_id: dict[str, dict[str, str]],
    require_adjudication: bool,
) -> list[dict[str, Any]]:
    workspace = read_json(path)
    rows = workspace.get("adjudication_workspace") if isinstance(workspace, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError("Input must contain a non-empty adjudication_workspace array.")
    expected_canonical = {row["canonical_pair_id"] for row in neutral_by_id.values()}
    by_id: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict) or set(row) != WORKSPACE_FIELDS:
            raise ValueError(f"Workspace entry {index} must contain exactly the owner workspace fields.")
        pair_id = row["pair_id"]
        if not isinstance(pair_id, str) or pair_id not in expected_canonical:
            raise ValueError(f"Workspace entry {index} has an unknown canonical pair ID.")
        if pair_id in by_id:
            raise ValueError(f"Workspace has a duplicate pair ID: {pair_id}.")
        source = canonical_by_id[pair_id]
        if row["scenario_group"] != source["scenario_group"]:
            raise ValueError(f"Workspace scenario group changed for {pair_id}.")
        if row["complaint_a_text"] != source["a_text"] or row["complaint_b_text"] != source["b_text"]:
            raise ValueError(f"Workspace original complaint text changed for {pair_id}.")
        for reviewer in (1, 2):
            judgment = row[f"reviewer_{reviewer}_judgment"]
            rationale = row[f"reviewer_{reviewer}_rationale"]
            if not isinstance(judgment, str) or judgment not in ALLOWED_JUDGMENTS or not isinstance(rationale, str) or not rationale.strip():
                raise ValueError(f"Workspace needs a valid Reviewer {reviewer} judgment and rationale for {pair_id}.")
        if require_adjudication:
            final_judgment = row["final_adjudicated_judgment"]
            if not isinstance(final_judgment, str) or final_judgment not in ALLOWED_JUDGMENTS:
                raise ValueError(f"Final adjudication is required for {pair_id}.")
            rationale = row["adjudication_rationale"]
            if not isinstance(rationale, str) or not rationale.strip():
                raise ValueError(f"Adjudication rationale is required for {pair_id}.")
        else:
            if row["final_adjudicated_judgment"] != "" or row["adjudication_rationale"] != "":
                raise ValueError(f"New workspace must have blank final adjudication fields for {pair_id}.")
        by_id[pair_id] = row
    if set(by_id) != expected_canonical:
        raise ValueError("Workspace must contain every canonical pair exactly once.")
    return [by_id[pair_id] for pair_id in sorted(by_id)]


def write_new_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8") as destination:
            json.dump(data, destination, ensure_ascii=False, indent=2)
            destination.write("\n")
    except FileExistsError as error:
        raise ValueError(f"Output already exists and will not be overwritten: {path}") from error


def command_combine(args: argparse.Namespace) -> None:
    if args.reviewer_1.resolve() == args.reviewer_2.resolve():
        raise ValueError("Reviewer 1 and Reviewer 2 must submit separate files.")
    neutral_by_id, canonical_by_id = load_owner_context(args.mapping, args.canonical_data)
    reviewer_1 = validate_review_submission(args.reviewer_1, "Reviewer 1", neutral_by_id, canonical_by_id)
    reviewer_2 = validate_review_submission(args.reviewer_2, "Reviewer 2", neutral_by_id, canonical_by_id)
    rows = []
    for neutral_id in sorted(neutral_by_id):
        mapping_row = neutral_by_id[neutral_id]
        source = canonical_by_id[mapping_row["canonical_pair_id"]]
        first, second = reviewer_1[neutral_id], reviewer_2[neutral_id]
        rows.append({
            "pair_id": mapping_row["canonical_pair_id"],
            "scenario_group": mapping_row["canonical_scenario_group"],
            "complaint_a_text": source["a_text"],
            "complaint_b_text": source["b_text"],
            "reviewer_1_judgment": first["judgment"],
            "reviewer_1_rationale": first["rationale"],
            "reviewer_2_judgment": second["judgment"],
            "reviewer_2_rationale": second["rationale"],
            "final_adjudicated_judgment": "",
            "adjudication_rationale": "",
        })
    write_new_json(args.output, {
        "notice": "Owner-only adjudication workspace. Resolve reviewer disagreements explicitly; no labels are inferred.",
        "adjudication_workspace": rows,
    })
    print(f"Combined {len(rows)} independently submitted pairs into owner workspace {args.output}.")


def command_finalize(args: argparse.Namespace) -> None:
    neutral_by_id, canonical_by_id = load_owner_context(args.mapping, args.canonical_data)
    rows = validate_workspace(args.input, neutral_by_id, canonical_by_id, require_adjudication=True)
    labels = [{key: row[key] for key in (
        "pair_id", "scenario_group", "reviewer_1_judgment", "reviewer_1_rationale",
        "reviewer_2_judgment", "reviewer_2_rationale", "final_adjudicated_judgment", "adjudication_rationale",
    )} for row in rows]
    write_new_json(args.output, {
        "notice": "Owner-adjudicated review labels; not automatically consumed by the baseline evaluator.",
        "pair_count": len(labels),
        "adjudicated_labels": labels,
    })
    print(f"Wrote {len(labels)} adjudicated labels to separate output {args.output}.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    combine = commands.add_parser("combine", help="Validate two blinded submissions and create an owner-only workspace.")
    combine.add_argument("--reviewer-1", required=True, type=Path)
    combine.add_argument("--reviewer-2", required=True, type=Path)
    combine.add_argument("--output", required=True, type=Path)
    combine.add_argument("--mapping", type=Path, default=OWNER_MAPPING)
    combine.add_argument("--canonical-data", type=Path, default=CANONICAL_DATA)
    combine.set_defaults(handler=command_combine)

    finalize = commands.add_parser("finalize", help="Validate explicit owner adjudications and write a separate label file.")
    finalize.add_argument("--input", required=True, type=Path, help="Completed owner-only adjudication workspace.")
    finalize.add_argument("--output", required=True, type=Path)
    finalize.add_argument("--mapping", type=Path, default=OWNER_MAPPING)
    finalize.add_argument("--canonical-data", type=Path, default=CANONICAL_DATA)
    finalize.set_defaults(handler=command_finalize)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.handler(args)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
