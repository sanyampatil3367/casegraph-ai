# Independent multilingual pair review instructions

This packet contains fictional synthetic complaint text for evaluation preparation. No reviewer identities, qualifications, judgments, or expert review are asserted here. Complete only the blank review fields in a copy of `data/review_packet.json`.

## Judgment definitions

- **Related:** Both complaints describe the same underlying issue or incident and could reasonably be investigated together.
- **Unrelated:** They describe different underlying issues or incidents. Similar topics, institutions, services, or repeated keywords alone are not enough to call a pair related.
- **Uncertain:** Use this when the text, language, script, or context does not support a reliable judgment. Do not force a guess.

Judge meaning, not word overlap. Pay particular attention to negation and opposite outcomes: for example, a service reported as missing is not the same issue as a report that it is operating as expected. Consider whether two reports refer to the same incident, not only the same service category.

## Independent review and adjudication

1. Each reviewer fills their own judgment and concise rationale without seeing the other reviewer's entries. Do not add names or personal information to this packet.
2. After both reviews are complete, resolve disagreements through discussion by qualified reviewers familiar with the relevant language/script. Record the result in `final_adjudicated_judgment` and explain the resolution in `adjudication_rationale`.
3. Use `uncertain` for the final judgment if the disagreement or ambiguity cannot be resolved reliably. Keep the rationale clear about what is uncertain.
4. Preserve every pair ID, scenario group, language/script category, and complaint text exactly. Do not add model scores, predictions, existing labels, or development/test split information.
5. Leave no review field empty in a completed submission. Allowed judgments are `related`, `unrelated`, or `uncertain` (lowercase).

Scenario groups are intentionally visible so reviewers can recognize related variants and hard negatives in the same group. They do not indicate a split or reveal any existing label.

## Merge completed reviews

Keep the supplied blank `data/review_packet.json` unchanged. Copy it to a separate completed file, fill the review fields, then run from the repository root. The existing `matching-service/.venv` must be available; this workflow was tested with its Python 3.12.14 interpreter. Do not substitute the system `python3`.

```sh
matching-service/.venv/bin/python matching-service/merge_reviews.py --input matching-service/data/review_packet_completed.json --output matching-service/data/adjudicated_labels.json
```

The script validates all entries and creates `matching-service/data/adjudicated_labels.json`. It refuses to overwrite an existing file. Choose another destination with `--output matching-service/data/adjudicated_labels_round2.json` if the default output already exists. The result preserves both individual judgments and the final adjudication as a separate record; it never edits `data/labels.json` or `results/latest.json`.
