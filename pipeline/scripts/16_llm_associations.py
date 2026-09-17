"""Build an association dictionary using OpenCode Go LLM (glm-5.3-flash).

For each common word, asks the model for strongly associated Polish single words,
filters them to the game vocabulary and saves associations.json.
"""
import json
import re
import sys
import time
import uuid
import urllib.request

WORDS = "pipeline/data/words.json"
FREQ = "pipeline/data/freq.json"
OUT = "pipeline/data/associations.json"
CHECKPOINT = "pipeline/data/associations.partial.json"
AUTH = None

API = "https://opencode.ai/zen/go/v1/chat/completions"
MODEL = "glm-5.3-flash"
CONCURRENCY = 8
TARGETS_LIMIT = None
MAX_ASSOC = 15

WORD_RE = re.compile(r"^[a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c][a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c-]*$")

words = json.load(open(WORDS, encoding="utf-8"))
freq = json.load(open(FREQ, encoding="utf-8"))
vocab = set(words)

from pathlib import Path

auth = json.load(open(str(Path.home() / ".local/share/opencode/auth.json"), encoding="utf-8"))
API_KEY = auth["opencode-go"]["key"]
SESSION = str(uuid.uuid4())

targets = sorted(
    (w for w in words if freq.get(w, 10 ** 9) <= 75000),
    key=lambda w: freq[w],
)
if TARGETS_LIMIT:
    targets = targets[:TARGETS_LIMIT]
print(f"targets: {len(targets)}", file=sys.stderr)

try:
    results = json.load(open(CHECKPOINT, encoding="utf-8"))
except FileNotFoundError:
    results = {}
print(f"resume from checkpoint: {len(results)} done", file=sys.stderr)


def fold(s):
    return s.replace("ł", "l").replace("Ł", "l")


folded_to_word = {}
for w in vocab:
    folded_to_word.setdefault(fold(w), w)


def call(word):
    prompt = (
        f"Wypisz do 20 pojedynczych polskich słów (forma podstawowa, bez odmiany, "
        f"bez wyrażeń wielowyrazowych), które najsilniej kojarzą się ze słowem: {word}. "
        f"Odpowiadaj wyłącznie słowami oddzielonymi przecinkami."
    )
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 140,
        "temperature": 0.3,
    }).encode()
    for attempt in range(4):
        req = urllib.request.Request(
            API,
            data=body,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "x-opencode-session": SESSION,
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                ),
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
            content = data["choices"][0]["message"]["content"] or ""
            assoc = []
            for tok in content.split(","):
                tok = tok.strip().lower().strip(" .;:\"'()[]„”")
                if WORD_RE.match(tok) and tok != word:
                    if tok in vocab:
                        assoc.append(tok)
                    else:
                        canon = folded_to_word.get(fold(tok))
                        if canon and canon != word:
                            assoc.append(canon)
            seen = set()
            out = []
            for a in assoc:
                if a not in seen:
                    seen.add(a)
                    out.append(a)
                if len(out) >= MAX_ASSOC:
                    break
            return out
        except Exception as e:
            print(f"retry {word}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    return []


from concurrent.futures import ThreadPoolExecutor
from threading import Lock

save_lock = Lock()
done_since_save = 0


def save_checkpoint():
    global done_since_save
    with save_lock:
        snapshot = dict(results)
        json.dump(snapshot, open(CHECKPOINT, "w", encoding="utf-8"), ensure_ascii=False)
    done_since_save = 0


def worker(w):
    global done_since_save
    if results.get(w):
        return
    assoc = call(w)
    if assoc:
        with save_lock:
            results[w] = assoc
    done_since_save += 1
    if done_since_save >= 50:
        save_checkpoint()
        print(
            f"progress: {len(results)}/{len(targets)} ({(time.time() - t0):.0f}s)",
            flush=True,
        )


t0 = time.time()
with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
    list(ex.map(worker, targets))

json.dump(dict(results), open(CHECKPOINT, "w", encoding="utf-8"), ensure_ascii=False)
assoc = {w: v for w, v in results.items() if v}
json.dump(assoc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
non_empty = sum(1 for v in results.values() if v)
print(f"done: {len(results)} words, with associations: {non_empty}, elapsed: {time.time() - t0:.0f}s")
print(f"saved {OUT}")
