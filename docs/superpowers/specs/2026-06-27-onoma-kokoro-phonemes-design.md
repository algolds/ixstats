# Onoma Kokoro Phoneme Voice — Design Spec

**Date:** 2026-06-27
**Status:** Approved (design); pending implementation plan
**Author:** Onoma voice work, v2 branch

## Goal

Give the Onoma 🔊 Pronounce and 🎙 Read Naturally buttons true phoneme-level
control over the Kokoro voice model — speaking Onoma's IPA (including per-name
and per-culture overrides) **with stress**, instead of the approximate English
re-spelling the current kokoro-web REST path forces.

## Background / Why

Kokoro is phoneme-native: a G2P frontend turns text → IPA, then the model
speaks the IPA. The currently-deployed wrapper, **kokoro-web**
(`ghcr.io/eduardolat/kokoro-web`), only exposes text input over REST — its
`[word](/phonemes/)` override markup is a frontend-only feature that the API
reads literally (`"[Imperia](/ɪmˈpɛɾia/)"` → `"…slash…stress…slash"`,
verified). So custom IPA and stress cannot reach the model.

**kokoro-fastapi** (`remsky/Kokoro-FastAPI`) runs the same model and the same
voices but exposes phoneme input directly:

- `POST /dev/generate_from_phonemes` — body `{ phonemes, voice }`, IPA with
  stress marks (`ˈ`/`ˌ`) honored; returns audio.
- `POST /dev/phonemize` — body `{ text, language }`, returns canonical phonemes
  + token IDs. Used here as a **vocab oracle**.

Decision (brainstorming): run kokoro-fastapi **alongside** kokoro-web with an
`engine` flag, so phonemes are primary and kokoro-web (the re-speller shipped
in the prior change) plus browser speech remain as fallbacks for a safe swap.

## Global Constraints

- Package manager: `bun` exclusively. Tests: `bun run test -- <path>`.
- Never run `tsc --noEmit` / `bun run typecheck:full`. Use `bun run typecheck:file`.
- No new npm dependencies. No DB migration (config lives in existing
  `systemConfig` key/value rows). No new tRPC endpoints required for the core.
- kokoro-fastapi CPU image only (the ixwiki VPS has no GPU; Kokoro is fast on CPU).
- Stress gets **no dedicated UI** — the Studio IPA editor already accepts `ˈ`/`ˌ`,
  so stress rides along in the IPA string for free.
- English voices only (af_*, am_*, bf_*, bm_*); non-English phonemizers out of scope.

## Architecture

```
🔊 / 🎙 click → /api/onoma/tts  (text, ipa, voice, culture, …)
   │
   ├─ engine = "kokoro-fastapi"  (default)
   │     phonemes = ipaToKokoroPhonemes(ipa).phonemes
   │     POST {fastApiUrl}/dev/generate_from_phonemes  { phonemes, voice }
   │        ↓ on non-2xx / throw  ──► fall through to kokoro-web block
   │
   └─ engine = "kokoro-web"  (fallback, also reached on fastapi failure)
         input = ipaToSpokenText(ipa) || text       ← already shipped
         POST {baseUrl}/api/v1/audio/speech  { model, voice, input, … }
            ↓ on non-2xx / throw  ──► 502/503
                                          ↓
   client (NameResultCard / StudioPhonology / speakName) already falls back to
   browser SpeechSynthesis on any TTS route error.
```

Both buttons use the same phoneme path; they differ only by `voice`
(🔊 = default voice, 🎙 = per-culture / per-name voice). That voice-resolution
logic already exists in the route and is unchanged.

### Components / files

| File | Responsibility | New? |
|------|----------------|------|
| `src/lib/onoma/kokoro-phonemes.ts` | Pure IPA → Kokoro-vocab phoneme normalizer | new |
| `src/lib/onoma/kokoro-phonemes.test.ts` | Normalizer unit tests | new |
| `scripts/onoma/kokoro-vocab-oracle.ts` | Dev script: dump Kokoro's valid token set via `/dev/phonemize` | new |
| `src/app/api/onoma/tts/route.ts` | Engine branch + phoneme call + fallback | modify |
| `src/app/api/onoma/tts/__tests__/route.test.ts` | Engine + fallback route tests | modify |
| `src/server/api/routers/onoma.ts` | Surface `engine` + `fastApiUrl` in admin config get/set | modify |
| `src/app/admin/_components/OnomaAdminPanel.tsx` | Engine dropdown, fastApiUrl field, status, phoneme preview | modify |
| `scripts/onoma/audition-voice.ts` | Add a phoneme-path form to the audition harness | modify |
| `docker-compose`/deploy notes | Run kokoro-fastapi container (dev + prod) | doc |

## Config keys (systemConfig, admin-editable)

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `onoma.kokoro.engine` | `kokoro-fastapi` \| `kokoro-web` | `kokoro-fastapi` | Which backend the route targets first |
| `onoma.kokoro.fastApiUrl` | URL | `http://localhost:8880` | kokoro-fastapi base URL |
| `onoma.kokoro.baseUrl` | URL | (existing) | kokoro-web base URL (fallback) |
| `onoma.kokoro.enabled`, `.voice`, `.speed`, `.voiceMap`, `.apiKey`, `.model` | (existing) | — | unchanged |

Rollback during the swap = flip `engine` back to `kokoro-web` in admin (no redeploy).

## The core: IPA → Kokoro vocab normalizer

`src/lib/onoma/kokoro-phonemes.ts`

```ts
export interface KokoroPhonemeResult {
  phonemes: string;   // ready for /dev/generate_from_phonemes
  dropped: string[];  // IPA tokens removed (not in Kokoro's vocab, no mapping)
}

export function ipaToKokoroPhonemes(ipa: string): KokoroPhonemeResult;
```

Behaviour:
1. Strip delimiters `/[]`; keep stress `ˈ`/`ˌ`, length `ː`, and whitespace.
2. Token-scan longest-first. For each token:
   - already a valid Kokoro token → pass through,
   - in the remap table → emit its nearest valid equivalent,
   - otherwise → drop it and record in `dropped` (silent — never garble audio).
3. Collapse repeated spaces; trim.

**Starter remap table** (non-English / uncertain IPA → nearest English misaki token;
finalized against the oracle in implementation):

| From | To | Note |
|------|----|------|
| `r` | `ɹ` | American approximant |
| `ʁ` | `ɹ` | uvular → approximant |
| `x` | `k` | voiceless velar fricative absent in en |
| `ɣ` | `ɡ` | voiced velar fricative |
| `ɬ` | `l` | lateral fricative |
| `ʔ` | (drop) | glottal stop |
| `y` | `iː` | close front rounded → unrounded |
| `ø`,`œ` | `ɛ` | mid front rounded → eh |
| `ɾ` | `ɾ` | tap is valid in misaki en — keep |

Valid pass-through set (vowels/diphthongs/consonants that exist in misaki en) is
seeded from the oracle dump and encoded as a `Set`. The accompanying test
asserts that for a battery of Onoma-generated names, `ipaToKokoroPhonemes`
output contains **only** valid tokens (no garble reaches the model).

### Oracle script

`scripts/onoma/kokoro-vocab-oracle.ts` — POSTs a word list to
`/dev/phonemize`, unions all returned phoneme characters, prints the sorted
inventory. Run once to seed/validate the valid-token `Set` and the remap table.
Reads `KOKORO_FASTAPI_URL` (default `http://localhost:8880`).

## Route changes

`src/app/api/onoma/tts/route.ts`:
- Read `engine` and `fastApiUrl` from the config rows.
- If `engine === "kokoro-fastapi"` and `ipa` present:
  - `const { phonemes } = ipaToKokoroPhonemes(ipa);`
  - if `phonemes` non-empty: `POST {fastApiUrl}/dev/generate_from_phonemes`
    `{ phonemes, voice }` (+ `Authorization` if a key is set).
  - Response is audio; read `Content-Type` from the response, default
    `audio/wav` (kokoro-fastapi dev endpoints return WAV — confirm + pin when
    the container is first up).
  - On non-2xx or thrown error: **fall through** to the existing kokoro-web block.
- Cache key includes `engine` + the phoneme string so fastapi and web results
  don't collide.
- Voice resolution (per-name explicit → per-culture map → default) is unchanged
  and applies before either backend call.

## Admin (OnomaAdminPanel)

- **Engine** dropdown: `kokoro-fastapi` / `kokoro-web`.
- **kokoro-fastapi URL** field.
- The existing **Test Pronunciation** button, when engine = fastapi, also shows
  the normalized phoneme string and any `dropped` tokens it sent.
- Copy updated to explain phonemes vs. re-spelling and the fallback chain.

## Testing strategy (TDD)

- `kokoro-phonemes.test.ts`:
  - known remaps (`r→ɹ`, `x→k`, `ʁ→ɹ`, `ɬ→l`, `ʔ` dropped),
  - stress `ˈ`/`ˌ` and length `ː` preserved,
  - unknown token dropped + recorded in `dropped`,
  - "only valid tokens" over a battery of `translateToIPA` outputs.
- `route.test.ts`:
  - engine=fastapi posts `{phonemes, voice}` to `/dev/generate_from_phonemes`
    with the normalized phonemes (not raw IPA, no slashes),
  - on fastapi 5xx, the route falls back and posts to kokoro-web
    `/api/v1/audio/speech`,
  - engine=kokoro-web behaves exactly as today.

## Deployment

- **Dev (local, WSL2):** run kokoro-fastapi CPU container, e.g.
  `docker run -d --name kokoro-fastapi -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`.
  Set `onoma.kokoro.fastApiUrl = http://localhost:8880`, `engine = kokoro-fastapi`.
- **Prod (ixwiki server):** same image, pinned tag, behind the existing reverse
  setup; this is a manual ops step. kokoro-web stays running as fallback. No
  `docker system prune` (shared host with prod Postgres/Redis).

## Nice-to-haves (phased — include if cheap, defer if risky)

These are additive and each independently shippable after the core lands.

### NTH-1 — Phoneme preview in the Studio (recommended, low cost)
In `StudioPhonology` and the per-name IPA editor (`NameResultCard`), show the
exact Kokoro phoneme string (`ipaToKokoroPhonemes(ipa).phonemes`) beside the
IPA. Lets users see precisely what the model will speak. Pure read of the
normalizer; no backend work.

### NTH-2 — Dropped-token hint (recommended, low cost)
When a user types custom IPA that contains tokens Kokoro can't say, surface the
`dropped` array as a small inline warning ("ç, ɸ will be skipped"). Reuses the
normalizer's existing output; no new logic.

### NTH-3 — "Suggest IPA" from Kokoro G2P (medium)
In the per-name IPA editor, a button that calls `/dev/phonemize` (via a thin
public tRPC passthrough) to fetch Kokoro's own English phonemization of the
name as an editable starting point. Adds one small endpoint; gated behind the
core being live.

### NTH-4 — Engine health indicator in admin (low)
A reachability ping (e.g. `/health` or a tiny phonemize) showing fastapi
up/down next to the engine dropdown, mirroring the existing "voices loaded from
server / built-in" indicator. Ops convenience during the swap.

### NTH-5 — Per-culture voice blending (future, deferred)
kokoro-fastapi (like kokoro-web) accepts voice formulas
(`af_heart*0.6+am_adam*0.4`). Could extend the per-culture voice map to allow
blends for distinct cultural timbres. Deferred — meaningful UI + validation
work, no current demand.

### NTH-6 — Extend audition harness to the phoneme path (low)
Add a `phonemes` form to `scripts/onoma/audition-voice.ts` so the existing
raw/spaced/joined comparison also includes the true phoneme rendering for A/B
listening.

## Out of scope

- GPU inference. Dedicated stress-editing UI. Non-English phonemizers/voices.
- Changing the existing browser-speech fallback or the IPA override storage
  (`resolveIpa`, localStorage) — both already work and feed `ipa` unchanged.
```
