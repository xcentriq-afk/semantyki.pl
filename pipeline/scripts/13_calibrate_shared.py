"""Calibrate joint rule restricted to common words: shared >= cutoff AND cos >= min_cos AND both common."""
import json

import numpy as np
from scipy import sparse

WORDS = "pipeline/data/words.json"
PASS1 = "pipeline/data/pass1.npz"

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
rank = {w: freq.get(w, 10 ** 9) for w in words}
common = np.array([rank[w] <= 30000 for w in words])
print(f"common words: {common.sum()}")

d = np.load(PASS1)
idx = d["idx"]
sim = d["sim"].astype(np.float32)

K = 60
rows = np.repeat(np.arange(n), K)
cols = idx[:, :K].ravel()
data = np.ones_like(rows, dtype=np.int8)
A = sparse.csr_matrix((data, (rows, cols)), shape=(n, n))

for min_cos in [0.30, 0.35, 0.40]:
    print(f"\n=== min_cos={min_cos}, threshold=0.50, tylko common x common ===")
    base_deg = (sim >= 0.50).sum(axis=1)
    for cutoff in [8, 10, 12]:
        extra = np.zeros(n, dtype=np.int32)
        samples = []
        CHUNK = 4096
        for start in range(0, n, CHUNK):
            end = min(start + CHUNK, n)
            Sc = (A[start:end] @ A.T).toarray()
            Sc[:, : start] = 0
            np.fill_diagonal(Sc[start:end, start:end], 0)
            mask = Sc >= cutoff
            for k in range(end - start):
                i = start + k
                if not common[i]:
                    continue
                jj = np.nonzero(mask[k])[0]
                if len(jj) == 0:
                    continue
                jj = jj[common[jj]]
                if len(jj) == 0:
                    continue
                scores = np.array(
                    [sim[i][idx[i] == j][0] if (idx[i] == j).any() else -1.0 for j in jj]
                )
                new_pairs = jj[(scores >= min_cos) & (scores < 0.50)]
                extra[i] += len(new_pairs)
                if len(samples) < 20:
                    for j in new_pairs[:2]:
                        samples.append((words[i], words[j], int(Sc[k, j]), float(scores[jj == j][0])))
        total = base_deg + extra
        print(f"cutoff={cutoff:2d}: new={extra.sum():,} avg={total[common].mean():.1f} median={np.median(total[common]):.0f}")
        if cutoff == 10:
            print("  przykłady:")
            for a, b, sh, co in samples[:10]:
                print(f"    {a:16s} - {b:16s} shared={sh} cos={co:.3f}")
