import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { matchesPos } from "@/server/lexicon";

export type Pair = [string, string];

const DATA_VERSION = 4;

interface CachedPairs {
  version: number;
  pairs: Pair[];
}

const g = globalThis as unknown as { __linxiconPairs?: CachedPairs };

function loadPairs(): Pair[] {
  const file = path.join(process.cwd(), "pipeline", "data", "pairs.json");
  return JSON.parse(readFileSync(file, "utf-8")) as Pair[];
}

export function getPairs(): Pair[] {
  if (!g.__linxiconPairs || g.__linxiconPairs.version !== DATA_VERSION) {
    g.__linxiconPairs = { version: DATA_VERSION, pairs: loadPairs() };
  }
  return g.__linxiconPairs.pairs;
}

export function warsawDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dailyPair(): Pair {
  const pairs = getPairs();
  const seed = warsawDate();
  const hash = createHash("sha256").update(seed).digest();
  const idx = hash.readUInt32BE(0) % pairs.length;
  return pairs[idx];
}

export function practicePair(selected: string[]): Pair | null {
  const pairs = getPairs();
  const filtered = pairs.filter(
    ([a, b]) => matchesPos(a, selected) && matchesPos(b, selected),
  );
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
