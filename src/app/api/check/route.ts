import type { NextRequest } from "next/server";

import {
  getCandidates,
  getLexicon,
  matchesPos,
  relationBoost,
  sharedNeighborBoost,
  similarity,
  THRESHOLD,
} from "@/server/lexicon";

export const runtime = "nodejs";

const DEFAULT_POS = ["rzeczownik", "przymiotnik"];

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const data = (body ?? {}) as Record<string, unknown>;
  const word = String(data.word ?? "").trim().toLowerCase();
  const existingRaw: unknown = data.existing;
  const existing: string[] = Array.isArray(existingRaw)
    ? existingRaw.map((w) => String(w).trim().toLowerCase())
    : [];
  const posRaw: unknown = data.pos;
  const selected: string[] = Array.isArray(posRaw)
    ? posRaw.map((p) => String(p))
    : DEFAULT_POS;

  if (!word) return Response.json({ ok: false, reason: "empty" });

  const lex = getLexicon();
  const candidates = getCandidates(word);
  if (candidates.length === 0) return Response.json({ ok: false, reason: "not-found" });

  const allowed = candidates.filter((wi) => matchesPos(lex.words[wi], selected));
  if (allowed.length === 0) return Response.json({ ok: false, reason: "pos" });

  let best: { word: string; score: number } | null = null;
  const matches: { word: string; score: number }[] = [];
  for (const w of existing) {
    const ei = lex.index.get(w);
    if (ei === undefined) continue;
    let bestForWord = -1;
    for (const wi of allowed) {
      if (ei === wi) continue;
      const cw = lex.words[wi];
      const cos = similarity(wi, ei);
      const s = Math.max(cos, relationBoost(cw, w), sharedNeighborBoost(wi, ei, cos));
      if (s > bestForWord) bestForWord = s;
    }
    if (bestForWord < 0) continue;
    if (bestForWord >= THRESHOLD) matches.push({ word: w, score: bestForWord });
    if (!best || bestForWord > best.score) best = { word: w, score: bestForWord };
  }
  matches.sort((a, b) => b.score - a.score);

  return Response.json({
    ok: true,
    connected: matches.length > 0,
    matches,
    best,
    threshold: THRESHOLD,
  });
}
