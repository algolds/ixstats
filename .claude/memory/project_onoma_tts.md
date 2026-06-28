---
name: project_onoma_tts
description: "Onoma TTS — kokoro-fastapi phoneme server (now on HF Space), Onoma IPA drives synthesis, anglicizeForSpeech softens cardinal-vowel 'eh'"
metadata: 
  node_type: memory
  type: project
  originSessionId: 689e056e-c75e-4cfb-ba66-961d09e0313d
---

Onoma `/labs/onoma` speech synthesis. **Reworked June 2026 (v2):**

**Final architecture (live):**
- **Server = `ghcr.io/remsky/kokoro-fastapi-cpu` (`ixstats-kokoro`, 127.0.0.1:3004→8880)**, swapped FROM `eduardolat/kokoro-web` which **cannot accept phonemes** (proved via its OpenAPI: only `input` text on `/api/v1/audio/speech`; `[word](/ipa/)` injection voices IPA as garbage). compose: no volume mount (67 voice `.pt` baked into image at `/app/api/src/voices/v1_0` — a host mount shadows them), mem cap 1300M (VPS RAM-tight, ~860MB steady).
- **Onoma's own G2P is ground truth**: `translateToIPA(name, culture)` ([[project_onoma_namegen]] `phonology.ts`) → route `/api/onoma/tts` sends `ipa` → `POST /dev/generate_from_phonemes {phonemes, voice}` (returns audio/wav). Non-phoneme fallback = `/v1/audio/speech` (audio/mpeg). `route.ts` branches on `phonemeMode = !!ipa`.
- **SystemConfig** (`onoma.kokoro.*`): model=`kokoro` (NOT model_q8f16), baseUrl=`http://localhost:3004`, voice=`af_heart`, enabled=true. kokoro-fastapi has no auth (apiKey ignored). Edit via `docker exec ixstats-postgres psql -U postgres -d ixstats` (host port is 5433 but INSIDE the container use the local socket / 5432).
- **UI = 2 buttons** (`NameResultCard.tsx`): IPA badge w/ inline speaker icon (browser SpeechSynthesis, accent-mapped) + "Read Naturally" (Kokoro phonemes→browser fallback). No third tier.

**meSpeak/eSpeak fully removed**: deleted `mespeak-loader.ts`, `speech.ts`(+test), `types/mespeak.d.ts`, `scripts/fix-mespeak-encoding.js`, `public/onoma/mespeak/`, `mespeak` dep+postinstall. Router lost `updateSpeechConfig` + the meSpeak fields of `getSpeechConfig` (kept kokoro+brand). Admin `OnomaAdminPanel.tsx` rewritten to Kokoro-only. Hook `useOnomaGenerator` lost `setSpeechConfig`.

**June 2026 — migrated to Hugging Face Space** (`https://algolds-ixstates.hf.space`, free CPU Basic 16GB). Same `kokoro-fastapi-cpu` image; Dockerfile appends a `GET /` health route (HF load-balancer 404-loops otherwise). Wired purely via SystemConfig: `onoma.kokoro.fastApiUrl` + `baseUrl` = the hf.space URL, `apiKey`=''. **Local `ixstats-kokoro` container + image removed**, `kokoro:` block stripped from `docker-compose.yml` (reclaimed ~1.6GB RAM). Tradeoff: free CPU does **~12.8s/sentence** + cold-start (~15s after 48h idle) — fine for short names, but drove the WikiOS narrator to sentence/bounded-chunk streaming (see [[project_wikios_initiative]] / `useWikiNarrator.ts` `chunkText`, ~240-char chunks + N+1/N+2 prefetch so no request times out at any text size). LLM (narrator/sports `narrator:llm:*`) stays on NVIDIA NIM — NOT moved to HF (CPU 8B would be a downgrade vs hosted 70B).

**The 'eh' on every word (diagnosed empirically):** (1) kokoro voices bare consonants with a schwa release (measured: bare `p` = 0.58s "puh"); (2) DOMINANT — Onoma's G2P passthrough maps bare vowel letters to *cardinal* IPA (`e`→/e/, `a`→/a/, `o`→/o/) at `phonology.ts` fallback, kokoro speaks them crisply, and `e` is everywhere. Fix = `anglicizeForSpeech(ipa)` in `kokoro-phonemes.ts`, composed ONLY at the audio call site (`route.ts`: `ipaToKokoroPhonemes(anglicizeForSpeech(ipa))`) so the studio's canonical IPA display stays clean and the pure-normalizer tests stay green. Stress-aware: stressed cardinal e→ɛ, o→oʊ; unstressed a/e/o→ə; diphthongs/long/already-English vowels untouched. e.g. `/ˈdelepas/`→`/ˈdɛləpəs/`. Cache key uses raw ipa (anglicize is deterministic, so still correct).

**Gotchas proven:** respelling IPA to steer English G2P HURTS (`"shuh NOH muh"`→misaki letter-spells "NOH"); send raw text or phonemes, never respell. **Don't** add gruut/StyleTTS2/NVIDIA — the swap already gives canonical-IPA fidelity. Old kokoro-web image + `kokoro-cache/` dir now orphaned (reclaimable for disk).
