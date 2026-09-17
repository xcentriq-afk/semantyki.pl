"""Boost weights for dictionary relations (shared by graph build and pair generation)."""
import json

W_SYN = 0.85
W_HYP = 0.62
W_SHARED_SYN = 0.60
W_SHARED_NB = 0.56
W_LLM_ASSOC = 0.60
NB_CUTOFF = 10
NB_K = 60
MIN_COS = 0.40


def load_boost_data(words):
    syn = json.load(open("pipeline/data/synonyms.json", encoding="utf-8"))
    word2i = {w: i for i, w in enumerate(words)}
    direct = {}
    syn_sets = {}
    syn_rev = {}
    for w, rels in syn.items():
        i = word2i.get(w)
        if i is None:
            continue
        for rel, targets in rels.items():
            weight = W_SYN if rel == "syn" else W_HYP
            for x in targets:
                j = word2i.get(x)
                if j is not None and j != i:
                    direct.setdefault(i, []).append((j, weight))
        s = {word2i[x] for x in rels.get("syn", []) if x in word2i}
        if s:
            syn_sets[i] = s
            for j in s:
                syn_rev.setdefault(j, []).append(i)
    try:
        assoc = json.load(open("pipeline/data/associations.json", encoding="utf-8"))
    except FileNotFoundError:
        assoc = {}
    for w, targets in assoc.items():
        i = word2i.get(w)
        if i is None:
            continue
        for x in targets:
            j = word2i.get(x)
            if j is not None and j != i:
                direct.setdefault(i, []).append((j, W_LLM_ASSOC))
    print(f"direct relation pairs: {sum(len(v) for v in direct.values())}")
    print(f"words with synonyms: {len(syn_sets)}")
    return direct, syn_sets, syn_rev


def apply_boosts(row, i, direct, syn_sets, syn_rev):
    for (j, weight) in direct.get(i, []):
        if weight > row[j]:
            row[j] = weight
    for s in syn_sets.get(i, ()):
        for j in syn_rev.get(s, []):
            if j != i and W_SHARED_SYN > row[j]:
                row[j] = W_SHARED_SYN


def build_shared_lists(topk_idx):
    import numpy as np
    from scipy import sparse

    n = topk_idx.shape[0]
    rows = np.repeat(np.arange(n), NB_K)
    cols = topk_idx[:, :NB_K].ravel()
    data = np.ones_like(rows, dtype=np.int8)
    A = sparse.csr_matrix((data, (rows, cols)), shape=(n, n))
    shared_lists = []
    CHUNK = 2048
    for start in range(0, n, CHUNK):
        end = min(start + CHUNK, n)
        S = A[start:end] @ A.T
        S = S.toarray()
        np.fill_diagonal(S[start:end, start:end], 0)
        S[:, :start] = 0
        for i in range(end - start):
            row_i = i + start
            cols_ge = np.nonzero(S[i] >= NB_CUTOFF)[0]
            cols_ge = cols_ge[cols_ge > row_i]
            shared_lists.append(cols_ge.astype(np.int32))
    print(f"shared lists built: {sum(len(l) for l in shared_lists)} pairs")
    return shared_lists


def apply_shared_nb(row, raw_row, shared_list):
    for j in shared_list:
        if raw_row[j] >= MIN_COS and W_SHARED_NB > row[j]:
            row[j] = W_SHARED_NB
