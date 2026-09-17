import type { NextRequest } from "next/server";

import { dailyPair, practicePair, warsawDate } from "@/server/puzzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";
  const [start, target] = mode === "practice" ? practicePair() : dailyPair();
  return Response.json({ start, target, date: warsawDate() });
}
