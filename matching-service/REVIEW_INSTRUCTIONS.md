# Independent multilingual pair review

This packet contains fictional synthetic complaint text for evaluation preparation. No independent expert or native-language review has yet been completed. You receive one copy with one blank `judgment` and `rationale` per pair. Review only the complaint text shown in your copy.

## Judgment definitions

- **Related:** Both complaints describe the same underlying issue or incident and could reasonably be investigated together.
- **Unrelated:** They describe different underlying issues or incidents. Similar topics, services, institutions, bureaus, or repeated keywords alone are not enough to call a pair related.
- **Uncertain:** Use this when the complaint text does not provide enough evidence for a reliable judgment. Do not force a guess.

Judge meaning, not word overlap. Negation and opposite outcomes matter: a missing service is not the same issue as a report that the service is operating as expected. Complaints about different institutions or bureaus may still concern the same incident; the institution or bureau alone does not determine the judgment. Review only the evidence available in the complaint text. Do not infer facts that are not stated.

## Language and script

The packet does not state the language or script category. Do not claim expertise in a language or script you cannot reliably understand. If you cannot understand either complaint well enough to judge whether the underlying issue is the same, select `uncertain` and explain the language or meaning limitation in your rationale. Do not guess based on a few shared words or transliteration.

## Independent submission procedure

The project owner creates two separate copies of the blank packet and sends one copy to each reviewer. The copies contain the same opaque pair IDs, scenario IDs, and original complaint text, with only one generic `judgment` and `rationale` field per pair. Each reviewer completes and returns their own copy independently. Do not share completed packets, discuss individual judgments, or view the other reviewer's answers before both submissions have been returned to the project owner.

Do not rename, remove, reorder, or edit `pair_id`, `scenario_group`, or either complaint text. Fill only `judgment` and `rationale`. Allowed judgments are exactly `related`, `unrelated`, and `uncertain` (lowercase); every rationale must contain a short explanation. Scenario IDs only group related variants and hard negatives for context; they do not indicate an expected answer.

After both separate submissions have been received, the project owner combines them into a private adjudication workspace. The owner resolves any disagreement explicitly, preserving both original judgments and rationales, and enters a final adjudicated judgment and rationale for every pair. Disagreements are never automatically resolved. The owner must retain the private reconciliation information separately and must not distribute it with reviewer packets. The reconciliation information is not cryptographically secure.

The only reviewer-facing files are the blinded packet and this instruction document. Do not request or use project datasets, labels, scores, predictions, model reports, or other project files while reviewing.
