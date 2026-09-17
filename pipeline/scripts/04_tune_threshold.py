"""Tune similarity threshold: degree stats + bidirectional BFS solvability on sampled pairs."""
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
data = np.load(TOPK)
idx = data["idx"]
sim = data["sim"].astype(np.float32)
print(f"words: {n}", file=sys.stderr)


def bidir_bfs(a, b, neigh, max_depth=12, cap=300000):
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
        if frontier_a.intersection(visited_b):
            return min(dist_a[x] + dist_b[x] for x in frontier_a.intersection(visited_b))
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
        if frontier_b.intersection(visited_a):
            return min(dist_b[x] + dist_a[x] for x in frontier_b.intersection(visited_a))
    return None


P = rng.integers(0, n, size=400)
pairs = [(int(P[i]), int(P[i + 1])) for i in range(0, 400, 2)]

print(f"{'threshold':>10} {'avg_deg':>8} {'median_deg':>10} {'isolated%':>9} {'solvable%':>9} {'mean_path':>9} {'median_path':>11}")
for t in [0.30, 0.35, 0.40, 0.42, 0.45, 0.48, 0.50, 0.55]:
    deg = (sim >= t).sum(axis=1)
    neigh = [idx[i, sim[i] >= t].tolist() for i in range(n)]
    paths = []
    solvable = 0
    for a, b in pairs:
        p = bidir_bfs(a, b, neigh)
        if p is not None:
            solvable += 1
            paths.append(p)
    if not paths:
        paths = [0]
    print(f"{t:>10.2f} {deg.mean():>8.2f} {np.median(deg):>10.1f} {100 * (deg == 0).mean():>8.1f}% "
          f"{100 * solvable / len(pairs):>8.1f}% {np.mean(paths):>9.2f} {np.median(paths):>11.1f}",
          flush=True)
