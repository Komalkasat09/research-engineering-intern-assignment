#!/usr/bin/env python3
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "data" / "faiss_meta.json"
OUT = ROOT / "public" / "data" / "narrative_diff.json"

STOP = {
    "the","a","an","is","it","in","of","to","and","or","but","not","that","this","was","are",
    "for","on","at","by","be","as","we","they","with","have","from","has","its","been","were","will",
}

def words(text: str):
    return [w for w in ''.join(c.lower() if c.isalpha() else ' ' for c in text).split() if len(w) > 4 and w not in STOP]

if not META.exists():
    print("missing faiss_meta.json")
    raise SystemExit(0)

posts = json.loads(META.read_text()).get("posts", [])
by_topic = defaultdict(list)
for p in posts:
    tid = p.get("topic_id")
    if isinstance(tid, int) and tid >= 0:
        by_topic[tid].append(p)

result = {"diffs": []}
for tid, rows in by_topic.items():
    rows = sorted(rows, key=lambda x: x.get("created_utc", 0))
    mid = len(rows) // 2
    early = rows[:mid]
    recent = rows[mid:]

    c_early = Counter()
    c_recent = Counter()
    for r in early:
        c_early.update(words(r.get("text", "")))
    for r in recent:
        c_recent.update(words(r.get("text", "")))

    early_terms = [t for t,_ in c_early.most_common(50)]
    recent_terms = [t for t,_ in c_recent.most_common(80)]
    added = [{"term": t, "count": c_recent[t]} for t in recent_terms if t not in set(early_terms)][:8]
    dropped = [{"term": t, "count": c_early[t]} for t in early_terms if t not in set(recent_terms)][:8]

    result["diffs"].append({"topic_id": tid, "added": added, "dropped": dropped})

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2))
print(f"wrote {OUT}")
