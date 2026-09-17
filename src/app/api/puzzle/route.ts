import type { NextRequest } from "next/server";

import { dailyPair, practicePair, warsawDate } from "@/server/puzzle";

export const runtime = "nodejs";

const DEFAULT_POS = ["rzeczownik", "przymiotnik"];

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";
  const posParam = req.nextUrl.searchParams.get("pos");
  const selected =
    mode === "practice" && posParam
      ? posParam.split(",").map((p) => p.trim()).filter(Boolean)
      : DEFAULT_POS;

  if (mode === "practice") {
    const pair = practicePair(selected);
    if (!pair) {
      return Response.json(
        { error: "no-pairs" },
        { status: 404 },
      );
    }
    return Response.json({ start: pair[0], target: pair[1], date: warsawDate() });
  }

  const [start, target] = dailyPair();
  return Response.json({ start, target, date: warsawDate() });
}
