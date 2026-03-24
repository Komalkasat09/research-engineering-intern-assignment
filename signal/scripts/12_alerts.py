#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VEL = ROOT / "public" / "data" / "velocity.json"
COORD = ROOT / "public" / "data" / "coord.json"
OUT = ROOT / "public" / "data" / "alerts.json"

if not VEL.exists() or not COORD.exists():
    print("missing artifacts")
    raise SystemExit(0)

velocity = json.loads(VEL.read_text())
coord = json.loads(COORD.read_text())

by_topic = {}
for row in velocity:
    tid = row.get("topic_id")
    if not isinstance(tid, int) or tid < 0:
        continue
    by_topic.setdefault(tid, []).append(float(row.get("velocity", 0.0)))

coord_spike = sum(float(p.get("sync_count", 0)) for p in coord.get("top_pairs", [])) / max(len(coord.get("top_pairs", [])), 1)

alerts = []
for tid, values in by_topic.items():
    if len(values) < 8:
        continue
    baseline = values[:-5]
    recent = values[-5:]
    baseline_mean = sum(baseline)/len(baseline)
    baseline_std = (sum((x-baseline_mean)**2 for x in baseline)/len(baseline))**0.5 or 0.001
    z = (max(recent)-baseline_mean)/baseline_std
    score = z*0.7 + (coord_spike/8)*0.3
    if score < 1.2:
        continue
    severity = "high" if score > 2.5 else "medium" if score > 1.7 else "low"
    alerts.append({
        "topic_id": tid,
        "severity": severity,
        "score": round(score, 3),
        "velocity_z": round(z, 3),
        "coord_spike": round(coord_spike, 2),
        "reason": "Velocity anomaly with coordination lift"
    })

OUT.write_text(json.dumps({"alerts": alerts}, indent=2))
print(f"wrote {OUT}")
