"""Generate a pool of solvable word pairs for daily puzzles + practice."""
import json
import random
import sys
import time
from collections import deque

import numpy as np

WORDS = "pipeline/data/words.json"
TOPK = "pipeline/data/topk.npz"
OUT_PAIRS = "pipeline/data/pairs.json"
OUT_PATHS = "pipeline/data/pair_paths.json"
THRESHOLD = 0.35
MIN_PATH = 2
MAX_PATH = 8
TARGET = 1200
VISIT_CAP = 200000

random.seed(2026)
rng = np.random.default_rng(2026)

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
rank = {w: freq.get(w, 10 ** 9) for w in words}
pos = json.load(open("pipeline/data/pos.json", encoding="utf-8"))
ALLOWED_POS = {"rzeczownik", "przymiotnik"}
data = np.load(TOPK)
idx = data["idx"]
sim = data["sim"].astype(np.float32)

allowed_word = {w for w in words if set(pos.get(w, [])) & ALLOWED_POS}
print(f"allowed words (rzecz.+przym.): {len(allowed_word)}", file=sys.stderr)

common_idx = [i for i in range(n) if rank[words[i]] <= 20000 and words[i] in allowed_word]
rng.shuffle(common_idx)
print(f"candidates: {len(common_idx)}", file=sys.stderr)

allowed_idx = {i for i in range(n) if words[i] in allowed_word}
neigh = [
    [j for j in idx[i, sim[i] >= THRESHOLD].tolist() if j in allowed_idx]
    for i in range(n)
]


def find_path(a, b):
    if a == b:
        return None
    visited = {a: 0}
    prev = {a: None}
    queue = deque([a])
    while queue:
        u = queue.popleft()
        if u == b:
            path = []
            cur = b
            while cur is not None:
                path.append(cur)
                cur = prev[cur]
            path.reverse()
            return path
        if visited[u] >= MAX_PATH:
            continue
        for v in neigh[u]:
            if v not in visited:
                visited[v] = visited[u] + 1
                prev[v] = u
                queue.append(v)
                if len(visited) > VISIT_CAP:
                    return None
    return None


pairs = []
pair_paths = {}
attempts = 0
t0 = time.time()
max_attempts = (len(common_idx) - 2) // 2
print(f"common_idx: {len(common_idx)}, max_attempts: {max_attempts}", file=sys.stderr)
while len(pairs) < TARGET and attempts < max_attempts:
    attempts += 1
    a = int(common_idx[2 * attempts])
    b = int(common_idx[2 * attempts + 1])
    if words[a] == words[b]:
        continue
    path = find_path(a, b)
    if path is None:
        continue
    path_len = len(path) - 2
    if not (MIN_PATH <= path_len <= MAX_PATH):
        continue
    pair = [words[a], words[b]]
    if pair in pairs or pair[::-1] in pairs:
        continue
    pairs.append(pair)
    pair_paths[f"{words[a]}|{words[b]}"] = [words[i] for i in path]
    if len(pairs) % 50 == 0:
        elapsed = time.time() - t0
        print(f"pairs: {len(pairs)}/{TARGET} attempts: {attempts} elapsed: {elapsed:.0f}s", file=sys.stderr, flush=True)

json.dump(pairs, open(OUT_PAIRS, "w", encoding="utf-8"), ensure_ascii=False)
json.dump(pair_paths, open(OUT_PATHS, "w", encoding="utf-8"), ensure_ascii=False)
print(f"saved {len(pairs)} pairs")
