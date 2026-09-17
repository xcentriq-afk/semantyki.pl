"""Extract synonym and hypernym/hyponym relations from the plwiktionary dump."""
import bz2
import json
import re
import sys
import xml.etree.ElementTree as ET

DUMP = "pipeline/data/plwiktionary-latest-pages-articles.xml.bz2"
OUT = "pipeline/data/synonyms.json"

WORD_RE = re.compile(r"^[a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c][a-z\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c-]*$")
LANG_HEADER = re.compile(r"^==[^=\n]*?\(\{\{j\u0119zyk polski\}\}\)\s*==\s*$", re.M)
POS_HEADER = re.compile(
    r"^''(rzeczownik|czasownik|przymiotnik|przys\u0142\u00f3wek|liczebnik|zaimek|przyimek|sp\u00f3jnik|wykrzyknik|partyku\u0142a)\b",
    re.M,
)
TEMPLATE_HEADER = re.compile(r"^\{\{[a-z]", re.M)
SECTION_END = re.compile(r"^==[^=]", re.M)
LINK = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")

TEMPLATES = {
    "synonimy": "syn",
    "hiperonimy": "hyp",
    "hiponimy": "hyp",
}


def extract_section(text, template):
    rels = []
    for m in re.finditer(re.escape(template), text):
        rest = text[m.end():]
        stop = None
        for pat in (TEMPLATE_HEADER, SECTION_END):
            mm = pat.search(rest)
            if mm and (stop is None or mm.start() < stop.start()):
                stop = mm
        section = rest[:stop.start()] if stop else rest
        rels.extend(LINK.findall(section))
    return rels


relations = {}
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
                    next_l2 = SECTION_END.search(rest)
                    section = rest[:next_l2.start()] if next_l2 else rest
                    if POS_HEADER.search(section):
                        entry = {}
                        for tpl, rel in TEMPLATES.items():
                            words = [w.strip() for w in extract_section(section, tpl)]
                            words = [w for w in words if WORD_RE.match(w) and w != title]
                            if words:
                                entry.setdefault(rel, []).extend(words)
                        if entry:
                            for rel, words in entry.items():
                                entry[rel] = sorted(set(words))
                            relations[title] = entry
            count += 1
            if count % 200000 == 0:
                print(f"pages: {count}, relations: {len(relations)}", file=sys.stderr)
            elem.clear()

print(f"pages: {count}")
print(f"words with relations: {len(relations)}")
json.dump(relations, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"saved {OUT}")
