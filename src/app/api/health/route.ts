import { getLexicon } from "@/server/lexicon";
import { getPairs } from "@/server/puzzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const lex = getLexicon();
  const pairs = getPairs();
  const mem = process.memoryUsage();
  return Response.json({
    status: "ok",
    service: "semantyki.pl",
    time: new Date().toISOString(),
    words: lex.words.length,
    pairs: pairs.length,
    uptime: Math.round(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1048576),
      heap: Math.round(mem.heapUsed / 1048576),
    },
  });
}
