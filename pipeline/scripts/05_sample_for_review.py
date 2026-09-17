"""Sample word pairs per similarity bin for human/LLM quality review."""
import json
import random

import numpy as np

WORDS = "pipeline/data/words.json"
TOPK = "pipeline/data/topk.npz"
OUT = "pipeline/data/review_samples.md"
random.seed(7)

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
data = np.load(TOPK)
idx = data["idx"]
sim = data["sim"].astype(np.float32)

rank = {w: freq.get(w, 10 ** 9) for w in words}
common = sorted([i for i in range(n) if rank[words[i]] <= 30000], key=lambda i: random.random())[:400]
bins = [(0.40, 0.45), (0.45, 0.50), (0.50, 0.55), (0.55, 0.60), (0.60, 0.70)]

lines = ["# Pr\u00f3bki par s\u0142\u00f3w do oceny progu podobie\u0144stwa\n"]
for lo, hi in bins:
    lines.append(f"\n## Przedzia\u0142 kosinusa: {lo}\u2013{hi}\n")
    seen = set()
    for i in common:
        row_sim = sim[i]
        row_idx = idx[i]
        mask = (row_sim >= lo) & (row_sim < hi)
        taken = 0
        for j, s in zip(row_idx[mask], row_sim[mask]):
            pair = tuple(sorted((words[i], words[j])))
            if pair in seen:
                continue
            seen.add(pair)
            lines.append(f"- {pair[0]} \u2013 {pair[1]} ({s:.3f})")
            taken += 1
            if taken >= 3:
                break
        if len(seen) >= 18:
            break

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"written {OUT}")
