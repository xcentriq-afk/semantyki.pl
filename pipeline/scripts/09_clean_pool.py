"""Clean the pair pool: drop pairs with junk/offensive words."""
import json

PAIRS = "pipeline/data/pairs.json"
PATHS = "pipeline/data/pair_paths.json"

pairs = json.load(open(PAIRS, encoding="utf-8"))
paths = json.load(open(PATHS, encoding="utf-8"))

BLOCK = {
    "chuj", "pierd", "kurwa", "jebać", "jebanie", "pierdolić", "gówno",
    "dupek", "cipa", "pizda", "srać", "sranie", "ruchanie", "pieprzyć",
    "suka", "skurwiel", "wkurwiać", "zajebisty", "zajebiście", "spierdalać",
    "dziwka", "kutas", "rzygać", "sracz", "kurewstwo", "pierdolenie",
}

out_pairs = []
out_paths = {}
for pair in pairs:
    key = f"{pair[0]}|{pair[1]}"
    path = paths[key]
    bad = any(
        len(w) <= 2
        or w in BLOCK
        or any(w.startswith(b) for b in BLOCK)
        for w in path
    )
    if bad:
        continue
    out_pairs.append(pair)
    out_paths[key] = path

json.dump(out_pairs, open(PAIRS, "w", encoding="utf-8"), ensure_ascii=False)
json.dump(out_paths, open(PATHS, "w", encoding="utf-8"), ensure_ascii=False)
print(f"kept {len(out_pairs)} of {len(pairs)} pairs")
