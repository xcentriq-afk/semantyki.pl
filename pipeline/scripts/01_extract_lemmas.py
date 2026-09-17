"""Extract Polish lemmas (nouns, verbs, adjectives, adverbs) from the plwiktionary dump."""
import bz2
import re
import sys
import xml.etree.ElementTree as ET

DUMP = "pipeline/data/plwiktionary-latest-pages-articles.xml.bz2"
OUT = "pipeline/data/lemmas.txt"

WORD_RE = re.compile(r"^[a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c][a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c-]*$")
LANG_HEADER = re.compile(r"^==[^=\n]*?\(\{\{j\u0119zyk polski\}\}\)\s*==\s*$", re.M)
POS_HEADER = re.compile(r"^''(rzeczownik|czasownik|przymiotnik|przys\u0142\u00f3wek)\b", re.M)
POS_HEADER_L3 = re.compile(r"^===\s*(rzeczownik|czasownik|przymiotnik|przys\u0142\u00f3wek)\s*===\s*$", re.M)

lemmas = set()
count = 0

with bz2.open(DUMP, "rt", encoding="utf-8", errors="replace") as f:
    context = ET.iterparse(f, events=("end",))
    for _event, elem in context:
        if elem.tag.endswith("page"):
            title_el = elem.find("{*}title") if False else None
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
                    if POS_HEADER.search(section) or POS_HEADER_L3.search(section):
                        lemmas.add(title)
            count += 1
            if count % 200000 == 0:
                print(f"pages: {count}, lemmas: {len(lemmas)}", file=sys.stderr)
            elem.clear()

with open(OUT, "w", encoding="utf-8") as f:
    for w in sorted(lemmas):
        f.write(w + "\n")

print(f"total pages: {count}")
print(f"lemmas: {len(lemmas)}")
print(f"written to {OUT}")
