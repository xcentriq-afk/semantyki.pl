import { readFileSync } from "node:fs";
import path from "node:path";

export const THRESHOLD = 0.52;
const DIM = 300;

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
  return { words, vectors, index, folded, foldedSorted };
}

const DATA_VERSION = 2;

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

export function getCandidates(word: string): number[] {
  const { index, folded } = getLexicon();
  const exact = index.get(word);
  if (exact !== undefined) return [exact];
  const f = foldDiacritics(word);
  return folded.get(f) ?? [];
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
