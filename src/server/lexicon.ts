import { readFileSync } from "node:fs";
import path from "node:path";

export const THRESHOLD = 0.32;
const DIM = 300;
const W_SYN = 0.85;
const W_HYP = 0.62;
const W_SHARED_SYN = 0.6;
const W_SHARED_NB = 0.56;
const W_LLM_ASSOC = 0.6;
const NB_K = 60;
const NB_CUTOFF = 10;
const MIN_COS = 0.4;
const COMMON_RANK = 75000;

interface SynonymData {
  [word: string]: { syn?: string[]; hyp?: string[] };
}

export function foldDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l");
}

export interface Lexicon {
  words: string[];
  vectors: Float32Array;
  index: Map<string, number>;
  folded: Map<string, number[]>;
  foldedSorted: { f: string; word: string }[];
  direct: Map<string, number>;
  synSets: Map<string, Set<string>>;
  neighSorted: Uint32Array;
  freqRank: Map<string, number>;
  pos: Map<string, string[]>;
}

function load(): Lexicon {
  const dir = path.join(process.cwd(), "pipeline", "data");
  const words = JSON.parse(
    readFileSync(path.join(dir, "words.json"), "utf-8"),
  ) as string[];
  const buf = readFileSync(path.join(dir, "vectors.bin"));
  const vectors = new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / 4,
  );
  const index = new Map<string, number>();
  const folded = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    index.set(words[i], i);
    const f = foldDiacritics(words[i]);
    const list = folded.get(f);
    if (list) list.push(i);
    else folded.set(f, [i]);
  }
  const foldedSorted = words
    .map((word) => ({ f: foldDiacritics(word), word }))
    .sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : a.word < b.word ? -1 : 1));
  const synonyms = JSON.parse(
    readFileSync(path.join(dir, "synonyms.json"), "utf-8"),
  ) as SynonymData;
  const direct = new Map<string, number>();
  const synSets = new Map<string, Set<string>>();
  for (const [word, rels] of Object.entries(synonyms)) {
    if (!index.has(word)) continue;
    if (rels.syn) {
      const set = new Set<string>();
      for (const t of rels.syn) {
        if (!index.has(t) || t === word) continue;
        set.add(t);
        const key = [word, t].sort().join("|");
        const prev = direct.get(key);
        if (prev === undefined || prev < W_SYN) direct.set(key, W_SYN);
      }
      if (set.size > 0) synSets.set(word, set);
    }
    if (rels.hyp) {
      for (const t of rels.hyp) {
        if (!index.has(t) || t === word) continue;
        const key = [word, t].sort().join("|");
        const prev = direct.get(key);
        if (prev === undefined || prev < W_HYP) direct.set(key, W_HYP);
      }
    }
  }
  const nbBuf = readFileSync(path.join(dir, "neighbors60.bin"));
  const nb = new Uint32Array(nbBuf.buffer, nbBuf.byteOffset, nbBuf.byteLength / 4);
  const nWords = nb[0];
  const k = nb[1];
  const neigh = nb.slice(2, 2 + nWords * k);
  const neighSorted = new Uint32Array(nWords * k);
  for (let i = 0; i < nWords; i++) {
    const row = Array.from(neigh.subarray(i * k, (i + 1) * k)).sort((a, b) => a - b);
    neighSorted.set(row, i * k);
  }
  const freq = JSON.parse(
    readFileSync(path.join(dir, "freq.json"), "utf-8"),
  ) as Record<string, number>;
  const freqRank = new Map<string, number>();
  for (const [w, r] of Object.entries(freq)) freqRank.set(w, r);
  const posData = JSON.parse(
    readFileSync(path.join(dir, "pos.json"), "utf-8"),
  ) as Record<string, string[]>;
  const pos = new Map<string, string[]>();
  for (const [w, p] of Object.entries(posData)) pos.set(w, p);
  let assoc: Record<string, string[]> = {};
  try {
    assoc = JSON.parse(
      readFileSync(path.join(dir, "associations.json"), "utf-8"),
    ) as Record<string, string[]>;
  } catch {
    assoc = {};
  }
  for (const [word, targets] of Object.entries(assoc)) {
    if (!index.has(word)) continue;
    for (const t of targets) {
      if (!index.has(t) || t === word) continue;
      const key = [word, t].sort().join("|");
      const prev = direct.get(key);
      if (prev === undefined || prev < W_LLM_ASSOC) direct.set(key, W_LLM_ASSOC);
    }
  }
  return {
    words,
    vectors,
    index,
    folded,
    foldedSorted,
    direct,
    synSets,
    neighSorted,
    freqRank,
    pos,
  };
}

const DATA_VERSION = 9;

interface CachedLexicon {
  version: number;
  lexicon: Lexicon;
}

const g = globalThis as unknown as { __linxiconLexicon?: CachedLexicon };

export function getLexicon(): Lexicon {
  if (!g.__linxiconLexicon || g.__linxiconLexicon.version !== DATA_VERSION) {
    g.__linxiconLexicon = { version: DATA_VERSION, lexicon: load() };
  }
  return g.__linxiconLexicon.lexicon;
}

export function similarity(a: number, b: number): number {
  const { vectors } = getLexicon();
  let dot = 0;
  const oa = a * DIM;
  const ob = b * DIM;
  for (let k = 0; k < DIM; k++) dot += vectors[oa + k] * vectors[ob + k];
  return dot;
}

export function relationBoost(a: string, b: string): number {
  const { direct, synSets } = getLexicon();
  const d = direct.get([a, b].sort().join("|"));
  if (d !== undefined) return d;
  const sa = synSets.get(a);
  const sb = synSets.get(b);
  if (sa && sb) {
    for (const s of sa) {
      if (sb.has(s)) return W_SHARED_SYN;
    }
  }
  return 0;
}

export function sharedNeighborBoost(a: number, b: number, cos: number): number {
  if (cos < MIN_COS) return 0;
  const { words, neighSorted, freqRank } = getLexicon();
  const ra = freqRank.get(words[a]) ?? 10 ** 9;
  const rb = freqRank.get(words[b]) ?? 10 ** 9;
  if (ra > COMMON_RANK || rb > COMMON_RANK) return 0;
  const oa = a * NB_K;
  const ob = b * NB_K;
  let i = 0;
  let j = 0;
  let count = 0;
  while (i < NB_K && j < NB_K) {
    const va = neighSorted[oa + i];
    const vb = neighSorted[ob + j];
    if (va === vb) {
      count++;
      i++;
      j++;
    } else if (va < vb) {
      i++;
    } else {
      j++;
    }
  }
  return count >= NB_CUTOFF ? W_SHARED_NB : 0;
}

export function getCandidates(word: string): number[] {
  const { index, folded } = getLexicon();
  const exact = index.get(word);
  if (exact !== undefined) return [exact];
  const f = foldDiacritics(word);
  return folded.get(f) ?? [];
}

export function matchesPos(word: string, selected: string[]): boolean {
  const { pos } = getLexicon();
  const p = pos.get(word) ?? [];
  if (p.length === 0) return true;
  return p.some((x) => selected.includes(x));
}

export function suggest(prefix: string, limit = 12): string[] {
  const { words, foldedSorted } = getLexicon();
  const out: string[] = [];
  const seen = new Set<string>();
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < words.length && out.length < limit; i++) {
    if (!words[i].startsWith(prefix)) break;
    if (!seen.has(words[i])) {
      seen.add(words[i]);
      out.push(words[i]);
    }
  }
  const f = foldDiacritics(prefix);
  let flo = 0;
  let fhi = foldedSorted.length;
  while (flo < fhi) {
    const mid = (flo + fhi) >> 1;
    if (foldedSorted[mid].f < f) flo = mid + 1;
    else fhi = mid;
  }
  for (let i = flo; i < foldedSorted.length && out.length < limit; i++) {
    if (!foldedSorted[i].f.startsWith(f)) break;
    if (!seen.has(foldedSorted[i].word)) {
      seen.add(foldedSorted[i].word);
      out.push(foldedSorted[i].word);
    }
  }
  return out;
}
