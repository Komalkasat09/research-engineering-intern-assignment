# Signal - Complete Feature Summary

This document provides a full implementation-level summary of the dashboard, APIs, data flow, analytics methods, and user workflows.

## 1) Product Goal

Signal is an investigative reporting dashboard for tracing narrative spread and influence across social communities.

Primary outcomes:

- Detect emerging/rising narratives.
- Track narrative mutation over time.
- Identify influential nodes and synchronized behavior.
- Support evidence-grounded investigation through search and chat.

## 2) Frontend Surface Area

Implemented pages:

- `/map` - Narrative semantic map (Pixi).
- `/timeline` - Velocity/time-series narrative trend view.
- `/graph` - Network propagation graph.
- `/origins` - Narrative origins and time-to-mainstream view.
- `/trends` - Ranked trend analytics + drillthrough.
- `/signals` - Coordination behavior and normalization mode.
- `/stance` - Stance analysis (Executive + Advanced modes).
- `/fingerprint` - AI-assisted narrative fingerprinting/search.
- `/posts` - Raw post explorer with keyword and scope filters.
- `/chat` - Ask Signal analyst chatbot with retrieval context.
- `/benchmark` - Benchmark/evaluation framing view.

Shared shell capabilities:

- Global date chips.
- Platform chips.
- Analyst rail toggle.
- Ops mode toggle.
- Sidebar navigation and dataset footer context.

## 3) Interaction Model (Cross-View Workflow)

Global state in Zustand supports cross-view continuity:

- Active topic scope (`activeTopic`).
- Investigation context payload (`investigationContext`).
- Date range and platform filters.
- Analyst rail and ops theme state.

Cross-view behavior examples:

- Selecting a topic in map filters downstream views.
- Trends card actions prime investigation context, then route to graph/stance/map/chat.
- Graph node panel can route to investigation actions.
- Map panel deep-links to posts explorer with scoped topic.

## 4) Page-by-Page Feature Detail

## 4.1 Narrative Map (`/map`)

Core capabilities:

- Renders topic clusters in 2D semantic space.
- Supports pan/zoom interaction.
- Topic selection via labels/chips.
- Topic search input (cluster name + top words).
- Overlay topic panel with quick navigation actions.
- Guidance strip with action shortcuts.

Technical notes:

- Uses `NarrativeCanvas` (Pixi v8) for performant rendering.
- Topic label interaction patched for Pixi v8 event handling (`eventMode` + `pointertap`).
- Click conflict suppression implemented so label taps do not get immediately undone by canvas click handling.

## 4.2 Timeline (`/timeline`)

Core capabilities:

- Velocity time-series across narrative clusters.
- Event annotations and temporal context.
- Cluster/topic filtering through global scope.

Purpose:

- Detect inflection points where narrative language or momentum shifts.

## 4.3 Spread Graph (`/graph`)

Core capabilities:

- Account/subreddit network visualization.
- Node-level detail and investigation actions.

Purpose:

- Identify likely amplifiers and topology of spread.

## 4.4 Origins (`/origins`)

Core capabilities:

- Narrative origin communities.
- Time-to-mainstream and tier framing.
- Confidence fields available for interpretation.

Purpose:

- Explain where narratives started and how they propagated into broader discourse.

## 4.5 Trends (`/trends`)

Core capabilities:

- Ranked top narratives with confidence labels.
- Rank reason metrics (score, velocity, spread, volume).
- Drillthrough actions to map/graph/stance/chat.
- "Raw posts" prompt shortcut into chat.
- Additional analytics cards:
  - Narrative language drift
  - Active anomaly alerts
  - Counterfactual impact summaries

Purpose:

- Provide high-level triage and prioritization of narratives requiring investigation.

## 4.6 Signals (`/signals`)

Core capabilities:

- Coordination behavior heatmap/pairs.
- Normalization mode toggle (`raw` vs activity-adjusted).
- Confidence-enriched signal context.

Purpose:

- Surface possible synchronized behavior patterns for analyst review.

## 4.7 Stance (`/stance`)

Core capabilities:

- Two-mode UX:
  - Executive view (first-time reader friendly)
  - Advanced view (streamgraph + caveats + blind spots)
- Quick takeaway, interpretable stats, and methodology framing.
- Blind spot examples from real corpus posts.

Stability improvements:

- Hydration-safe rendering flow introduced.
- Week parsing fixed to support range labels and legacy week formats.
- Advanced view chart dimension observer fixes for reliable render after mode switch.

## 4.8 Fingerprint (`/fingerprint`)

Core capabilities:

- Query-driven narrative fingerprinting assistance.
- Topic-aware querying behavior.

Purpose:

- Provide AI-assisted narrative shape exploration from user prompts.

## 4.9 Posts Explorer (`/posts`)

Core capabilities:

- Keyword search over indexed metadata corpus.
- Filters: topic scope, subreddit, author.
- Pagination (`offset`, `limit`, `has_more`).
- Explainable ranking metadata:
  - match score
  - matched terms
  - amplification level
  - stance hint
  - why matched
- Selected post detail panel.
- Scoped-results rescue UX:
  - if current topic has zero hits but all-topics has hits, clear-scope prompt appears.

Deep-linking:

- Supports URL params for topic/query presets.
- Map topic panel links directly into scoped posts explorer.

## 4.10 Ask Signal (`/chat`)

Core capabilities:

- Streaming analyst responses.
- Retrieval from `data/faiss_meta.json`.
- Investigation context injection for scoped reasoning.
- Evidence notebook export (`/api/report/evidence`) to markdown.

Prompt/behavior goals:

- Evidence-cited analysis.
- Correlation vs causation caution.
- Follow-up investigative angles.
- Innocent-explanation framing where needed.

## 4.11 Benchmark (`/benchmark`)

Core capabilities:

- Centralized benchmark/evaluation framing page for model/system interpretation.

Purpose:

- Communicate methodological limitations and evaluation posture.

## 5) API Surface Summary

Implemented route handlers:

- `/api/clusters` - topic metadata + dataset meta.
- `/api/umap` - map coordinates.
- `/api/velocity` - temporal velocity data.
- `/api/graph` - graph nodes/links.
- `/api/origins` - origins + spread fields.
- `/api/trends` - trend ranking + confidence/rationale.
- `/api/coord` - coordination data.
- `/api/stance` - stance time series.
- `/api/stance/examples` - blind spot examples.
- `/api/globe` - globe/event data.
- `/api/fingerprint` - fingerprint request handling.
- `/api/chat` - streaming analyst chat with retrieval.
- `/api/posts/search` - keyword/raw-post explorer API.
- `/api/alerts` - anomaly alert summaries.
- `/api/narrative-diff` - language drift snapshots.
- `/api/counterfactual` - remove-top-account impact estimates.
- `/api/report/evidence` - markdown evidence export.
- `/api/report/weekly-brief` - weekly brief summary payload.
- `/api/account/[id]` - account-level details endpoint.

## 6) Data and Pipeline

Pipeline scripts:

- `01_load.py` - ingest/normalize source data.
- `02_embed.py` - embedding generation.
- `03_cluster.py` - topic clustering.
- `04_stance.py` - stance labeling/series prep.
- `05_coord.py` - coordination detection.
- `06_graph.py` - graph artifact generation.
- `07_index.py` - index and retrieval prep.
- `08_export_json.py` - frontend artifact export.
- `09_validate.py` - artifact checks.
- `10_origins.py` - origins analysis export.
- `11_narrative_diff.py` - narrative drift export.
- `12_alerts.py` - alert scoring export.
- `13_counterfactual.py` - counterfactual impact export.

Artifacts consumed by app:

- `public/data/*.json` visual artifacts.
- `data/faiss_meta.json` retrieval/search corpus metadata.

## 7) State and App Shell

Store includes:

- topic scope
- date range + platform filters
- selected node + hover context
- investigation context payload
- analyst rail open state
- ops theme state
- dataset metadata

Shell includes:

- global controls
- nav sections
- analyst rail integration
- theme/data context indicators

## 8) Reliability and UX Fixes Applied During Iteration

- Hydration mismatch fixes in stance and shell render paths.
- Advanced stance chart resize/observer reliability fix.
- Pixi map runtime protection around texture generation and disposal path.
- Pixi label click reliability fixes.
- Map-level topic/keyword search added.
- Posts explorer pagination and scoped zero-result recovery UX added.

## 9) Current Gaps / Honest Limits

- Multimodal analysis is limited; current implementation is primarily text-first.
- Some summary statistics in cards are heuristic/exemplar values rather than full formal evaluation metrics.
- Public README/demo assets must be kept strictly synchronized with current implementation details.

## 10) Recommended Final Submission Enhancements

- Add final screenshots and video walkthrough link.
- Add one explicit end-to-end case study section in README.
- Add one lightweight multimodal extension (or clearly document scope limitations and future plan).
- Add benchmark notes for retrieval quality and false-positive handling.

## 11) Submission Artifact Checklist

- `README.md` complete and accurate.
- `summary.md` (this file) included.
- `prompts.md` included and updated.
- Public deployment URL validated.
- Video demo link provided.
- Assignment email sent with required subject line.
