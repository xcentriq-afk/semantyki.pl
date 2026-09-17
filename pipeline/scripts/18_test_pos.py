import json
import urllib.request

BASE = "http://localhost:3000"


def get(url):
    return json.loads(urllib.request.urlopen(BASE + url).read())


def post(url, data):
    req = urllib.request.Request(
        BASE + url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read())


p = get("/api/puzzle?mode=daily")
print("dzienna:", p)

pos = json.load(open("pipeline/data/pos.json", encoding="utf-8"))
for w in [p["start"], p["target"]]:
    print("  POS:", w, pos.get(w))

pp = get("/api/puzzle?mode=practice&pos=rzeczownik,przymiotnik")
print("trening (rzecz+przym):", pp["start"], "->", pp["target"])

try:
    pv = get("/api/puzzle?mode=practice&pos=czasownik")
    print("trening (czasownik):", pv["start"], "->", pv["target"])
except Exception as e:
    print("trening (czasownik): 404 no-pairs (oczekiwane)")

r1 = post("/api/check", {"word": "biegać", "existing": [pp["start"], pp["target"]],
                         "pos": ["rzeczownik", "przymiotnik"]})
print("check czasownik przy rzecz+przym:", r1)

r4 = post("/api/check", {"word": "biegać", "existing": [pp["start"], pp["target"]],
                         "pos": ["czasownik"]})
print("check czasownik przy czasownik:", r4.get("ok"), r4.get("connected"),
      [f"{m['word']} {round(m['score']*100)}%" for m in r4.get("matches", [])])

r3 = post("/api/check", {"word": "pies", "existing": [pp["start"], pp["target"]],
                         "pos": ["rzeczownik", "przymiotnik"]})
print("check pies (rzecz) przy rzecz+przym:", r3.get("ok"), r3.get("connected"),
      [f"{m['word']} {round(m['score']*100)}%" for m in r3.get("matches", [])])
