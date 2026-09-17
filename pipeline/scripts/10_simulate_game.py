"""Simulate a full game via the HTTP API: solve today's puzzle using its known path."""
import json
import urllib.request

BASE = "http://localhost:3000"


def post(url, data):
    req = urllib.request.Request(
        BASE + url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read())


def get(url):
    return json.loads(urllib.request.urlopen(BASE + url).read())


puzzle = get("/api/puzzle?mode=daily")
start, target = puzzle["start"], puzzle["target"]
print("zagadka:", start, "->", target)

paths = json.load(open("pipeline/data/pair_paths.json", encoding="utf-8"))
key = f"{start}|{target}"
path = paths.get(key)
if path is None:
    print("BRAK ścieżki w pair_paths.json — para z pary odwrotnej?")
    key2 = f"{target}|{start}"
    path = paths.get(key2, [])[::-1] if key2 in paths else None
if path is None:
    print("KONIEC: para nie ma zapisanej ścieżki (możliwa para treningowa?!)")
    raise SystemExit(1)

print("ścieżka:", " -> ".join(path))

board = [start, target]
for w in path[1:-1]:
    res = post("/api/check", {"word": w, "existing": board})
    board.append(w)
    status = "OK linked" if res.get("connected") else "BRAK POLACZENIA"
    print(f"  + {w:20s} best={res.get('best', {}).get('word', '-'):15s} "
          f"score={res.get('best', {}).get('score', 0):.3f} {status}")
    assert res["ok"] and res["connected"], f"slowo {w} nie połączyło się!"

print("WYGRANA: plansza rozwiązalna krok po kroku")
