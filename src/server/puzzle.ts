import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export type Pair = [string, string];

const g = globalThis as unknown as { __linxiconPairs?: Pair[] };

function loadPairs(): Pair[] {
  const file = path.join(process.cwd(), "pipeline", "data", "pairs.json");
  return JSON.parse(readFileSync(file, "utf-8")) as Pair[];
}

export function getPairs(): Pair[] {
  if (!g.__linxiconPairs) g.__linxiconPairs = loadPairs();
  return g.__linxiconPairs;
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

export function practicePair(): Pair {
  const pairs = getPairs();
  return pairs[Math.floor(Math.random() * pairs.length)];
}
