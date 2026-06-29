# 052 — Onoma "Read Naturally" (Kokoro natural voice)

Wire the 🎙 **Read Naturally** button to a natural neural voice (Kokoro), with admin
control — **without** loading any model into the memory-constrained Next process.

## Decisions (locked)

| Question | Answer |
|----------|--------|
| Engine | **Kokoro**, self-hosted as its own container: `ghcr.io/eduardolat/kokoro-web` (Easypanel template) |
| Where it runs | **Separate service**, isolated from IxStats. NOT in-process, NOT client-side. Protects the 8 GB box from the documented RAM-oversubscription freezes. |
| How IxStats reaches it | Server-to-server: a thin Next API route **proxies** to kokoro-web (keeps the API key off the client, lets us cache). |
| Pronunciation philosophy | Two buttons, separate jobs. 🔊 Pronounce = IPA-faithful (meSpeak, done). 🎙 Read Naturally = immersion; **let Kokoro phonemize** (don't force our IPA into it). |
| Cost/perf control | **Cache** synthesized audio by `(text, voice, speed, model)` — names are short and repeat, so most plays never hit Kokoro. |

## kokoro-web facts (from its docs)

- Port **3000**, OpenAI-compatible: `POST {baseUrl}/api/v1/audio/speech`.
- Auth: server env `KW_SECRET_API_KEY`; clients send `Authorization: Bearer <key>`.
- Body: `{ model, voice, input, response_format, speed }` (e.g. `model_q8f16`, `af_heart`, `"mp3"`).
- Voices: standard Kokoro set (`af_heart`, `af_bella`, `am_michael`, `bf_emma`, `bm_george`, …).

## Architecture

```
NameResultCard 🎙  ──fetch──►  Next route /api/onoma/tts  ──proxy──►  kokoro-web container
(client, audio blob)            (auth + config + cache)              (Easypanel, isolated)
                                        │
                                   Redis audio cache
                                   key = sha1(text|voice|speed|model)
```

## Steps

### 1. Backend config (mirror the Narrator's secret pattern → `SystemConfig`)
- New keys `onoma.kokoro.*`: `enabled` (bool), `baseUrl`, `apiKey` (secret), `model`
  (default `model_q8f16`), `voice` (default `af_heart`), `speed` (default 1.0).
- `onoma.getSpeechConfig` (public) → add a **non-secret** `kokoro: { enabled, voice, speed, model }`
  so the client knows whether to enable the button. **Never** expose `baseUrl`/`apiKey` here.
- `onoma.getKokoroAdminConfig` (adminProcedure) → full config incl. secrets, for the panel.
- `onoma.updateKokoroConfig` (adminProcedure) → upsert the keys.

### 2. TTS proxy route — `src/app/api/onoma/tts/route.ts` (Node runtime)
- `protected` (signed-in users only) + reuse `src/lib/rate-limiter.ts` (TTS is the expensive op).
- Read `onoma.kokoro.*` server-side; if `!enabled` → 503.
- **Cache first:** `key = sha1(text|voice|speed|model)`; on hit return cached audio from Redis
  (base64) — names repeat, so this is the hot path. ponytail: Redis with a long TTL; in-memory
  fallback already exists in the rate-limiter's redis client.
- On miss: `POST {baseUrl}/api/v1/audio/speech` with Bearer key, body `{model, voice, input:text,
  response_format:"mp3", speed}`; stream bytes back as `audio/mpeg`; store in cache.
- Defensive: kokoro-web down / timeout → 502 with a clear message (client falls back to meSpeak).

### 3. Admin panel — extend `OnomaAdminPanel`
- New "Read Naturally (Kokoro)" card: enable toggle, base URL, **API key (password)**, model,
  voice (curated select of Kokoro voices), speed slider, + a **Test** button hitting the proxy.
- Reads `getKokoroAdminConfig`, saves `updateKokoroConfig`.

### 4. Client wiring — `NameResultCard`
- `useOnomaGenerator` already loads `getSpeechConfig`; surface `kokoro.enabled` → enable the
  🎙 button (drop the `disabled`).
- New `read-naturally.ts` provider: `readNaturally(text, opts)` → `fetch('/api/onoma/tts')` →
  play the returned audio (`new Audio(URL.createObjectURL(blob))`). Loading spinner on the button;
  on error, toast + optional fall-through to meSpeak.
- **Swappable:** the provider is one function — Fish Speech / Chatterbox later = new provider, same
  button. (Roadmap Phase 7 "users choose: Natural / Historical / Narrator / Radio" rides this.)

### 5. Verify
- Lint + the existing onoma jest suite (no engine in tests).
- Needs the **running kokoro-web container** + admin config filled to end-to-end test (user-side):
  set baseUrl/apiKey in the panel, Test, then click 🎙 in the lab.

## Explicitly NOT doing (YAGNI)
- No model in the Next process (the OOM risk). No client-side kokoro-js (CSP wasm + 80–300 MB DL).
- No IPA→Kokoro phoneme forcing — natural mode uses Kokoro's own phonemization.
- No culture→Kokoro-voice auto-map for v1 (single configured voice). Add later if wanted.

## Open defaults to confirm
- **Response format**: `mp3` (small, cached) vs `wav` (lossless). Default mp3.
- **Cache TTL / size**: e.g. 30 days, evict by Redis policy. Audio per name ~10–50 KB.
- **Voice**: single global default (`af_heart`) vs per-culture mapping (like meSpeak). v1 = single.
- **Auth scope**: signed-in users only (recommended) vs public.
