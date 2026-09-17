"""Record frequency rank (line order in vec file) for matched words."""
import gzip
import json
import sys

VEC_GZ = "pipeline/data/cc.pl.300.vec.gz"
WORDS = "pipeline/data/words.json"
OUT = "pipeline/data/freq.json"

words = json.load(open(WORDS, encoding="utf-8"))
wanted = set(words)
freq = {}
rank = 0
with gzip.open(VEC_GZ, "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        rank += 1
        if rank == 1:
            continue
        sp = line.find(" ")
        word = line[:sp]
        if word in wanted:
            freq[word] = rank
            wanted.discard(word)
            if not wanted:
                break
        if rank % 5000000 == 0:
            print(f"scanned {rank}, matched {len(freq)}", file=sys.stderr)

missing = [w for w in words if w not in freq]
print(f"matched {len(freq)}/{len(words)}, missing {len(missing)}", file=sys.stderr)
json.dump(freq, open(OUT, "w"))
print(f"saved {OUT}")
