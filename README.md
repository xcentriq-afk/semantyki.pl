# SYMANTYKA.pl

Polska gra słowna inspirowana **Linxicon**: połącz dwa losowe słowa łańcuchem
wyrazów powiązanych znaczeniowo. Dopisujesz słowa — jeśli nowe słowo jest
wystarczająco bliskie znaczeniowo istniejącemu, powstaje połączenie. Wygrywasz,
gdy oba słowa docelowe znajdą się w jednym łańcuchu. Im mniej słów, tym lepiej.

- **Zagadka dnia** — jedna para słów dziennie (deterministyczna, z seedu daty)
- **Trening** — nielimitowane losowe pary

## Jak to działa

- Słownik: polskie lematy z pl.wiktionary — wszystkie części mowy z etykietami POS
  (`pos.json`); zagadka dnia zawsze rzeczownik+przymiotnik, w treningu gracz wybiera
  kategorie w checklistcie przed nową grą (domyślnie rzecz.+przym.)
- Podobieństwo znaczeniowe: embeddingi [fastText cc.pl.300](https://fasttext.cc/docs/en/crawl-vectors.html) (kosinus)
  **+ relacje słownikowe z pl.wiktionary**: synonimy (85%), hiperonimy/hiponimy (62%),
  wspólny synonim (60%) **+ wspólni sąsiedzi wektorowi** (≥10 wspólnych sąsiadów
  top-60 i kosinus ≥ 0,40 → 56%, tylko słowa popularne) — dlatego „hala" łączy się
  z „pomieszczeniem", a „zarobek" z „pieniędzmi"
- Próg połączenia: **0.35** (jak w oryginalnym Linxiconie; dobrany eksperymentalnie)
- Pary dziennie: losowe pary połączone ścieżką 3–8 słów, weryfikowane BFS-em
- Nowe słowo łączy się ze **wszystkimi** słowami powyżej progu (wiele krawędzi)
- Formy pisane bez polskich znaków są akceptowane („zolw” → „żółw")

## Uruchomienie

```bash
npm install
npm run dev   # http://localhost:3000
```

Dane leksykonu (53 933 słowa, wektory ~65 MB) nie są w repo.
Wygeneruj je pipeline'em (wymaga Pythona 3 + numpy):

```bash
cd pipeline/scripts
python 01_extract_lemmas.py   # pobiera dump Wiktionary PL (~156 MB) → lemmas.txt + pos.json
python 02_filter_vectors.py   # pobiera cc.pl.300.vec.gz (~1,2 GB) → words.json + vectors.bin
python 06_freq_rank.py        # rangi częstotliwości → freq.json
python 11_extract_synonyms.py # relacje synonimów/hiperonimów → synonyms.json
python 16_llm_associations.py # skojarzenia LLM (OpenCode Go) → associations.json
python 03_build_graph.py      # graf top-500 sąsiadów (kosinus + boosty) → topk.npz + neighbors60.bin
python 08_generate_pool.py    # pary zagadek (podgraf rzecz.+przym.) → pairs.json
python 09_clean_pool.py       # filtr słów śmieciowych/wulgaryzmów
```

Skrypty pobierają dane same; alternatywnie wrzuć pliki do `pipeline/data/`.

## API

| Endpoint | Opis |
|---|---|
| `GET /api/puzzle?mode=daily\|practice&pos=...` | para słów `{ start, target, date }` (filtr części mowy) |
| `GET /api/words?q=przedrostek` | autouzupełnianie |
| `POST /api/check` `{ word, existing[], pos[] }` | walidacja + podobieństwo do wszystkich słów |
| `GET /api/health` | status, liczba słów/par, pamięć (do monitoringu) |

## Wdrożenie (produkcja)

Wymagania: ~250 MB RAM (produkcyjnie, standalone), ~150 MB dysku, Node.js 22. Bez bazy danych.

**Docker (rekomendowane, dowolny VPS):**
```bash
docker compose up -d --build   # http://host:3000
```
`Dockerfile` (multi-stage, output standalone) + `docker-compose.yml` z healthcheckiem na
`/api/health`. Uwaga: build wymaga obecności plików danych w `pipeline/data/` (są w `.gitignore`
— zbuduj lokalnie na maszynie z danymi albo dodaj je do repo).

**Bez Dockera (VPS + Node):**
```bash
npm ci && npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
mkdir -p .next/standalone/pipeline/data
cp pipeline/data/{words,vectors.bin,freq,synonyms,associations,pos,pairs}.json \
   pipeline/data/neighbors60.bin .next/standalone/pipeline/data/
cd .next/standalone && PORT=3000 HOSTNAME=0.0.0.0 node server.js
```
Dalej: domena `symantyka.pl` → Cloudflare (DNS + proxy), certyfikat SSL z Cloudflare.
Monitoring: uptime check na `https://symantyka.pl/api/health`.

Uwaga: hostingi współdzielone PHP (DirectAdmin itp.) NIE wystarczą — potrzebny VPS z SSH.

## SEO

- `metadata` (OpenGraph, Twitter, canonical) w `src/app/layout.tsx`
- `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`
- JSON-LD (WebApplication + FAQPage) i treść FAQ w `src/app/page.tsx`

## Licencje danych

- Wektory fastText: CC BY-SA 3.0
- pl.wiktionary: CC BY-SA 4.0 / GFDL
- Projekt: niekomercyjny, hobbystyczny
