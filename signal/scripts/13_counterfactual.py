#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / "public" / "data" / "graph.json"
OUT = ROOT / "public" / "data" / "counterfactual.json"

if not GRAPH.exists():
    print("missing graph.json")
    raise SystemExit(0)

nodes = json.loads(GRAPH.read_text()).get("nodes", [])
accounts = [n for n in nodes if n.get("type") == "account"]

by_topic = {}
for n in accounts:
    tid = n.get("topic_id")
    if isinstance(tid, int) and tid >= 0:
        by_topic.setdefault(tid, []).append(n)

topics = []
for tid, arr in by_topic.items():
    arr = sorted(arr, key=lambda x: float(x.get("weight", 0.0)), reverse=True)
    top = arr[0] if arr else {}
    second = arr[1] if len(arr) > 1 else {}
    baseline = float(top.get("weight", 0.0))
    after = float(second.get("weight", 0.0))
    impact = max(0.0, baseline-after)
    topics.append({
        "topic_id": tid,
        "top_account": top.get("id", "unknown"),
        "baseline_peak": round(baseline, 4),
        "peak_if_removed": round(after, 4),
        "impact_score": round(impact, 4),
        "impact_pct": round((impact/baseline*100) if baseline > 0 else 0.0, 1),
    })

OUT.write_text(json.dumps({"topics": topics}, indent=2))
print(f"wrote {OUT}")
