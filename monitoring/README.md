# Monitoring (Cloudflare Worker)

Worker sprawdza co 5 minut `https://semantyki.pl/api/health` (cron `*/5 * * * *`).
Przy 2 kolejnych awariach wysyła alert na Discord (webhook w Workers Secrets jako `DISCORD_WEBHOOK`).
Licznik awarii trzymany w KV (binding `MONITOR`, namespace `semantyki-monitor`).

Alerty:
- czerwony — domena i origin nie odpowiadają
- żółty — domena nie odpowiada, ale origin (bezpośrednie IP) działa → problem DNS/proxy
- zielony — powrót do działania

## Aktualizacja kodu

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/semantyki-monitor" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "script=@worker.js;type=application/javascript+module"
```

## Ustawienie webhooka (sekret)

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/semantyki-monitor/secrets" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"DISCORD_WEBHOOK","text":"URL_WEBHOOKA","type":"secret_text"}'
```

## Test lokalny (bez dotykania KV w chmurze)

```bash
$env:DISCORD_WEBHOOK="URL_WEBHOOKA"; node test.mjs
```
