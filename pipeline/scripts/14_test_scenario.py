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


p = get("/api/puzzle?mode=daily")
print("zagadka:", p["start"], "->", p["target"])
board = [p["start"], p["target"]]
for w in ["zarobek", "pieniądze", "praca", "pensja", "gotówka"]:
    r = post("/api/check", {"word": w, "existing": board})
    board.append(w)
    if r.get("matches"):
        desc = ", ".join(f"{m['word']} ({round(m['score']*100)}%)" for m in r["matches"])
        print(f"+ {w:12s} -> łączy się z: {desc}")
    else:
        b = r.get("best") or {}
        print(f"~ {w:12s} -> próżnia; najbliższe: {b.get('word','-')} ({round(b.get('score',0)*100)}%)")
