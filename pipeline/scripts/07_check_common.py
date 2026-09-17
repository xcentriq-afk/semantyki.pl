"""Check degree/solvability at candidate thresholds, restricted to common words."""
import json
import random
import sys

import numpy as np

WORDS = "pipeline/data/words.json"
TOPK = "pipeline/data/topk.npz"
random.seed(42)
rng = np.random.default_rng(42)

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
rank = {w: freq.get(w, 10 ** 9) for w in words}
data = np.load(TOPK)
idx = data["idx"]
sim = data["sim"].astype(np.float32)

common_idx = sorted([i for i in range(n) if rank[words[i]] <= 20000])
print(f"common (rank<=20000): {len(common_idx)}", file=sys.stderr)
rng.shuffle(common_idx)
sample = common_idx[:300]
pairs = [(int(sample[i]), int(sample[i + 1])) for i in range(0, 300, 2)]


def bidir_bfs(a, b, neigh, max_depth=14, cap=500000):
    if a == b:
        return 0
    dist_a = {a: 0}
    dist_b = {b: 0}
    visited_a = {a}
    visited_b = {b}
    frontier_a = {a}
    frontier_b = {b}
    total = 2
    for depth in range(1, max_depth + 1):
        new_a = set()
        for node in frontier_a:
            for nb in neigh[node]:
                if nb not in visited_a:
                    if nb in visited_b:
                        return dist_a[node] + 1 + dist_b[nb]
                    visited_a.add(nb)
                    dist_a[nb] = depth
                    new_a.add(nb)
        frontier_a = new_a
        total += len(frontier_a)
        if total > cap:
            return None
        new_b = set()
        for node in frontier_b:
            for nb in neigh[node]:
                if nb not in visited_b:
                    if nb in visited_a:
                        return dist_b[node] + 1 + dist_a[nb]
                    visited_b.add(nb)
                    dist_b[nb] = depth
                    new_b.add(nb)
        frontier_b = new_b
        total += len(frontier_b)
        if total > cap:
            return None
    return None


for t in [0.50, 0.52, 0.53, 0.55]:
    neigh = [idx[i, sim[i] >= t].tolist() for i in range(n)]
    deg = np.array([len(neigh[i]) for i in common_idx])
    paths = []
    solvable = 0
    for a, b in pairs:
        p = bidir_bfs(a, b, neigh)
        if p is not None:
            solvable += 1
            paths.append(p)
    print(f"t={t:.2f} avg_deg={deg.mean():.1f} median_deg={np.median(deg):.0f} "
          f"solvable={100 * solvable / len(pairs):.1f}% mean_path={np.mean(paths):.2f} "
          f"median_path={np.median(paths):.0f}", flush=True)
