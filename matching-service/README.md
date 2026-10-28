# Isolated multilingual matching evaluation

This README is project-owner documentation and includes evaluation details. Do not distribute it to reviewers. The only reviewer-facing files are `data/review_packet.json` and `REVIEW_INSTRUCTIONS.md`.

This Python experiment is separate from the React/Vite application. It compares local Jaccard and IDF lexical baselines with cached MiniLM and LaBSE sentence embeddings. It does not change production matching behavior or the UI.

## Dataset and split design

`data/complaint_pairs.json` contains 88 fictional complaint pairs across 22 scenario groups. `data/labels.json` has one separate expected label and rationale per pair. Each pair has distinct stable complaint IDs and synthetic institution/bureau metadata. The evaluator reads only complaint text for lexical features and embeddings; labels are joined after text scores are calculated.

Each scenario group belongs wholly to one split: five groups (20 pairs) for development and 17 groups (68 pairs) for held-out testing. Every group has two related and two unrelated examples, and both splits are label-balanced. Related paraphrases and their hard negatives remain together, preventing close variants of one scenario from leaking between splits. Every method selects its threshold from development pairs by maximum F1; ties choose the higher threshold. Test labels are used only for final metrics.

The set includes English, Hindi, Hinglish/Romanized Hindi, native-script and Romanized Kannada, spelling and punctuation variants, abbreviations, cross-institution/bureau reports, generic keyword overlap, opposite outcomes, and unrelated issues. The report includes per-pair scores/predictions, held-out confusion counts, precision, recall, F1, accuracy, rationales for errors, and exploratory language/type breakdowns.

These examples are synthetic, manually assigned judgments and rationales, and have not been independently reviewed by domain or native-language experts. The 22 scenario groups—not 88 pairs—are closer to the independent unit count. Subgroups are small, and this evaluation does not establish real-world accuracy.

## Independent language review packet

`data/review_packet.json` is the blinded reviewer template for every complaint pair. Pair and scenario IDs are random opaque identifiers; original complaint text is preserved exactly. Each entry contains only one generic blank `judgment` and `rationale`. It has no language/category field, split assignment, label, model score, prediction, or model name. No expert or native-language review has yet been represented as completed.

Reviewers should receive only the blinded template and `REVIEW_INSTRUCTIONS.md`. The project owner creates separate copies and sends one to each reviewer. Each reviewer completes and returns their copy without seeing or discussing the other's answers. Scenario IDs group variants and hard negatives without exposing the canonical group names.

The owner-only reconciliation mapping is `matching-service/private/review_id_mapping.json`. The `private/` directory is gitignored. The owner must keep a private backup and never distribute the mapping with reviewer packets. It is a plain local mapping, not cryptographically secure. The merge utility also reads canonical complaint pairs from `data/complaint_pairs.json` to validate IDs, group relationships, and exact text.

From the repository root, copy the neutral template into separate owner-controlled files before sending them:

```sh
mkdir -p matching-service/private/submissions
cp matching-service/data/review_packet.json matching-service/private/reviewer_1_packet.json
cp matching-service/data/review_packet.json matching-service/private/reviewer_2_packet.json
```

Send each reviewer only their separate copy and the instructions. After both completed packets are returned, place them in the private directory and combine them into an owner-only workspace:

```sh
matching-service/.venv/bin/python matching-service/merge_reviews.py combine --reviewer-1 matching-service/private/submissions/reviewer_1.json --reviewer-2 matching-service/private/submissions/reviewer_2.json --output matching-service/private/adjudication_workspace.json
```

The existing `matching-service/.venv` must be available; these commands were tested with its Python 3.12.14 interpreter. Do not substitute the system `python3`. The combine step validates both submissions against the private mapping and canonical complaint text, preserves both judgments and rationales, and leaves final adjudication blank. The owner must edit the workspace and enter an explicit final judgment and rationale for every pair; disagreements are never resolved automatically. Then write a separate final adjudicated-label file:

```sh
matching-service/.venv/bin/python matching-service/merge_reviews.py finalize --input matching-service/private/adjudication_workspace.json --output matching-service/private/adjudicated_labels.json
```

Both output steps refuse to overwrite existing files. Choose new output paths for another run. Final labels remain in the owner-only private directory; the evaluator continues to read only `data/labels.json`, so adjudicated results are not automatically substituted. Existing labels, complaint text, and baseline results are not modified.

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

The model cache and virtual environment are ignored by Git. The evaluation experiment adds no dependencies to the React/Vite project and makes no external inference calls. The separate local inference API is documented below; it has no external service, API keys, or database integration.

## Isolated local inference API

The local semantic API is integrated into the React Matching Engine as an explicit Generate/Refresh action. It accepts complaint IDs and original text, encodes each complaint once, compares distinct pairs, and returns ranked cosine-similarity candidates for human review. If the request fails, the frontend clearly marks its deterministic Jaccard fallback; a valid empty response remains empty. The service does not determine that two complaints are the same incident, and a score is neither a probability nor a confidence.

The service currently selects `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. It loads the model once on startup from the existing local Hugging Face cache, using local-only resolution and CPU inference. If the model is missing or incomplete, inference is unavailable; **do not respond by enabling automatic model downloads**. `GET /health` remains available and reports `model_ready: false`. The cache must be prepared manually by the owner before serving requests.

The API needs the already-declared `sentence-transformers` runtime dependency plus FastAPI, Pydantic 2, and Uvicorn. The API tests use FastAPI's `TestClient`, which also requires HTTPX; these packages are declared in `requirements.txt`. If any are absent from the Python 3.12 virtual environment, install the API and test dependencies from the repository root:

```sh
matching-service/.venv/bin/python -m pip install 'fastapi>=0.115,<1.0' 'pydantic>=2.7,<3.0' 'uvicorn>=0.30,<1.0' 'httpx>=0.27,<1.0'
```

This installs Python packages only; it does not install or download model weights. The existing `requirements.lock.txt` describes the earlier evaluation environment and has not been regenerated for the API because no packages were installed for this milestone.

To check for the model in the configured local cache without downloading it:

```sh
HF_HOME=matching-service/.cache/huggingface matching-service/.venv/bin/python -c 'from huggingface_hub import snapshot_download; print(snapshot_download("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", local_files_only=True))'
```

The `local_files_only=True` option is required. A missing snapshot must be handled as unavailable; never retry without that option. For browser use from the Vite app, start the loopback CORS wrapper from the repository root after installing dependencies and verifying the local cache. It allows only `http://localhost:5173` and `http://127.0.0.1:5173`, with GET/POST and the Content-Type header; it does not allow credentials or other origins.

```sh
matching-service/.venv/bin/python -m uvicorn local_cors_app:app --app-dir matching-service --host 127.0.0.1 --port 8000 --no-access-log
```

The underlying `api:app` remains available for non-browser local clients. The wrapper adds only the loopback Vite CORS policy and does not proxy requests.

The endpoint accepts 2–40 records, unique non-blank IDs, original text up to 8,000 characters per complaint, and a caller-supplied cosine threshold from -1 to 1. The request body is limited to 2 MiB. At least two complaints are required to form pairs. No complaint text is persisted or logged by the service. The model is held in memory for the process lifetime; CPU latency and memory use depend on the machine and batch. The service endpoint considers up to 780 pairs at the maximum batch size, so this cap is for a local prototype, not a production throughput guarantee.

Example request:

```sh
curl --fail-with-body http://127.0.0.1:8000/api/v1/matches \
  -H 'Content-Type: application/json' \
  -d '{"complaints":[{"id":"demo-1","original_text":"My pension payment has not reached my bank account."},{"id":"demo-2","original_text":"The monthly retirement payment was not deposited into my account."}],"threshold":0.35}'
```

Example response (scores vary by model/runtime):

```json
{
  "model_id": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "score_type": "cosine_similarity",
  "score_semantics": "Cosine similarity between L2-normalized multilingual sentence embeddings; not a probability or confidence.",
  "threshold": 0.35,
  "matches": [
    {
      "pair_id": "<stable SHA-256 pair key>",
      "complaint_a_id": "demo-1",
      "complaint_b_id": "demo-2",
      "similarity": 0.81
    }
  ]
}
```

The numeric response value above is illustrative only. This service has not been validated for real complaint triage, and the current synthetic held-out study is small and not independently language-reviewed. It does not merge cases or trigger downstream actions.

Run isolated inference and API tests with the existing standard-library test module:

```sh
matching-service/.venv/bin/python -m unittest matching-service.test_inference_service -v
```

API tests use FastAPI's `TestClient`, a fake encoder, and an injected model loader; they do not load or download model weights. If FastAPI, Starlette, or HTTPX is absent, unittest explicitly reports the API-focused tests as skipped with the missing dependency names. Install the declared API/test requirements before treating API tests as passed. No service/model startup or download is part of the test command.
