#!/usr/bin/env bash
# Run the full Signal data pipeline in order.
# Usage: bash scripts/run_pipeline.sh --input data/raw/dataset.csv
#
# Flags passed through to individual scripts:
#   --device cuda      (use GPU for embedding + stance)
#   --sample 100000    (index only 100k posts for faster demo)

set -euo pipefail

INPUT="${1:---input data/raw/dataset.csv}"

echo "╔══════════════════════════════════════════════════╗"
echo "║          Signal — Data Pipeline Runner           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

python scripts/01_load.py   $INPUT
python scripts/02_embed.py  ${DEVICE:+--device $DEVICE}
python scripts/03_cluster.py
python scripts/04_stance.py ${DEVICE:+--device $DEVICE}
python scripts/05_coord.py
python scripts/06_graph.py
python scripts/07_index.py  ${SAMPLE:+--sample $SAMPLE}

echo ""
echo "Pipeline complete. Start the dev server:"
echo "  npm run dev"