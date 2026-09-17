"""Calibrate shared-neighbor boost: how many shared top-K neighbors do related vs unrelated pairs have?"""
import json
import random

import numpy as np

WORDS = "pipeline/data/words.json"
TOPK = "pipeline/data/topk.npz"
random.seed(1)
rng = np.random.default_rng(1)

words = json.load(open(WORDS, encoding="utf-8"))
n = len(words)
idx = {w: i for i, w in enumerate(words)}
data = np.load(TOPK)
topk_idx = data["idx"]

K = 60
sets = [set(topk_idx[i, :K].tolist()) for i in range(n)]


def shared(a, b):
    if a not in idx or b not in idx:
        return None
    return len(sets[idx[a]] & sets[idx[b]])


related = [
    ("zarobek", "pieniądze"),
    ("praca", "zarobek"),
    ("praca", "pieniądze"),
    ("praca", "kariera"),
    ("pieniądze", "gotówka"),
    ("zarobek", "pensja"),
    ("praca", "zatrudnienie"),
    ("kot", "pies"),
    ("deszcz", "parasol"),
    ("chleb", "masło"),
    ("morze", "plaża"),
    ("król", "zamek"),
]
unrelated = [
    ("kot", "samochód"),
    ("chleb", "młotek"),
    ("deszcz", "komputer"),
    ("morze", "matematyka"),
    ("król", "trawa"),
    ("pieniądze", "krowa"),
    ("praca", "naleśnik"),
    ("kariera", "parasol"),
    ("zarobek", "motyl"),
    ("pies", "telewizor"),
]

print("=== pary powiązane ===")
for a, b in related:
    print(f"{a:15s} - {b:15s}: shared={shared(a, b)}")

print("=== pary niezwiązane ===")
for a, b in unrelated:
    print(f"{a:15s} - {b:15s}: shared={shared(a, b)}")

print("=== rozkład shared dla losowych par ===")
samples = []
for _ in range(300):
    a, b = rng.integers(0, n, size=2)
    if a != b:
        samples.append(len(sets[int(a)] & sets[int(b)]))
samples = np.array(samples)
for t in [0, 1, 2, 3, 4, 5, 6, 8, 10]:
    print(f"shared >= {t}: {100 * (samples >= t).mean():.1f}%")
