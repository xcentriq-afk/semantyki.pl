import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_LEN = 500;
const MIN_LEN = 3;
const WINDOW_MS = 3_600_000;
const PER_IP = 3;
const GLOBAL_CAP = 30;

// Liczniki w pamięci procesu (jeden kontener — wystarczy; reset przy restarcie).
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function sliding(arr: number[], now: number): number[] {
  return arr.filter((t) => now - t < WINDOW_MS);
}

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const data = (body ?? {}) as Record<string, unknown>;
  const message = String(data.message ?? "").trim();
  const token = String(data.token ?? "");
  const website = String(data.website ?? "");

  // Honeypot — bot wypełnił ukryte pole: udajemy sukces.
  if (website) return Response.json({ ok: true });

  if (message.length < MIN_LEN || message.length > MAX_LEN) {
    return Response.json({ ok: false, error: "length" }, { status: 400 });
  }
  if (/https?:\/\//i.test(message)) {
    return Response.json({ ok: false, error: "link" }, { status: 400 });
  }

  // Rate limit PRZED weryfikacją CAPTCHA — 4. próba z tego samego IP dostaje 429.
  const ip = clientIp(req);
  const now = Date.now();
  const mine = sliding(hits.get(ip) ?? [], now);
  if (mine.length >= PER_IP) {
    hits.set(ip, mine);
    return Response.json({ ok: false, error: "rate" }, { status: 429 });
  }
  globalHits = sliding(globalHits, now);
  if (globalHits.length >= GLOBAL_CAP) {
    return Response.json({ ok: false, error: "rate" }, { status: 429 });
  }

  const secret = process.env.TURNSTILE_SECRET;
  if (!secret || !token) {
    return Response.json({ ok: false, error: "captcha" }, { status: 400 });
  }
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  form.set("remoteip", ip);
  try {
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const res = (await v.json()) as { success?: boolean };
    if (!res.success) {
      return Response.json({ ok: false, error: "captcha" }, { status: 400 });
    }
  } catch {
    return Response.json({ ok: false, error: "captcha" }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return Response.json({ ok: false, error: "config" }, { status: 500 });
  }

  const ua = (req.headers.get("user-agent") ?? "").slice(0, 160);
  const text =
    `📩 Nowa wiadomość z SEMANTYKI.pl\n` +
    `⏰ ${new Date().toISOString()}\n` +
    `🌐 IP: ${ip}\n` +
    `🖥 UA: ${ua}\n\n` +
    message.slice(0, MAX_LEN);

  const send = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!send.ok) {
    return Response.json({ ok: false, error: "send" }, { status: 502 });
  }

  mine.push(now);
  hits.set(ip, mine);
  globalHits.push(now);

  return Response.json({ ok: true });
}
