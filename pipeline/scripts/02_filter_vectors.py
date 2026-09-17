"""Filter cc.pl.300.vec.gz to Wiktionary lemmas; save normalized vectors + word list."""
import gzip
import json
import sys

import numpy as np

VEC_GZ = "pipeline/data/cc.pl.300.vec.gz"
LEMMAS = "pipeline/data/lemmas.txt"
OUT_WORDS = "pipeline/data/words.json"
OUT_VECTORS = "pipeline/data/vectors.bin"
DIM = 300

with open(LEMMAS, encoding="utf-8") as f:
    lemmas = {line.strip() for line in f}
print(f"lemmas loaded: {len(lemmas)}", file=sys.stderr)

words = []
buf_words = []
buf_rows = []


def flush(fid):
    global buf_words, buf_rows
    if buf_words:
        arr = np.asarray(buf_rows, dtype=np.float32)
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        arr /= norms
        arr.tofile(fid)
        words.extend(buf_words)
        buf_words = []
        buf_rows = []
        print(f"kept so far: {len(words)}", file=sys.stderr)


OUT_VECTORS_RAW = "pipeline/data/vectors_raw.bin"
raw_fid = open(OUT_VECTORS_RAW, "wb")

line_no = 0
with gzip.open(VEC_GZ, "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        line_no += 1
        if line_no == 1:
            vocab, dim = line.split()
            print(f"vec header: vocab={vocab} dim={dim}", file=sys.stderr)
            continue
        parts = line.rstrip("\n").split(" ")
        word = parts[0]
        if len(word) < 3 or word not in lemmas:
            continue
        try:
            vec = np.fromstring(" ".join(parts[1:]), dtype=np.float32, sep=" ")
        except ValueError:
            continue
        if vec.shape[0] != DIM:
            continue
        buf_words.append(word)
        buf_rows.append(vec)
        if len(buf_words) >= 20000:
            flush(raw_fid)
        if line_no % 5000000 == 0:
            print(f"scanned {line_no} lines", file=sys.stderr)

flush(raw_fid)
print(f"matched words: {len(words)}", file=sys.stderr)

order = sorted(range(len(words)), key=lambda i: words[i])
sorted_words = [words[i] for i in order]

raw = np.memmap(OUT_VECTORS_RAW, dtype=np.float32, mode="r")
raw = np.asarray(raw).reshape(len(words), DIM)
matrix = np.empty((len(words), DIM), dtype=np.float32)
for new_idx, old_idx in enumerate(order):
    matrix[new_idx] = raw[old_idx]

matrix.tofile(OUT_VECTORS)
with open(OUT_WORDS, "w", encoding="utf-8") as f:
    json.dump(sorted_words, f, ensure_ascii=False)

print(f"saved {len(sorted_words)} words to {OUT_WORDS} and vectors to {OUT_VECTORS}")

