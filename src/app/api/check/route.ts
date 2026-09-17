import type { NextRequest } from "next/server";

import { getCandidates, getLexicon, similarity, THRESHOLD } from "@/server/lexicon";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const data = (body ?? {}) as Record<string, unknown>;
  const word = String(data.word ?? "").trim().toLowerCase();
  const existingRaw: unknown = data.existing;
  const existing: string[] = Array.isArray(existingRaw)
    ? existingRaw.map((w) => String(w).trim().toLowerCase())
    : [];

  if (!word) return Response.json({ ok: false, reason: "empty" });

  const lex = getLexicon();
  const candidates = getCandidates(word);
  if (candidates.length === 0) return Response.json({ ok: false, reason: "not-found" });

  let best: { word: string; score: number } | null = null;
  for (const w of existing) {
    const ei = lex.index.get(w);
    if (ei === undefined) continue;
    for (const wi of candidates) {
      if (ei === wi) continue;
      const s = similarity(wi, ei);
      if (!best || s > best.score) best = { word: w, score: s };
    }
  }

  const connected = best !== null && best.score >= THRESHOLD;
  return Response.json({ ok: true, connected, best, threshold: THRESHOLD });
}
