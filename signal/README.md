# Signal - Narrative Intelligence Dashboard

Signal is an investigative social-media analysis platform built for the SimPPL Research Engineering Intern assignment.

It focuses on a practical question:

**How do narratives emerge, mutate, and spread across communities over time, and which actors or coordination patterns amplify them?**

## Live Links

- Hosted app: https://signal.vercel.app
- Demo video: REPLACE_WITH_FINAL_VIDEO_LINK

## What Is Implemented

### Core investigation views

- Narrative map (`/map`): semantic narrative clusters in 2D space with topic drilldown.
- Timeline (`/timeline`): narrative velocity over time with event/context overlays.
- Spread graph (`/graph`): account/subreddit network propagation analysis.
- Narrative origins (`/origins`): where narratives started and spread timing.
- Trends (`/trends`): rising narratives, confidence signals, and drillthrough actions.
- Stance (`/stance`): executive + advanced stance analysis with caveats and blind spots.
- Coordination signals (`/signals`): behavior synchronization and heatmap analytics.
- Fingerprint (`/fingerprint`): AI-assisted narrative similarity / retrieval exploration.
- Posts explorer (`/posts`): keyword + scoped raw post search with explainable ranking.
- Ask Signal (`/chat`): streaming analyst chatbot with retrieved evidence and citations.
- Benchmark (`/benchmark`): model and evaluation framing view.

### Investigation workflow features

- Cross-view topic scoping via shared Zustand store.
- Drillthrough from trends/graph/map into chat, stance, map, and posts.
- Evidence export from chat (`/api/report/evidence`).
- Analyst rail with alerts + weekly brief (`/api/alerts`, `/api/report/weekly-brief`).

### API routes (implemented)

- `/api/clusters`
- `/api/umap`
- `/api/velocity`
- `/api/graph`
- `/api/origins`
- `/api/trends`
- `/api/coord`
- `/api/stance`
- `/api/stance/examples`
- `/api/globe`
- `/api/fingerprint`
- `/api/chat`
- `/api/posts/search`
- `/api/alerts`
- `/api/narrative-diff`
- `/api/counterfactual`
- `/api/report/evidence`
- `/api/report/weekly-brief`
- `/api/account/[id]`

## Architecture

- Frontend: Next.js App Router + React + TypeScript
- State: Zustand (persisted cross-view investigation state)
- Visuals: Pixi.js (map), D3 (timeline/stance), react-force-graph-2d (network)
- API layer: Next route handlers in `app/api`
- Data artifacts: `public/data/*.json` + `data/faiss_meta.json`
- Chat model: Groq (`llama-3.3-70b-versatile`) through AI SDK
- Pipeline scripts: `scripts/01_load.py` ... `scripts/13_counterfactual.py`

## Rubric Coverage (Self-Evaluation)

### 1. Documentation quality

- Present: this README + `prompts.md`
- To finalize: replace placeholder demo link, add final screenshots and final public URL if changed.

### 2. Hosted frontend quality

- Present: deployed Next.js dashboard, multi-view investigation UX, consistent design system.
- To finalize: final visual polish pass + screenshot section update.

### 3. Required summary statistics and visuals

- Time series: timeline + velocity views.
- Key themes/trends: map/trends/origins.
- Community/account contributions: graph + coordination + origins.
- Network visualization: spread graph implemented.

### 4. Interactive querying + multimodal

- Chatbot querying: implemented in `/chat` with evidence retrieval.
- Multimodal: partial/limited in current build (primarily text-first corpus analysis).
- Recommendation: explicitly document scope and add at least one lightweight multimodal extension for final submission.

### 5. Creative/unique features

- Confidence/rationale overlays for trend ranking.
- Stance executive vs advanced interpretation modes.
- Topic-scoped posts explorer with explainable ranking and pagination.
- Analyst rail with alerts and weekly brief generation.

## Case Study Walkthrough (Suggested Demo Script)

Use one concrete narrative end-to-end in your video:

1. Start in `/map`, select a topic cluster.
2. Open `/timeline` to show narrative velocity inflection points.
3. Open `/graph` to identify distribution hubs.
4. Open `/posts` to show raw evidence + keyword matches.
5. Ask a question in `/chat` and show cited evidence + follow-up angles.
6. Conclude with what is known, uncertain, and what to investigate next.

This structure satisfies the "tell a story with data" goal better than feature-by-feature clicking.

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+

### Install

```bash
npm install
pip install -r scripts/requirements.txt
```

### Environment

Create `.env.local` with:

```dotenv
GROQ_API_KEY=YOUR_KEY
```

Optional:

```dotenv
SIGNAL_ALLOW_SYNTHETIC_DATA=true
```

### Run

```bash
npm run dev
```

## Data + Pipeline

- Place dataset artifacts according to project expectations.
- Generate/update artifacts using:

```bash
bash scripts/run_pipeline.sh
```

Pipeline stages include loading, embedding, clustering, stance, coordination, graph/indexing, origins, narrative diff, alerts, and counterfactual analysis.

## Submission Checklist (Final)

- [ ] README updated with real hosted URL + screenshots
- [ ] Video walkthrough link added
- [ ] System-design explanation included (README + summary)
- [ ] Prompt log included (`prompts.md`)
- [ ] Public deployment tested end-to-end
- [ ] Email sent per assignment instructions

## Important Security Note

If any API key was ever pasted into chat/logs/screenshots, rotate it immediately and update deployment secrets.
