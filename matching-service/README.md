# Isolated multilingual matching evaluation

This Python experiment is separate from the React/Vite application. It compares local Jaccard and IDF lexical baselines with cached MiniLM and LaBSE sentence embeddings. It does not change production matching behavior or the UI.

## Dataset and split design

`data/complaint_pairs.json` contains 88 fictional complaint pairs across 22 scenario groups. `data/labels.json` has one separate expected label and rationale per pair. Each pair has distinct stable complaint IDs and synthetic institution/bureau metadata. The evaluator reads only complaint text for lexical features and embeddings; labels are joined after text scores are calculated.

Each scenario group belongs wholly to one split: five groups (20 pairs) for development and 17 groups (68 pairs) for held-out testing. Every group has two related and two unrelated examples, and both splits are label-balanced. Related paraphrases and their hard negatives remain together, preventing close variants of one scenario from leaking between splits. Every method selects its threshold from development pairs by maximum F1; ties choose the higher threshold. Test labels are used only for final metrics.

The set includes English, Hindi, Hinglish/Romanized Hindi, native-script and Romanized Kannada, spelling and punctuation variants, abbreviations, cross-institution/bureau reports, generic keyword overlap, opposite outcomes, and unrelated issues. The report includes per-pair scores/predictions, held-out confusion counts, precision, recall, F1, accuracy, rationales for errors, and exploratory language/type breakdowns.

These examples are synthetic, manually assigned judgments and rationales, and have not been independently reviewed by domain or native-language experts. The 22 scenario groups—not 88 pairs—are closer to the independent unit count. Subgroups are small, and this evaluation does not establish real-world accuracy.

## Thresholds and baselines

Thresholds for Jaccard, IDF, MiniLM, and LaBSE are chosen on development data only. The IDF baseline is fit using development complaint texts only, with `idf(t)=ln((N_dev+1)/(df_dev(t)+1))+1`, and uses cosine similarity on binary IDF-weighted vectors. Sentence embeddings are L2-normalized and compared with cosine similarity. Scores are similarity measures, not duplicate probabilities.

## Offline execution

The evaluator always loads model snapshots with `local_files_only=True`; it does not contact Hugging Face or download missing models. Models not present in the cache are reported as skipped, while the lexical baselines still run. Existing cached models live under the ignored `matching-service/.cache/` directory.

From the repository root, rerun the evaluation offline with the existing isolated environment:

```sh
matching-service/.venv/bin/python matching-service/evaluate.py
```

To run only one already-cached embedding model:

```sh
matching-service/.venv/bin/python matching-service/evaluate.py --models minilm
matching-service/.venv/bin/python matching-service/evaluate.py --models labse
```

The tested isolated environment is Python 3.12.14, Sentence Transformers 6.2.0, PyTorch 2.15.0, and Transformers 5.21.0 on Apple Silicon macOS, using CPU inference. The report records whether each model was evaluated from the local cache or skipped, marks scores as freshly recomputed, and includes cached model load time and process peak RSS when measured. `results/latest.json` is regenerated on each run.

The model cache and virtual environment are ignored by Git. This experiment adds no dependencies to the React/Vite project and has no backend, API keys, or external inference calls.
