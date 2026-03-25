# Signal

Signal is an integrated narrative intelligence platform for investigating how online narratives emerge, spread, and mutate across communities.

It combines:

- Multi-view visual analytics
- Real-time Reddit live feed injection and classification
- Evidence-grounded analyst chat
- Cross-view topic scoping and investigation context

## Submission Requirements

This section is intentionally formatted to match the assignment checklist.

### 1. Publicly accessible hosted web platform URL

- Hosted URL: https://simppl-signal.vercel.app/explore

### 2. Detailed README with screenshots

Add screenshots of key views below (replace placeholders with real images in your repo):

![Explore Workspace](signal/public/workspace explorer.png)
![Live Feed Injector](/Users/komalkasat09/Desktop/simppl/signal/public/live-feed-injector.png)
![Posts Explorer Both Mode](/Users/komalkasat09/Desktop/simppl/signal/public/post-explorer.png)
![Ask Signal](signal/public/ask-signal.png)

### 3. Text-based system design explanation and thought process

Signal was designed as an investigation workflow, not a set of disconnected charts. The core design decision was to keep one shared cross-view context (active topic + investigation context) and let every view contribute evidence for the same narrative thread.

System design choices:

- Frontend architecture:
	- Next.js App Router with route-level pages for each investigation view.
	- Components are optimized for visual analysis (map, graph, stance, timeline, live feed cards).
- State model:
	- Zustand provides shared topic scope and investigation context across views.
	- Persistence is used for continuity (cross-page navigation and live feed restoration).
- API design:
	- Route handlers under `app/api` expose precomputed artifacts and live operations.
	- APIs are narrowly scoped (clusters, graph, stance, origins, chat, posts search, live inject, reports).
- Data strategy:
	- Heavy analytics are precomputed in the Python pipeline and exported as artifacts.
	- Runtime APIs stay responsive by reading generated JSON/meta files.
- Chat strategy:
	- Retrieval context is assembled from indexed metadata, then injected into a strict analyst system prompt.
	- Response post-processing surfaces follow-up actions and risk flags in UI.
- Live integration strategy:
	- Live Reddit results are classified into existing clusters and merged into posts explorer.
	- This bridges historical corpus analysis with real-time narrative monitoring.

Thought process behind trade-offs:

- Prioritized investigation speed and cross-view continuity over highly complex backend orchestration.
- Chose explainable UI elements (why matched, confidence, origin/velocity cues) over opaque aggregate scores.
- Kept model usage modular so model IDs and live classification behavior can be updated without redesigning the UI.

### 4. Video walkthrough link (YouTube or Google Drive)

- Video URL: https://youtu.be/5VJBWAujIt4

### 6. Requirements Checklist (Implemented)

- Hosted web platform is public and accessible.
- Video walkthrough link is included.
- Multi-view investigative workflow is integrated end-to-end.
- Real-time Reddit ingestion and classification is implemented.
- Evidence-grounded chat workflow is implemented.
- Cross-view topic scoping and investigation continuity is implemented.
- Narrative lifecycle view now includes sentiment + toxicity phases.
- Legacy lifecycle analysis remains available for evaluator comparison.

### 5. Evaluation helper note

For reviewers, the fastest path to evaluate the integrated flow is:

1. Open `/explore` and scope a topic.
2. Open `/analysis/livefeed` and classify live query results.
3. Open `/posts` and switch between Dataset/Live/Both.
4. Send a post to `/chat` using "Send to Ask Signal".
5. Verify follow-up chips and analyst alert behavior in Ask Signal.

## Product Overview

Signal is organized around a complete investigation workflow:

1. Discover narratives and active clusters
2. Inspect lifecycle, spread, stance, and coordination signals
3. Ingest live Reddit posts and classify into narrative clusters
4. Investigate raw posts with explainable matching
5. Send evidence to Ask Signal for analyst-style synthesis

## Feature Coverage

- Explore workspace with narrative map + context rails.
- Spread graph for account/community propagation topology.
- Live feed injector with Reddit fetch + cluster assignment.
- Posts explorer with Dataset / Live / Both modes.
- Ask Signal with retrieval grounding, follow-up chips, and analyst alerts.
- Narrative lifecycle (new): sentiment arc + toxicity gradient + phase cards.
- Narrative lifecycle (legacy): origin/acceleration/amplification/mutation analysis.
- Fingerprint simulation across community archetypes.
- Coordination behavior view with pair-level evidence.
- Report/evidence export APIs for analyst workflows.

## Detailed Feature Descriptions

### 1. Explore Workspace (`/explore`)

- Purpose: serves as the investigation command center where analysts select a topic and keep a shared narrative context.
- What it provides:
	- Topic-level orientation with supporting trend/context panels.
	- A shared scope that propagates to downstream views (lifecycle, posts, chat, live feed).
	- Quick pivoting into deeper analysis routes without losing investigation state.
- Analyst value: reduces context switching by maintaining one continuous thread from discovery to evidence review.

### 2. Spread Graph (`/graph`)

- Purpose: visualize propagation structure across accounts/communities.
- What it provides:
	- Node-link network view of narrative spread paths.
	- Structural clues for amplification centers and bridge nodes.
	- Interactive exploration to inspect local neighborhoods around key actors.
- Analyst value: helps identify where narratives intensify and how they move between communities.

### 3. Globe View (`/globe`)

- Purpose: add geospatial context to narrative activity.
- What it provides:
	- Geographic distribution patterns tied to narrative events.
	- Regional concentration cues and location-linked signal surfacing.
- Analyst value: supports region-aware interpretation for narratives with geographic relevance.

### 4. Lifecycle Analysis (New) (`/lifecycle`)

- Purpose: quantify narrative evolution with sentiment and toxicity over lifecycle phases.
- What it provides:
	- Sentiment breakdown (positive/neutral/negative) across phase windows.
	- Toxicity gradients with interpretable severity bands.
	- Phase cards to summarize emergence, growth, and transition dynamics.
	- Fallback handling when scoped topics are sparse, so analysts still see meaningful context.
- Analyst value: makes narrative maturity and risk progression explicit with phase-level evidence.

### 5. Lifecycle Analysis (Legacy) (`/analysis/lifecycle`)

- Purpose: preserve the prior lifecycle framing for evaluator comparison and continuity.
- What it provides:
	- Origin -> acceleration -> amplification -> mutation stage interpretation.
	- Comparative reference against the new sentiment/toxicity lifecycle implementation.
- Analyst value: supports side-by-side methodological validation and reviewer transparency.

### 6. Live Feed Injector (`/analysis/livefeed`)

- Purpose: pull real-time Reddit posts and classify them into known narrative clusters.
- What it provides:
	- Query-driven live ingestion from Reddit.
	- On-the-fly topic assignment into existing cluster taxonomy.
	- Result persistence/restore behavior for iterative live monitoring sessions.
- Analyst value: connects historical model context with current platform activity.

### 7. Stance View (`/stance`)

- Purpose: track how positions shift over time around narratives.
- What it provides:
	- Stance streams and trend direction cues.
	- Temporal perspective on polarization and movement between positions.
- Analyst value: distinguishes growth in volume from actual opinion movement.

### 8. Signals / Coordination View (`/signals`)

- Purpose: surface potentially coordinated behavior patterns.
- What it provides:
	- Pair- or group-level coordination evidence.
	- Risk-oriented indicators for synchronized activity.
	- Integration with analyst alerting used by Ask Signal.
- Analyst value: highlights likely organized amplification rather than organic discussion.

### 9. Fingerprint View (`/fingerprint`)

- Purpose: characterize narrative style/archetype signatures.
- What it provides:
	- Archetype simulation and comparison outputs.
	- Similarity framing to relate active narratives to known behavioral patterns.
- Analyst value: accelerates pattern recognition across repeated campaign styles.

### 10. Posts Explorer (`/posts`)

- Purpose: inspect post-level evidence with explainable matching.
- What it provides:
	- Three source modes: Dataset, Live, and Both.
	- Interleaved comparison between historical and newly ingested live posts.
	- Explainability cues such as match reasons and confidence context.
	- Per-post handoff to Ask Signal using prefilled evidence prompts.
- Analyst value: provides traceable evidence review before synthesis decisions.

### 11. Ask Signal (`/chat`)

- Purpose: generate analyst-style synthesis grounded in retrieved evidence.
- What it provides:
	- Retrieval-grounded answers constrained by available context.
	- Topic-aware prompting when a scoped narrative is active.
	- Follow-up question chips to continue investigation quickly.
	- Analyst alerts when risk patterns (coordination/velocity style cues) are present.
- Analyst value: turns scattered evidence into concise hypotheses and next-step questions.

### 12. Benchmark / Evaluation (`/benchmark`)

- Purpose: provide a controlled page for quality checks and comparisons.
- What it provides:
	- Evaluation-focused context for validating outputs.
	- A repeatable place to inspect behavior during testing or demos.
- Analyst value: supports reproducibility and reviewer confidence.

### 13. Legacy Direct Views (`/map`, `/timeline`, `/trends`, `/origins`)

- Purpose: keep direct access to specialized analysis pages used in earlier flows.
- What they provide:
	- Map-level and timeline-level direct inspection.
	- Trend and origin focused decomposition outside the unified workspace.
- Analyst value: allows targeted deep-dives when a single lens is preferred over multi-panel workflows.

### 14. Report and Evidence APIs (`/api/report/evidence`, `/api/report/weekly-brief`)

- Purpose: export investigation artifacts for analyst reporting.
- What they provide:
	- Evidence packaging for downstream reporting workflows.
	- Brief generation scaffolding for recurring monitoring summaries.
- Analyst value: shortens handoff from analysis to written intelligence outputs.

## Main Routes

### Explore

- `/explore` - unified workspace (map, trends, origins, timeline paneling)
- `/graph` - spread network graph
- `/globe` - geospatial event context

### Analysis

- `/lifecycle` - narrative lifecycle (sentiment arc + toxicity gradient + phase detection)
- `/analysis/lifecycle` - legacy lifecycle (origin → acceleration → amplification → mutation)
- `/analysis/livefeed` - live Reddit post injector and classifier
- `/stance` - stance river and stance shifts over time
- `/signals` - coordinated behavior and related risk views
- `/fingerprint` - narrative fingerprint and similarity view

### Investigate

- `/chat` - Ask Signal (streaming investigative assistant)
- `/posts` - posts explorer (dataset/live/both modes)
- `/benchmark` - benchmark and evaluation page

### Legacy/Direct Views (still present)

- `/map`, `/timeline`, `/trends`, `/origins`

## Integrated Features

### Cross-view scoped investigations

- Shared Zustand state for active topic and investigation context
- Topic scope flows from explore/analysis into chat and posts explorer

### Ask Signal enhancements

- Retrieval-grounded responses
- Analyst alert injection for coordination/velocity signals
- Follow-up question generation (rendered as clickable chips)
- Context-aware scoped prompts

### Live feed + posts explorer integration

- Live feed stores classified posts in app state
- Posts explorer supports source modes:
	- Dataset
	- Live
	- Both (interleaved with live marker)
- Per-post action to send evidence to Ask Signal with prefilled prompt

### Persistence behavior

- Core app state persisted with Zustand
- Live feed query/results cached in session storage and restored on return
- Background refresh runs when returning to live feed with a prior query

## Tech Stack

- Next.js App Router (TypeScript, React)
- Zustand for client state and persistence
- Vercel AI SDK + Groq for chat/inference
- Pixi.js, D3, and react-force-graph-2d for visuals
- Python pipeline scripts for artifact generation

## API Surface

Implemented API routes include:

- `/api/account/[id]`
- `/api/alerts`
- `/api/chat`
- `/api/clusters`
- `/api/coord`
- `/api/counterfactual`
- `/api/fingerprint`
- `/api/globe`
- `/api/graph`
- `/api/live/inject`
- `/api/narrative-diff`
- `/api/origins`
- `/api/posts/search`
- `/api/report/evidence`
- `/api/report/weekly-brief`
- `/api/stance`
- `/api/trends`
- `/api/umap`
- `/api/velocity`

## Data Artifacts

Expected data artifacts for full functionality:

- `public/data/topics.json`
- `public/data/umap_points.json`
- `public/data/velocity.json`
- `public/data/stance_series.json`
- `public/data/coord.json`
- `public/data/graph.json`
- `data/faiss_meta.json`

If artifacts are missing, routes may return publication-safe missing-data responses unless synthetic mode is enabled.

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+

### Install

```bash
npm install
pip install -r scripts/requirements.txt
```

### Environment

Create `.env.local`:

```dotenv
GROQ_API_KEY=your_key_here
```

Optional:

```dotenv
# Enable synthetic fallback behavior when artifacts are missing
SIGNAL_ALLOW_SYNTHETIC_DATA=true

# Optional override for live feed classifier model
GROQ_MODEL_LIVE_INJECT=llama-3.3-70b-versatile
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
npm run start
```

## Pipeline

Run the full artifact pipeline:

```bash
bash scripts/run_pipeline.sh
```

Pipeline stages:

1. `01_load.py`
2. `02_embed.py`
3. `03_cluster.py`
4. `04_stance.py`
5. `05_coord.py`
6. `06_graph.py`
7. `07_index.py`
8. `08_export_json.py`
9. `09_validate.py`
10. `10_origins.py`
11. `11_narrative_diff.py`
12. `12_alerts.py`
13. `13_counterfactual.py`

## Developer Notes

- Use `/explore` as the default investigation entry point.
- Use `/analysis/livefeed` to ingest and classify real-time Reddit posts.
- Use `/posts` in Both mode to compare historical corpus posts with live classified posts.
- Use Ask Signal for synthesis and follow-up investigative framing.

## Security

- Never commit API keys.
- If any key has been exposed in logs/screenshots/chat, rotate it immediately.
