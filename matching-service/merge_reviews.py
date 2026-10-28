#!/usr/bin/env python3
"""Validate a completed review packet and save separate adjudicated labels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ALLOWED_JUDGMENTS = {"related", "unrelated", "uncertain"}
REQUIRED_TEXT_FIELDS = (
    "reviewer_1_rationale",
    "reviewer_2_rationale",
    "adjudication_rationale",
)
REQUIRED_FIELDS = (
    "pair_id",
    "scenario_group",
    "language_script_category",
    "complaint_a_text",
    "complaint_b_text",
    "reviewer_1_judgment",
    "reviewer_1_rationale",
    "reviewer_2_judgment",
    "reviewer_2_rationale",
    "final_adjudicated_judgment",
    "adjudication_rationale",
)


def load_packet(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as source:
        packet = json.load(source)
    if not isinstance(packet, list) or not packet:
        raise ValueError("Input must be a non-empty review packet JSON array.")

    pair_ids: set[str] = set()
    for index, entry in enumerate(packet, start=1):
        if not isinstance(entry, dict):
            raise ValueError(f"Entry {index} must be an object.")
        extra = sorted(set(entry) - set(REQUIRED_FIELDS))
        if extra:
            raise ValueError(f"Entry {index} contains unsupported fields: {', '.join(extra)}")
        missing = [field for field in REQUIRED_FIELDS if field not in entry]
        if missing:
            raise ValueError(f"Entry {index} is missing fields: {', '.join(missing)}")
        pair_id = entry["pair_id"]
        if not isinstance(pair_id, str) or not pair_id.strip() or pair_id in pair_ids:
            raise ValueError(f"Entry {index} has a missing or duplicate pair_id.")
        pair_ids.add(pair_id)
        for field in ("reviewer_1_judgment", "reviewer_2_judgment", "final_adjudicated_judgment"):
            if entry[field] not in ALLOWED_JUDGMENTS:
                raise ValueError(f"{pair_id}: {field} must be related, unrelated, or uncertain.")
        for field in REQUIRED_TEXT_FIELDS:
            if not isinstance(entry[field], str) or not entry[field].strip():
                raise ValueError(f"{pair_id}: {field} must contain a rationale.")
        for field in ("scenario_group", "language_script_category", "complaint_a_text", "complaint_b_text"):
            if not isinstance(entry[field], str) or not entry[field].strip():
                raise ValueError(f"{pair_id}: {field} cannot be empty.")
    return packet


def validate_against_blank_packet(completed: list[dict[str, Any]]) -> None:
    blank_path = Path(__file__).resolve().parent / "data" / "review_packet.json"
    with blank_path.open(encoding="utf-8") as source:
        blank = json.load(source)
    blank_by_id = {entry["pair_id"]: entry for entry in blank}
    completed_by_id = {entry["pair_id"]: entry for entry in completed}
    if set(blank_by_id) != set(completed_by_id):
        raise ValueError("Completed packet must include every canonical pair exactly once.")
    fixed_fields = ("scenario_group", "language_script_category", "complaint_a_text", "complaint_b_text")
    for pair_id, original in blank_by_id.items():
        if any(completed_by_id[pair_id][field] != original[field] for field in fixed_fields):
            raise ValueError(f"{pair_id}: packet metadata or original complaint text was changed.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Path to a completed copy of review_packet.json.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("matching-service/data/adjudicated_labels.json"),
        help="New output path; existing files are never overwritten.",
    )
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Input and output paths must differ.")

    packet = load_packet(args.input)
    validate_against_blank_packet(packet)
    report = {
        "notice": "Independent review submission; judgments are reviewer-provided and not model outputs.",
        "source_packet": str(args.input),
        "pair_count": len(packet),
        "adjudicated_labels": packet,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with args.output.open("x", encoding="utf-8") as destination:
            json.dump(report, destination, ensure_ascii=False, indent=2)
            destination.write("\n")
    except FileExistsError:
        parser.error(f"Output already exists and will not be overwritten: {args.output}")
    print(f"Validated {len(packet)} reviewed pairs; wrote {args.output} without changing source labels or results.")


if __name__ == "__main__":
    main()
