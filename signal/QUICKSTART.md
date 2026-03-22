# Signal - Quick Start Guide

## Running the Development Server

From the `signal` directory, run:

```bash
cd signal
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Data Modes

Signal now defaults to publication-safe behavior: API routes require real precomputed artifacts.

```bash
# Publication-safe default (recommended)
# No env var needed. Missing data returns HTTP 503 with required files.

# Optional local demo mode (enables synthetic fallbacks)
export SIGNAL_ALLOW_SYNTHETIC_DATA=true
```

Required real-data artifacts for full experience:
- `public/data/topics.json`
- `public/data/umap_points.json`
- `public/data/velocity.json`
- `public/data/stance_series.json`
- `public/data/coord.json`
- `public/data/graph.json`
- `data/faiss_meta.json` (for chat retrieval context)

## Available Commands

```bash
npm run dev      # Start development server
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Status

✅ All TypeScript files compile with zero errors
✅ All 17 routes build successfully
✅ All API endpoints are functional
✅ All components are properly typed

## Troubleshooting

If you encounter module resolution errors:

```bash
# Clean the build cache
rm -rf .next node_modules/.cache

# Rebuild
npm run build
```

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - React components
- `/lib` - Utility functions and data management
- `/types` - TypeScript type definitions
- `/public/data` - Static data files (JSON, Parquet)
- `/scripts` - Python data pipeline scripts

## Key Features Implemented

1. **Timeline View** - Narrative canvas with UMAP clusters
2. **Signals View** - Velocity chart showing topic acceleration
3. **Stance View** - River chart showing sentiment over time
4. **Graph View** - Force-directed network visualization
5. **Map View** - Coordinate-based heatmap
6. **Globe View** - 3D geospatial intelligence
7. **Chat View** - AI-powered signal analysis
8. **Fingerprint View** - Topic cluster fingerprinting

All views are functional with real pipeline artifacts; demo fallback mode is opt-in via `SIGNAL_ALLOW_SYNTHETIC_DATA=true`.
