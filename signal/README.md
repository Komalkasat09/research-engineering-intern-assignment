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

- Hosted URL: `ADD_PUBLIC_HOSTED_URL_HERE`

### 2. Detailed README with screenshots

Add screenshots of key views below (replace placeholders with real images in your repo):

![Explore Workspace](docs/screenshots/explore-workspace.png)
![Live Feed Injector](docs/screenshots/live-feed-injector.png)
![Posts Explorer Both Mode](docs/screenshots/posts-explorer-both-mode.png)
![Ask Signal](docs/screenshots/ask-signal.png)

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

- Video URL: `ADD_YOUTUBE_OR_GOOGLE_DRIVE_LINK_HERE`

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

## Main Routes

### Explore

- `/explore` - unified workspace (map, trends, origins, timeline paneling)
- `/graph` - spread network graph
- `/globe` - geospatial event context

### Analysis

- `/analysis/lifecycle` - narrative lifecycle (origin → acceleration → amplification → mutation)
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
