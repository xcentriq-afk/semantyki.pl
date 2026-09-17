"""Generate a pool of solvable word pairs (path length 3-8) for daily puzzles + practice."""
import json
import random
import sys
import time

import numpy as np

WORDS = "pipeline/data/words.json"
TOPK = "pipeline/data/topk.npz"
OUT_PAIRS = "pipeline/data/pairs.json"
OUT_PATHS = "pipeline/data/pair_paths.json"
THRESHOLD = 0.52
MIN_PATH = 3
MAX_PATH = 8
TARGET = 1200

random.seed(2026)
rng = np.random.default_rng(2026)

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
rank = {w: freq.get(w, 10 ** 9) for w in words}
data = np.load(TOPK)
idx = data["idx"]
sim = data["sim"].astype(np.float32)

common_idx = [i for i in range(n) if rank[words[i]] <= 20000]
rng.shuffle(common_idx)
print(f"candidates: {len(common_idx)}", file=sys.stderr)

neigh = [idx[i, sim[i] >= THRESHOLD].tolist() for i in range(n)]


def bidir_path(a, b, max_depth=MAX_PATH, cap=200000):
    if a == b:
        return None
    prev_a = {a: None}
    prev_b = {b: None}
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
                        path = [nb]
                        cur = node
                        while cur is not None:
                            path.append(cur)
                            cur = prev_a[cur]
                        path.reverse()
                        cur = prev_b[nb]
                        while cur is not None:
                            path.append(cur)
                            cur = prev_b[cur]
                        return path
                    visited_a.add(nb)
                    prev_a[nb] = node
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
                        path_b = [node]
                        cur = prev_b[node]
                        while cur is not None:
                            path_b.append(cur)
                            cur = prev_b[cur]
                        path_a = [nb]
                        cur = prev_a[nb]
                        while cur is not None:
                            path_a.append(cur)
                            cur = prev_a[cur]
                        return path_a[::-1] + path_b
                    visited_b.add(nb)
                    prev_b[nb] = node
                    new_b.add(nb)
        frontier_b = new_b
        total += len(frontier_b)
        if total > cap:
            return None
    return None


pairs = []
pair_paths = {}
attempts = 0
t0 = time.time()
while len(pairs) < TARGET and attempts < len(common_idx) - 1:
    attempts += 1
    a = int(common_idx[2 * attempts])
    b = int(common_idx[2 * attempts + 1])
    if words[a] == words[b]:
        continue
    path = bidir_path(a, b)
    if path is None:
        continue
    path_len = len(path) - 2
    if not (MIN_PATH <= path_len <= MAX_PATH):
        continue
    if words[path[0]] != words[a] or words[path[-1]] != words[b]:
        continue
    pair = [words[a], words[b]]
    if pair in pairs or pair[::-1] in pairs:
        continue
    pairs.append(pair)
    pair_paths[f"{words[a]}|{words[b]}"] = [words[i] for i in path]
    if len(pairs) % 50 == 0:
        elapsed = time.time() - t0
        print(f"pairs: {len(pairs)}/{TARGET} attempts: {attempts} elapsed: {elapsed:.0f}s", file=sys.stderr, flush=True)

valid_pairs = []
valid_paths = {}
word2idx = {w: i for i, w in enumerate(words)}
for pair in pairs:
    path = pair_paths[f"{pair[0]}|{pair[1]}"]
    ok = True
    for i in range(len(path) - 1):
        u, v = word2idx[path[i]], word2idx[path[i + 1]]
        if v not in neigh[u]:
            ok = False
            break
    if ok:
        valid_pairs.append(pair)
        valid_paths[f"{pair[0]}|{pair[1]}"] = path

json.dump(valid_pairs, open(OUT_PAIRS, "w", encoding="utf-8"), ensure_ascii=False)
json.dump(valid_paths, open(OUT_PATHS, "w", encoding="utf-8"), ensure_ascii=False)
print(f"saved {len(valid_pairs)} pairs ({len(pairs) - len(valid_pairs)} invalid dropped)")
