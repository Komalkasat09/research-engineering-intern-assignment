# prompts.md - AI Prompt Log (Written By Me)

This file records the actual style of prompts I used while building Signal for submission.
I wrote prompts in phases and kept them specific, constraint-driven, and testable.

## Prompting approach I followed

- I gave role, context, constraints, and output format in every major prompt.
- I asked for acceptance criteria when I needed production-ready code.
- I used small debugging prompts after each implementation step.
- I manually verified outputs and edited AI-generated code before finalizing.

## Phase 1 - Product framing and architecture

### Prompt 1
```text
Act as a principal product + system architect.
I am building Signal, a narrative intelligence platform where analysts move from discovery to evidence-backed synthesis.
Help me design an end-to-end workflow so pages are not disconnected.

Constraints:
- Shared topic scope across views.
- Fast API responses using precomputed artifacts.
- Room for live Reddit ingestion and classification.

Return:
1) Core user workflow
2) Route map
3) State boundaries
4) Failure modes and mitigations
```

### Prompt 2
```text
I want this to stand out from generic dashboards.
Give me 5 differentiated capabilities for narrative analysis, each with:
- why it matters for analysts
- what data it needs
- how to visualize it clearly

Do not suggest superficial KPI widgets.
```

### Prompt 3
```text
Design a Next.js App Router information architecture for these routes:
/explore, /lifecycle, /analysis/livefeed, /posts, /chat, /signals, /stance, /graph.

Output a clean table with:
- route
- page purpose
- required API dependencies
- shared state dependencies
```

## Phase 2 - Data pipeline and modeling

### Prompt 4
```text
Write a production-style Python pipeline for topic modeling artifacts.
Stages: load, embed, cluster, stance, coord, graph, index, export, validate.

Requirements:
- deterministic outputs when random seed is fixed
- clear logging per stage
- fail fast on missing input files
- export web-friendly JSON payloads for frontend use
```

### Prompt 5
```text
For BERTopic + UMAP + HDBSCAN, confirm the correct setup.
I want clustering-quality guidance, not tutorial-level advice.

Answer:
1) whether to cluster on 2D or higher-dimensional embeddings
2) why
3) what to export separately for visualization
4) practical parameter defaults for noisy social media text
```

### Prompt 6
```text
Create a stance classification script for social posts.
Return a batched inference pipeline with confidence scores and a neutral-safe threshold strategy.

Also include:
- how to calibrate thresholds on a manual sample
- what metrics to track for class imbalance
```

## Phase 3 - Frontend implementation

### Prompt 7
```text
You are a senior React and TypeScript engineer.
Build a stable app shell with fixed top navigation, sidebar nav, and analyst rail.

Constraints:
- should support full-height desktop views
- should still allow natural page scrolling for long content
- no layout shift on route change

Return complete component code and CSS strategy.
```

### Prompt 8
```text
Implement a high-density narrative map component.

Requirements:
- render many topic points efficiently
- render centroid label bubbles
- click on cluster to set active topic in store
- support cluster visibility filtering from external state
- avoid memory leaks on re-render and filter changes

Include a minimal regression test checklist.
```

### Prompt 9
```text
Build Explore page as command center:
- map canvas
- trends panel
- origins panel
- timeline summary
- cluster count slider

When slider changes, call /api/clusters with k and keep all dependent views in sync.
```

### Prompt 10
```text
Create an interactive UMAP scatter component.

Requirements:
- clean human-readable topic labels
- click-to-scope interactions
- robust handling for missing or noisy topic names
- no duplicate effect dependencies
```

## Phase 4 - APIs, retrieval, and chat grounding

### Prompt 11
```text
Implement narrow route handlers for:
/api/clusters, /api/trends, /api/origins, /api/summary, /api/posts/search.

For each endpoint, include:
- strict response shape
- empty-data fallback behavior
- predictable error handling
```

### Prompt 12
```text
Design retrieval-grounded chat behavior for analyst use.
Evidence source: FAISS metadata export.

Objectives:
- high grounding
- low hallucination risk
- concise, structured answers

Return:
1) system prompt
2) retrieval scoring strategy
3) answer template with sections: Findings, Evidence, Risks, Next Questions
```

### Prompt 13
```text
Add prompt-level protections for chat quality:
- reject empty or under-specified queries politely
- detect non-English inputs and reply in same language
- surface post-id references that can link back to evidence cards
```

## Phase 5 - Debugging and final hardening

### Prompt 14
```text
Act as a debugging lead.
Issue: slider-selected cluster count and map bubble count are out of sync.

Workflow:
1) generate top 3 hypotheses
2) define fastest verification for each
3) implement the smallest safe fix
4) define regression checks

Do not suggest broad refactors.
```

### Prompt 15
```text
I have hydration mismatch warnings in Next.js for responsive branches.
Give me a deterministic server-first render pattern that avoids mismatches,
then applies true viewport logic after mount.

Return code-level before and after snippets.
```

### Prompt 16
```text
Perform a final quality pass as a senior reviewer.
Prioritize:
- runtime errors
- duplicate key issues
- stale UI state bugs
- non-professional user-facing copy

Return findings sorted by severity with exact file-level patch recommendations.
```

## What I used from AI vs what I owned

- AI helped with implementation speed, scaffolding, and refactors.
- I made final architecture decisions and integration choices.
- I fixed edge cases in state synchronization and rendering lifecycle.
- I performed manual validation for UX and evaluator-facing quality.

## Submission note

This prompts file is intentionally detailed for evaluation transparency.
It shows how I used strong prompt engineering practices instead of generic one-line requests.
