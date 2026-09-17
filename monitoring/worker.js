export default {
  async scheduled(event, env, ctx) {
    await runCheck(env);
  },
  async fetch(request, env) {
    const result = await runCheck(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "content-type": "application/json" },
    });
  },
};

const URLS = {
  domain: "https://symantyka.pl/api/health",
  origin: "http://57.128.224.181/api/health",
};

async function probe(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "symantyka-monitor/1.0" },
    });
    const body = await res.json();
    if (res.ok && body.status === "ok") {
      return {
        ok: true,
        detail: `words=${body.words} pairs=${body.pairs} rss=${body.memory?.rss ?? "?"}MB`,
      };
    }
    return { ok: false, detail: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 160)}` };
  } catch (e) {
    return { ok: false, detail: `${e.name}: ${e.message}` };
  }
}

async function runCheck(env) {
  const domain = await probe(URLS.domain);
  let origin = null;
  if (!domain.ok) {
    origin = await probe(URLS.origin);
  }

  const key = "fail-streak";
  let streak = 0;
  try {
    const stored = await env.MONITOR.get(key);
    if (stored) streak = parseInt(stored, 10) || 0;
  } catch {}

  const actions = [];

  if (domain.ok) {
    if (streak >= 2) {
      await notify(env, {
        title: "SYMANTYKA.pl wróciła online",
        color: 0x2ecc71,
        desc: `Serwis odpowiada poprawnie. ${domain.detail}`,
      });
      actions.push("recovery-alert");
    }
    if (streak > 0) await env.MONITOR.delete(key).catch(() => {});
    streak = 0;
  } else if (origin && origin.ok) {
    streak += 1;
    await env.MONITOR.put(key, String(streak)).catch(() => {});
    if (streak === 2) {
      await notify(env, {
        title: "SYMANTYKA.pl: problem z domeną/proxy (origin OK)",
        color: 0xf1c40f,
        desc: `Domena: ${domain.detail}\nOrigin (bezpośrednio): OK`,
      });
      actions.push("dns-alert");
    }
  } else {
    streak += 1;
    await env.MONITOR.put(key, String(streak)).catch(() => {});
    if (streak === 2) {
      await notify(env, {
        title: "SYMANTYKA.pl NIE ODPOWIADA",
        color: 0xe74c3c,
        desc: `Domena: ${domain.detail}\nOrigin: ${origin ? origin.detail : "nie sprawdzono"}`,
      });
      actions.push("down-alert");
    }
  }

  return { ok: domain.ok, streak, actions, domain, origin };
}

async function notify(env, { title, color, desc }) {
  const webhook = env.DISCORD_WEBHOOK;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "SYMANTYKA.pl Monitor",
        embeds: [
          {
            title,
            description: desc,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}
