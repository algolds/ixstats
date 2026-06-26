---
name: project_onoma_tts
description: "Onoma TTS — DONE: meSpeak removed, swapped to kokoro-fastapi phoneme server, Onoma IPA drives synthesis"
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

**Gotchas proven:** respelling IPA to steer English G2P HURTS (`"shuh NOH muh"`→misaki letter-spells "NOH"); send raw text or phonemes, never respell. **Don't** add gruut/StyleTTS2/NVIDIA — the swap already gives canonical-IPA fidelity. Old kokoro-web image + `kokoro-cache/` dir now orphaned (reclaimable for disk).
