# Onoma — Name Generation Lab

Client-side procedural name generator at **`/labs/onoma`**. Two engines:

1. **Markov chain** — order-N character model trained on a word list, generates novel
   names in that style. This is the flagship path.
2. **Rule-based assemblers** — syllable/template generators ported from the original
   [Onoma](https://github.com/algolds/onoma) (fantasy species, taverns, mystic orders,
   military units, etc.). Pattern-driven, not learned.

Everything runs in the browser. The server is only touched to save names to the Stash
and to log generation activity.

## Markov sources

The generator can train its Markov chain from three sources (`TrainingMode`), chosen in
`GeneratorPanel`:

| Mode | Source | Notes |
|------|--------|-------|
| **`corpus`** (default) | Prebuilt dictionaries mined from IxWiki + iiwiki + althistory | Offline-built, lazy-loaded, culture-faceted. The flagship. |
| `preset` | `cultural-profiles.ts` (7 hand-authored culture lists) | Latin, Germanic, Celtic, Slavic, Arabic, East-Asian, Austronesian, Constructed. |
| `ixworld` | Live DB via `api.onoma.getTrainingData` | Current country/city/province/official names. |

## File map

```
src/lib/onoma/
  markov-chain.ts        Markov engine (exact-match Set dedup) + capitalize()
  name-generator.ts      Markov wrapper + fantasy-syllable assembler
  species/group/tavern   Rule-based assemblers (port)
  cultural-profiles.ts   7 culture word lists (preset mode + classifier training)
  data/                  Generated, COMMITTED:
    fantasy/species/group/tavern-data.ts   syllable/template data (from the original repo)
    corpus/<category>.json + manifest.json compact wiki dictionaries (Phase 4 output)
  corpus/                Corpus pipeline logic (pure, jest-tested):
    clean.ts             title → trainable name
    culture-classifier.ts  n-gram Naive-Bayes → single culture or "A+B" compound
    bucket.ts            final bucket assignment + top-compound ranking
src/hooks/useOnomaGenerator.ts   state, lazy dict loading, training, generate()
src/app/labs/onoma/              SPA router + sections + GeneratorPanel UI
src/server/api/routers/onoma.ts  Stash save/load, training data, activity log
scripts/onoma/                   offline build pipeline (run with bun)
```

## Rebuilding the corpus

The wiki-trained dictionaries are built offline in four steps. **Run with `bun`** (not
`tsx` — `cultural-profiles.ts` has a type-only import tsx ESM mishandles). Re-run manually
whenever you want fresh wiki data; output is deterministic.

```bash
bun scripts/onoma/extract-corpus.ts   # 1. harvest → scripts/onoma/raw/corpus-raw.json (gitignored)
bun scripts/onoma/clean.ts            # 2. clean+dedup → raw/corpus-clean.json
bun scripts/onoma/build-dicts.ts      # 3+4. classify, bucket, emit → src/lib/onoma/data/corpus/*.json
```

`extract-corpus.ts` reads IxWiki straight from MariaDB (creds parsed from
`/ixwiki/config/LocalSettings.php`) and the external wikis via the MediaWiki action API.
Both type names by which `Infobox_*` template a page transcludes (SQL `templatelinks` /
API `list=embeddedin`). External fetches are disk-cached under `scripts/onoma/raw/cache/`.

> **iiwiki note:** requests must send `User-Agent: IxStats-Builder` (allowlisted past its
> Cloudflare challenge) and hit `https://iiwiki.com/api.php`. See CLAUDE.md → "External
> Wiki Access".

## Culture classification

`classifyCulture(name)` is a character bigram+trigram Naive-Bayes classifier (pure TS, no
ML dependency). It trains at module load from the 7 `CULTURAL_PROFILES` lists. For each
name it returns either a **single culture** (one wins by `MIN_MARGIN`) or a **compound
`A+B`** blend when the top two are close — which is the norm for invented conworld names.
`build-dicts.ts` keeps the 7 singles + the **top-6 compounds** as dictionary buckets;
rarer blends collapse to their dominant single, and under-represented cultures pool into a
per-category `mixed` bucket.

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
bun run test -- src/lib/onoma           # engine + corpus logic
```

Covers: Markov capitalize/dedup/constraints, corpus cleaning, the culture classifier
(held-out names + precision floor), and bucket assignment. The extractor seam check runs
standalone: `bunx tsx scripts/onoma/extract-corpus.test.ts`.
