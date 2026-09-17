"""Compute top-K nearest neighbors (cosine + dictionary + shared-neighbor boosts) for every word."""
import json
import sys

import numpy as np

from simboost import (
    NB_K,
    apply_boosts,
    apply_shared_nb,
    build_shared_lists,
    load_boost_data,
)

WORDS = "pipeline/data/words.json"
VECTORS = "pipeline/data/vectors.bin"
OUT = "pipeline/data/topk.npz"
OUT_NB = "pipeline/data/neighbors60.bin"
K = 500
CHUNK = 2048

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
M = np.memmap(VECTORS, dtype=np.float32, mode="r").reshape(n, 300)
print(f"words: {n}", file=sys.stderr)

direct, syn_sets, syn_rev = load_boost_data(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
common = np.array([freq.get(w, 10 ** 9) <= 75000 for w in words])


def compute_pass():
    out_idx = np.zeros((n, K), dtype=np.uint32)
    out_sim = np.zeros((n, K), dtype=np.float16)
    for start in range(0, n, CHUNK):
        end = min(start + CHUNK, n)
        chunk = np.asarray(M[start:end], dtype=np.float32)
        sims = chunk @ np.asarray(M).T
        diag = np.arange(end - start)
        sims[diag, diag + start] = -1.0
        for row_i in range(end - start):
            apply_boosts(sims[row_i], start + row_i, direct, syn_sets, syn_rev)
        order = np.argpartition(-sims, K - 1, axis=1)[:, :K]
        for i in range(end - start):
            row_order = order[i]
            vals = sims[i, row_order]
            sort = np.argsort(-vals)
            out_idx[start + i] = row_order[sort]
            out_sim[start + i] = vals[sort].astype(np.float16)
        if start % 8192 == 0:
            print(f"pass processed {end}/{n}", file=sys.stderr)
    return out_idx, out_sim


print("pass 1: cosine + dictionary relations", file=sys.stderr)
pass1_idx, pass1_sim = compute_pass()
np.savez_compressed("pipeline/data/pass1.npz", idx=pass1_idx, sim=pass1_sim)

print("building shared-neighbor lists", file=sys.stderr)
shared_lists = build_shared_lists(pass1_idx)

print("pass 2: + shared-neighbor boosts", file=sys.stderr)
out_idx = np.zeros((n, K), dtype=np.uint32)
out_sim = np.zeros((n, K), dtype=np.float16)
for start in range(0, n, CHUNK):
    end = min(start + CHUNK, n)
    chunk = np.asarray(M[start:end], dtype=np.float32)
    sims = chunk @ np.asarray(M).T
    diag = np.arange(end - start)
    sims[diag, diag + start] = -1.0
    for row_i in range(end - start):
        i = start + row_i
        raw_row = sims[row_i].copy()
        apply_boosts(sims[row_i], i, direct, syn_sets, syn_rev)
        if common[i]:
            apply_shared_nb(sims[row_i], raw_row, shared_lists[i])
    order = np.argpartition(-sims, K - 1, axis=1)[:, :K]
    for i in range(end - start):
        row_order = order[i]
        vals = sims[i, row_order]
        sort = np.argsort(-vals)
        out_idx[start + i] = row_order[sort]
        out_sim[start + i] = vals[sort].astype(np.float16)
    if start % 8192 == 0:
        print(f"pass2 processed {end}/{n}", file=sys.stderr)

np.savez_compressed(OUT, idx=out_idx, sim=out_sim)

with open(OUT_NB, "wb") as f:
    np.asarray([n, NB_K], dtype=np.uint32).tofile(f)
    out_idx[:, :NB_K].astype(np.uint32).tofile(f)
print(f"saved {OUT} and {OUT_NB}")
