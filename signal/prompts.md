# AI Usage Log — Signal (SimPPL Assignment)

This file documents every prompt used when leveraging AI coding assistants
during development. Prompts are numbered sequentially to show the progression
of thought.

---

## Phase 1 — Architecture planning

**Prompt 1**
```
I'm building a social media narrative analysis platform for a research 
internship at SimPPL. The dataset is Reddit + Twitter posts about climate 
activism (2019–2023). The deliverable is an interactive dashboard with ML 
analysis. Help me think through what makes this genuinely differentiated from 
a generic "5 bar charts on Streamlit" submission. I have skills in ML/NLP, 
full-stack Next.js, and data engineering.
```
*What I used:* The core insight about "narrative velocity" as a custom metric 
(centroid drift over time). Discarded the generic "time series of post counts" 
framing.

*Bug found:* The initial suggestion used Python Dash for the frontend — I 
rejected this because the assignment explicitly favors a well-designed frontend, 
and Dash's component model is too constrained for the Pixi.js UMAP canvas I 
wanted.

---

**Prompt 2**
```
For BERTopic clustering of social media posts, what's the correct way to 
handle the UMAP dimensionality reduction step? I've seen people cluster on 
2D UMAP projections directly — is that right?
```
*What I used:* Confirmed the 5D-for-clustering / 2D-for-visualization split. 
The 2D projection distorts local structure too aggressively for HDBSCAN — 
clustering on 5D first, then projecting to 2D separately, is the correct 
approach per McInnes et al.

*This is a real technical insight I can defend in the interview.*

---

## Phase 2 — Next.js shell

**Prompt 3**
```
Write the global CSS design system for a dark-themed research terminal UI. 
The aesthetic is: precision instrument, not startup SaaS. Key constraints:
- No gradients, no shadows
- 0.5px borders everywhere
- Three font families: sans for UI, mono for data/identifiers, serif for 
  AI-generated summaries
- Color encodes meaning: teal=confirmed, amber=emerging, coral=anomalous, 
  gray=structural
Use CSS custom properties, not Tailwind utilities for the design tokens.
```
*What I used:* The CSS variable structure and the dot-color-meaning system.

*Change I made:* The AI suggested a sidebar width of 240px — I reduced to 224px 
because the nav labels are short and the extra space was wasted on a 1920px 
monitor but cramped on 1280px laptops.

---

**Prompt 4**
```
Write a Zustand store for cross-view state in a multi-page Next.js app. 
The store needs to hold: active topic filter (nullable int), date range 
(unix timestamps), hovered post id for cross-highlight, and dataset metadata. 
All setters should be stable (no new function references on each render).
```
*What I used:* The store structure directly.

*Bug found:* The initial output used `immer` middleware unnecessarily for a 
store this simple — I removed it to reduce bundle size.

---

## Phase 3 — Python pipeline

**Prompt 5**
```
Write a BERTopic pipeline for 800k Reddit posts. Requirements:
1. SBERT all-MiniLM-L6-v2 for embeddings
2. UMAP 5D for clustering, separate 2D pass for visualization  
3. HDBSCAN with min_cluster_size=150 and EOM selection
4. Custom CountVectorizer with bigrams for better Reddit slang handling
5. Export umap_2d.parquet with columns: post_id, umap_x, umap_y, topic_id
Show me the full script, not pseudocode.
```
*What I used:* The full script with minor modifications.

*Bug found:* The AI used `embeddings[idx]` for centroid calculation inside the 
velocity function — this indexing was wrong because `idx` was a pandas Index, 
not a numpy integer array. Fixed by converting: `topic_embs[grp.index.to_numpy() - offset]`.

---

**Prompt 6**
```
Write a zero-shot stance classifier for social media posts about climate action.
Use cross-encoder/nli-deberta-v3-small. The premise should be:
"This post expresses support for climate action."
Classify as: pro (entailment > 0.6), con (contradiction > 0.6), neutral (else).
Process in batches of 32 for memory efficiency. Output a parquet with columns:
post_id, stance, pro_score, con_score, neutral_score.
```
*What I used:* The batch processing loop directly.

*Change I made:* The threshold of 0.6 was too aggressive — after spot-checking 
50 posts manually I found 0.55 gave better precision/recall trade-off for 
"neutral" posts that lean slightly pro.

---

## Phase 4 — Visualization components

**Prompt 7**
```
Write a Pixi.js (@pixi/react v7) scatter plot component in Next.js that 
renders 50k–800k 2D points. Requirements:
- Each point is a circle, colored by topic_id
- Pan and zoom via pointer events (no external library)
- On click, dispatch to Zustand store (setActiveTopic)
- Show cluster centroids as larger labeled circles
- Must handle dynamic data (filtered by date range)
- Use WebGL batch rendering — no individual PIXI.Graphics per point
The file should be a complete React component, not pseudocode.
```
*What I used:* The WebGL batch renderer approach using PIXI.ParticleContainer.

*Bug found (major):* The initial code used `PIXI.Graphics` in a loop — O(n) 
draw calls, crashed at 5k points. Fixed by switching to `PIXI.ParticleContainer` 
with a single circular texture, which renders 800k points in a single draw call.

---

**Prompt 8**
```
Write a D3 v7 multi-line chart in React (no useEffect spaghetti — use a 
proper enter/update/exit pattern with useRef). The chart shows narrative 
velocity (y-axis, 0–1) over time (x-axis, weekly). Requirements:
- Multiple colored lines (one per topic)
- Vertical event pins (Wikipedia events) with hover tooltips
- Brush for date range selection that syncs to Zustand
- Axis labels in the Signal design system (dark bg, --text color)
```

---

## Phase 5 — RAG chatbot

**Prompt 9**
```
Write a Next.js Route Handler for a streaming RAG chatbot using the Anthropic 
SDK and the Vercel AI SDK. The system prompt should frame the assistant as an 
OSINT analyst. The RAG step uses a FAISS index (loaded from disk at startup, 
not per-request). Include rate limiting logic (max 20 req/min per IP using 
an in-memory Map — no Redis required for the demo).
```

---

## Bugs I caught that AI missed

1. **UMAP index mismatch** (Prompt 5) — documented above
2. **Pixi.js Graphics loop** (Prompt 7) — documented above  
3. **Stance threshold** (Prompt 6) — empirically adjusted after manual review
4. **Zustand immer overhead** (Prompt 4) — unnecessary middleware removed
5. **Sidebar width on 1280px** (Prompt 3) — 240px → 224px after visual testing

---

*Total AI-assisted code: ~40% of the codebase (boilerplate, data structures, 
D3 axis setup). Architecture decisions, ML pipeline choices, custom metrics 
(velocity), and all debugging were done independently.*