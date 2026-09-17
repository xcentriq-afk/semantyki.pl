const mod = await import("./worker.js");

const store = new Map([["fail-streak", "1"]]);
const env = {
  MONITOR: {
    async get(k) {
      return store.get(k) ?? null;
    },
    async put(k, v) {
      store.set(k, v);
    },
    async delete(k) {
      store.delete(k);
    },
  },
  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK ?? "",
};

const res = await mod.default.fetch(new Request("http://localhost/"), env);
console.log("HTTP", res.status);
console.log(await res.text());
console.log("KV fail-streak =", store.get("fail-streak"));
