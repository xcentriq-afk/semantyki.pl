"""Calibrate common-gate rank for shared-neighbor boost."""
import json

import numpy as np
from scipy import sparse

WORDS = "pipeline/data/words.json"
PASS1 = "pipeline/data/pass1.npz"

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
freq = json.load(open("pipeline/data/freq.json", encoding="utf-8"))
rank = np.array([freq.get(w, 10 ** 9) for w in words])
print("ranki: zarobek, pensja, gotówka, aak, aalen, adagio:",
      [int(rank[words.index(w)]) for w in ["zarobek", "pensja", "gotówka", "aak", "aalen", "adagio"]])

d = np.load(PASS1)
idx = d["idx"]
sim = d["sim"].astype(np.float32)

K = 60
rows = np.repeat(np.arange(n), K)
cols = idx[:, :K].ravel()
data = np.ones_like(rows, dtype=np.int8)
A = sparse.csr_matrix((data, (rows, cols)), shape=(n, n))

MIN_COS = 0.40
CUTOFF = 10

for gate in [30000, 50000, 75000, 100000, 150000]:
    common = rank <= gate
    extra = 0
    samples = []
    CHUNK = 4096
    for start in range(0, n, CHUNK):
        end = min(start + CHUNK, n)
        Sc = (A[start:end] @ A.T).toarray()
        Sc[:, : start] = 0
        np.fill_diagonal(Sc[start:end, start:end], 0)
        mask = Sc >= CUTOFF
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
            new_pairs = jj[(scores >= MIN_COS) & (scores < 0.50)]
            extra += len(new_pairs)
            if gate == 100000 and len(samples) < 15:
                for j in new_pairs[:2]:
                    samples.append((words[i], words[j], int(Sc[k, j]), float(scores[jj == j][0])))
    print(f"gate={gate:6d}: common={common.sum():6d}  new_pairs={extra:,}")
    if gate == 100000:
        for a, b, sh, co in samples[:10]:
            print(f"    {a:16s} - {b:16s} shared={sh} cos={co:.3f}")
