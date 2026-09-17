# Symantyka (LINXICON PL)

Polska wersja gry **Linxicon**: połącz dwa losowe słowa łańcuchem wyrazów
powiązanych znaczeniowo. Dopisujesz słowa — jeśli nowe słowo jest wystarczająco
bliskie znaczeniowo istniejącemu, powstaje połączenie. Wygrywasz, gdy oba słowa
docelowe znajdą się w jednym łańcuchu. Im mniej słów, tym lepiej.

- **Zagadka dnia** — jedna para słów dziennie (deterministyczna, z seedu daty)
- **Trening** — nielimitowane losowe pary

## Jak to działa

- Słownik: polskie lematy z pl.wiktionary (rzeczowniki, czasowniki, przymiotniki, przysłówki)
- Podobieństwo znaczeniowe: embeddingi [fastText cc.pl.300](https://fasttext.cc/docs/en/crawl-vectors.html) (kosinus)
- Próg połączenia: **0.52** (dobrany eksperymentalnie, `pipeline/scripts/04_tune_threshold.py`)
- Pary dziennie: losowe pary połączone ścieżką 3–8 słów, weryfikowane BFS-em
- Formy pisane bez polskich znaków są akceptowane („zolw” → „żółw”)

## Uruchomienie

```bash
npm install
npm run dev   # http://localhost:3000
```

Dane leksykonu (53 933 słowa, wektory ~65 MB) nie są w repo.
Wygeneruj je pipeline'em (wymaga Pythona 3 + numpy):

```bash
cd pipeline/scripts
python 01_extract_lemmas.py   # pobiera dump Wiktionary PL (~156 MB) → lemmas.txt
python 02_filter_vectors.py   # pobiera cc.pl.300.vec.gz (~1,2 GB) → words.json + vectors.bin
python 06_freq_rank.py        # rangi częstotliwości → freq.json
python 03_build_graph.py      # graf top-200 sąsiadów → topk.npz
python 08_generate_pool.py    # pary zagadek → pairs.json
python 09_clean_pool.py       # filtr słów śmieciowych/wulgaryzmów
```

Skrypty pobierają dane same; alternatywnie wrzuć pliki do `pipeline/data/`.

## API

| Endpoint | Opis |
|---|---|
| `GET /api/puzzle?mode=daily\|practice` | para słów `{ start, target, date }` |
| `GET /api/words?q=przedrostek` | autouzupełnianie |
| `POST /api/check` `{ word, existing[] }` | walidacja + najlepsze podobieństwo |

## Licencje danych

- Wektory fastText: CC BY-SA 3.0
- pl.wiktionary: CC BY-SA 4.0 / GFDL
- Projekt: niekomercyjny, hobbystyczny
