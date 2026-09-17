"""Compute top-K nearest neighbors (cosine) for every word; save indices + similarities."""
import json
import sys

import numpy as np

WORDS = "pipeline/data/words.json"
VECTORS = "pipeline/data/vectors.bin"
OUT = "pipeline/data/topk.npz"
K = 200
CHUNK = 2048

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
M = np.memmap(VECTORS, dtype=np.float32, mode="r").reshape(n, 300)
print(f"words: {n}", file=sys.stderr)

out_idx = np.zeros((n, K), dtype=np.uint32)
out_sim = np.zeros((n, K), dtype=np.float16)

for start in range(0, n, CHUNK):
    end = min(start + CHUNK, n)
    chunk = np.asarray(M[start:end], dtype=np.float32)
    sims = chunk @ np.asarray(M).T
    sims[:, start:end] = -1.0
    order = np.argpartition(-sims, K - 1, axis=1)[:, :K]
    for i in range(end - start):
        row_order = order[i]
        vals = sims[i, row_order]
        sort = np.argsort(-vals)
        out_idx[start + i] = row_order[sort]
        out_sim[start + i] = vals[sort].astype(np.float16)
    if start % 8192 == 0:
        print(f"processed {end}/{n}", file=sys.stderr)

np.savez_compressed(OUT, idx=out_idx, sim=out_sim)
print(f"saved {OUT}")
