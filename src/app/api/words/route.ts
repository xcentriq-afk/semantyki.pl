import type { NextRequest } from "next/server";

import { suggest } from "@/server/lexicon";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return Response.json({ matches: [] });
  return Response.json({ matches: suggest(q, 12) });
}
