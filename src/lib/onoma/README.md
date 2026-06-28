# Onoma — Language & Naming Engine

Client-side procedural name generator + linguistics engine at **`/labs/onoma`**. The
philosophy is **"deterministic first"**: procedural generation is the source of truth.

Three layers:

1. **Markov engine** (`markov-chain.ts`) — the flagship. Multi-order character **and**
   syllable models trained on a word list, with automatic **backoff** (tries order N, falls
   back to N−1 … down to 1 when constraints are tight) and phonotactic safeguards
   (consonant/vowel cluster caps, vowel harmony, double-letter control). Generates novel,
   pronounceable names in the trained style.
2. **Linguistics engine** — enriches each generated name: IPA (`phonology.ts`), grammatical
   gender + 5-case declensions (`morphology.ts`), and Cyrillic/Greek/Arabic transcription
   (`orthography.ts`).
3. **Rule-based assemblers** — syllable/template generators ported from the original
   [Onoma](https://github.com/algolds/onoma) (fantasy species, taverns, mystic orders,
   military units, civic organizations, noble surnames, etc.). Pattern-driven, not learned.
4. **Curated pickers** — a few categories are real-world proper nouns that don't Markov-blend
   into anything coherent (traditional **sports** and **cuisine**). For these, Onoma draws a
   shuffled sample of real examples from the culture lexicon instead of generating.

Everything runs in the browser. The server is only touched to save names to the Stash,
fetch optional live-world training data, and log generation activity.

## Training source (one culture selector + optional world data)

The generator trains on **one blended pool**, configured in `GeneratorPanel` →
`useOnomaGenerator`:

- **Culture / Linguistic Family** (`culture`, default `"any"`) — picks the flavour from **13
  families** (Latin, Germanic, Celtic, Slavic, Arabic, Persian, Turkic, Indic, East-Asian,
  Austronesian, African, Uralic, Constructed) plus six selectable **hybrid** buckets
  (`celtic+germanic`, `latin+slavic`, …). For a given family it trains on the hand-authored
  `cultural-profiles.ts` list **plus** the matching bucket from the prebuilt wiki **lexicon**
  (`data/lexicon/<category>.json`). The wiki lexicon is always mixed into the presets — there
  is no separate "source" toggle. `"any"` blends every culture; `"constructed"` and the five
  newer families are preset/seed-only (the wikis lack tagged content for them).
- **Per-family phonotactics** (`FAMILY_PHONOTACTICS` in `useOnomaGenerator`) — each family
  applies a consonant-cluster floor at generation (Austronesian/East-Asian stay open-syllable
  CV, Slavic tolerates dense clusters, etc.), so families differ by structure, not just word
  list. User advanced options override it.
- **Include Live World Data** (`includeWorldData`, advanced toggle, default off) — also folds
  in current country/city/province/official names from the live DB
  (`api.onoma.getTrainingData`).

Two chains are trained in parallel (`characterChain`, `syllableChain`); generation tries the
character chain, then the syllable chain, then a fantasy-syllable fallback.

### Culture section subtypes

The **Culture** tab exposes three subtypes: *Cultures & Ethnicities* (Markov-generated
ethnonyms), and *Sports* + *Cuisine* which are **curated pickers** (real examples drawn from
the lexicon, no Markov). Architecture/buildings live under **Places → Landmarks & Features**.

## File map

```
src/lib/onoma/
  markov-chain.ts        Markov engine (multi-order backoff, char+syllable modes, cluster
                         limits, vowel harmony, getTransitions for the visualizer)
  name-generator.ts      Markov wrapper + fantasy-syllable & noble-surname assemblers
  phonology.ts           Grapheme→IPA parser per culture + consonant-onset stress heuristic
  morphology.ts          Grammatical gender detection & 5-case noun declension tables
  orthography.ts         Script transcribers for Cyrillic, Greek, and Arabic (RTL)
  perplexity.ts          Char n-gram LM → name "naturalness" 0–100 (Phase 5)
  browser-speech.ts      Browser-native SpeechSynthesis player mapping naming cultures to language tags
  branding-utils.ts      Linguistic flanking styles, Google Fonts registry, and IPA-to-Speech-Spelling converter
  lexicon-analytics.ts   Shannon entropy, letter/bigram/trigram freqs, 0–100 health audit
  species/group/tavern   Rule-based assemblers (port)
  cultural-profiles.ts   13 culture word lists (preset training + classifier training)
  data/                  Generated, COMMITTED:
    fantasy/species/group/tavern-data.ts   syllable/template data (from the original repo)
    lexicon/<category>.json + manifest.json  compact wiki dictionaries (build output)
  lexicon/               Lexicon pipeline logic (pure, jest-tested):
    clean.ts             title → trainable name
    culture-classifier.ts  n-gram Naive-Bayes → single culture or "A+B" compound
    bucket.ts            final bucket assignment + top-compound ranking
src/hooks/useOnomaGenerator.ts   state, lazy lexicon loading, training, per-family
                         phonotactics (FAMILY_PHONOTACTICS), curated pickers, generate()
src/app/labs/onoma/              SPA router + sections + Studio + GeneratorPanel UI
src/server/api/routers/onoma.ts  Stash save/load, training data, activity log
scripts/onoma/                   offline build pipeline (run with bun)
```

## Rebuilding the wiki lexicon

The wiki-trained dictionaries (`data/lexicon/`) are built offline. **Run with `bun`** (not
`tsx` — `cultural-profiles.ts` has a type-only import tsx ESM mishandles). Re-run manually
whenever you want fresh wiki data; output is deterministic.

```bash
bun scripts/onoma/extract-lexicon.ts  # 1. harvest → scripts/onoma/raw/lexicon-raw.json (gitignored)
bun scripts/onoma/clean.ts            # 2. clean+dedup → raw/lexicon-clean.json
bun scripts/onoma/build-dicts.ts      # 3+4. classify, bucket, emit → src/lib/onoma/data/lexicon/*.json
```

`extract-lexicon.ts` reads IxWiki straight from MariaDB (creds parsed from
`/ixwiki/config/LocalSettings.php`) and the external wikis via the MediaWiki action API.
Both type names by which `Infobox_*` template a page transcludes (SQL `templatelinks` /
API `list=embeddedin`). External fetches are disk-cached under `scripts/onoma/raw/cache/`.
`rebuild-from-committed.ts` re-derives the lexicon from the committed JSON without re-fetching.

> **iiwiki note:** requests must send `User-Agent: IxStats-Builder` (allowlisted past its
> Cloudflare challenge) and hit `https://iiwiki.com/api.php`. See CLAUDE.md → "External
> Wiki Access".

## Linguistics engine

Applied per generated name (in `NameResultCard`), all pure-TS and deterministic:

- **`translateToIPA(name, culture)`** — left-to-right grapheme→IPA scan using per-culture
  rule tables (Latin, Germanic, Celtic, Slavic, Arabic, Persian, Turkic, African, Indic,
  Uralic, East-Asian, Austronesian, Constructed), then a consonant-onset primary-stress mark.
- **`getMorphologyDetails(name, culture)`** — grammatical gender from word endings, plus a
  full singular/plural declension table across 5 cases (Nominative→Ablative), with
  culture-specific paradigms (Latin declensions, Greek, Slavic, Arabic triptote, Quenya…).
- **`transcribeToScript(name, "cyrillic"|"greek"|"arabic")`** — grapheme→script mapping
  (Greek final-sigma handling, Arabic RTL).

## Naturalness scoring (Phase 5)

`trainLM(words)` builds a char n-gram language model; `naturalnessScore(name, lm)` returns
0–100 — the percentile of training words a candidate is at least as natural/pronounceable as
(no magic constants). `useOnomaGenerator` trains an LM on the active seed pool and exposes
`scoreNaturalness(name)`; `NameResultCard` shows it as a "% fit" badge.

## Voice (Phase 7)

Two distinct modes (two buttons in `NameResultCard`), not one speaker:

- **🔊 IPA badge (Pronounce)** (done) — the *pronunciation engine*. The IPA badge has an inline speaker icon; clicking it speaks the name via the browser's native Web Speech API `window.speechSynthesis` (mapping conworld naming cultures to BCP-47 language tags). If the browser engine is unavailable, it surfaces a toast (no eSpeak fallback).
- **🎙 Read Naturally** (done) — immersive natural neural voice. Proxies to a self-hosted **kokoro-fastapi** Docker container via Next.js `/api/onoma/tts`. Onoma sends the canonical IPA from `translateToIPA` straight to the model's `/dev/generate_from_phonemes` endpoint, so pronunciation comes from the language's own rules rather than English G2P. Caches synthesized audio in Redis. Falls back to the browser-native voice if the container is unreachable.
  > [!TIP]
  > **502 Bad Gateway Troubleshooting**: If natural voice playback fails with a `502 Bad Gateway` or `502 (Bad Gateway)` network error, it indicates that the Next.js API route cannot communicate with the self-hosted Kokoro container. This usually happens if the server restarts and the container isn't running. Spin it up by running:
  > ```bash
  > KOKORO_API_KEY=your_key docker compose up -d kokoro
  > ```
  > Ensure the `onoma.kokoro.baseUrl` in `SystemConfig` is set to `http://localhost:3004` (its host mapping) and `onoma.kokoro.apiKey` matches the host `KOKORO_API_KEY` token.

## Lexicon analytics

`lexicon-analytics.ts` powers the Studio's health panel: `calculateEntropy` (Shannon entropy
of letter distribution), `getLetterFrequencies` / `getNgramFrequencies`, and
`auditLexiconHealth` → a 0–100 score + issue list (size, duplicates, invalid chars, length
outliers, noise words).

## Culture classification

`classifyCulture(name)` is a character bigram+trigram Naive-Bayes classifier (pure TS, no
ML dependency). It trains at module load from the `CULTURAL_PROFILES` lists. For each
name it returns either a **single culture** (one wins by `MIN_MARGIN`) or a **compound
`A+B`** blend when the top two are close — which is the norm for invented conworld names.
`build-dicts.ts` keeps the singles + the **top-6 compounds** as dictionary buckets;
rarer blends collapse to their dominant single, and under-represented cultures pool into a
per-category `mixed` bucket. The starved culture subtypes `culture_sports` and
`culture_cuisine` are **seed-only** (`SEED_ONLY` set) — the wikis barely have such pages, so
they're built purely from the curated `PUBLIC_SEEDS` floor rather than noisy extraction.

## Tuning knobs

| Knob | Where | Effect |
|------|-------|--------|
| `MIN_MARGIN` | `culture-classifier.ts` | Higher → purer single-culture buckets, more compounds/`mixed`. ~0.08 ≈ 90% coverage / 80% precision. |
| `CAP_PER_BUCKET` | `build-dicts.ts` | Names per bucket. Lower → smaller dict files, less variety. |
| `TOP_N_COMPOUNDS` | `build-dicts.ts` | How many compound blends become their own buckets. |
| `order` | UI (Advanced) | Markov look-back depth (1–4 chars). Higher → closer to training, less novel. |

After changing a classifier/build knob, re-run `bun scripts/onoma/build-dicts.ts`.

## Tests

```bash
bun run test -- src/lib/onoma           # engine, linguistics, lexicon logic
```

Covers: Markov capitalize/dedup/constraints, phonology/morphology/orthography, lexicon
analytics, lexicon cleaning, the culture classifier (held-out names + precision floor), and
bucket assignment. The extractor seam check runs standalone:
`bunx tsx scripts/onoma/extract-lexicon.test.ts`.
