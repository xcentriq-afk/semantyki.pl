"""Extract Polish lemmas (all 10 POS) from the plwiktionary dump; save lemmas + POS labels."""
import bz2
import json
import re
import sys
import xml.etree.ElementTree as ET

DUMP = "pipeline/data/plwiktionary-latest-pages-articles.xml.bz2"
OUT = "pipeline/data/lemmas.txt"
OUT_POS = "pipeline/data/pos.json"

POS_TYPES = [
    "rzeczownik",
    "czasownik",
    "przymiotnik",
    "przysłówek",
    "liczebnik",
    "zaimek",
    "przyimek",
    "spójnik",
    "wykrzyknik",
    "partykuła",
]

WORD_RE = re.compile(r"^[a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c][a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c-]*$")
LANG_HEADER = re.compile(r"^==[^=\n]*?\(\{\{j\u0119zyk polski\}\}\)\s*==\s*$", re.M)
POS_HEADER = re.compile(
    r"^''(" + "|".join(POS_TYPES) + r")\b",
    re.M,
)
POS_HEADER_L3 = re.compile(
    r"^===\s*(" + "|".join(POS_TYPES) + r")\s*===\s*$",
    re.M,
)

lemmas = {}
count = 0

with bz2.open(DUMP, "rt", encoding="utf-8", errors="replace") as f:
    context = ET.iterparse(f, events=("end",))
    for _event, elem in context:
        if elem.tag.endswith("page"):
            title_el = None
            text_el = None
            for child in elem:
                tag = child.tag.split("}")[-1]
                if tag == "title":
                    title_el = child
                elif tag == "revision":
                    for rchild in child:
                        if rchild.tag.split("}")[-1] == "text":
                            text_el = rchild
            if title_el is None or text_el is None or text_el.text is None:
                elem.clear()
                continue
            title = title_el.text or ""
            text = text_el.text or ""
            if WORD_RE.match(title):
                lang_match = LANG_HEADER.search(text)
                if lang_match:
                    rest = text[lang_match.end():]
                    next_l2 = re.search(r"^==[^=]", rest, re.M)
                    section = rest[:next_l2.start()] if next_l2 else rest
                    poss = set(POS_HEADER.findall(section)) | set(POS_HEADER_L3.findall(section))
                    if poss:
                        lemmas[title] = sorted(poss)
            count += 1
            if count % 200000 == 0:
                print(f"pages: {count}, lemmas: {len(lemmas)}", file=sys.stderr)
            elem.clear()

with open(OUT, "w", encoding="utf-8") as f:
    for w in sorted(lemmas):
        f.write(w + "\n")
with open(OUT_POS, "w", encoding="utf-8") as f:
    json.dump(lemmas, f, ensure_ascii=False)

print(f"total pages: {count}")
print(f"lemmas: {len(lemmas)}")
print(f"written to {OUT} and {OUT_POS}")
