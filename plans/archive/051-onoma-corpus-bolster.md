# 051 — Onoma Corpus Bolster

Make Onoma the best worldbuilding namegen by training it on the full IxWiki +
iiwiki + althistory corpus — **without** making the client heavy.

## Decisions (locked)

| Question | Answer |
|----------|--------|
| IxWiki extraction | **Direct MariaDB SQL** (read-only, full table access) |
| What ships to browser | **Compact dictionaries; client trains** the existing Markov |
| External wikis (iiwiki/althistory) | **One-time build, manual re-run** (no cron) |
| Dictionary organization | Frontend = **name category**. Backend auto-sorts each name into a **real-world culture bucket** via orthographic pattern heuristics. Nations/wikis are corpus fuel only, never a frontend dimension. |

## The spine (resolves "all of ixwiki" vs "lightweight")

```
OFFLINE (manual script, run on the box)              CLIENT (browser, unchanged weight)
  ixwiki MariaDB ─┐                                    pick category  ─┐
  iiwiki API     ─┼─► clean ─► classify ─► compact ──►  fetch 1 dict  ─┼─► MarkovChain.generate()
  althistory API ─┘   (category + culture)   *.json     (few KB)        │
                                                         optional culture facet
```

The corpus never reaches the browser. Only curated, size-capped, deduped
word-lists do. The Markov engine (already client-side, already fixed) is enough.

## Phase 0 — Discovery ✅ DONE

**Connection:** MariaDB `localhost`, db `ixwiki`, user `ixwiki` (creds in
`config/LocalSettings.php`), **no table prefix**. Local DBs: only `ixwiki` +
`xenforo`. iiwiki/althistory are **external** → API only (Phase 1), no local SQL.

**Schema gotcha (MW 1.45):** `categorylinks` and `templatelinks` are normalized —
the title lives in `linktarget` (`lt_id`, `lt_namespace`, `lt_title`). Join
`tl_target_id`/`cl_target_id` → `linktarget.lt_id`. There is **no `cl_to`/`tl_title`**.

**Category signal = infobox templatelinks, NOT categories.** Maintenance categories
dominate (broken-links, stubs, infobox-warnings); semantic cats are sparse. The clean
signal is which `Infobox_*` template a page transcludes. Mapping (lt_namespace=10):

| NameCategory | Infobox templates | ~pages |
|---|---|---|
| country | `Infobox_country`, `Infobox_former_country` | ~406 |
| city | `Infobox_settlement` | 301 |
| province | `Infobox_KirState` (+ cat `Kiravian_federal_subjects`) | ~60 |
| person | `Infobox_officeholder`, `Infobox_person`, `Infobox_royalty` | ~246 |
| organization | `Infobox_company`, `Infobox_government_agency`, `Infobox_military_unit`, `Infobox_organization`, `Infobox_political_party`, `Infobox_legislature` | ~519 |

**1366 distinct typed pages** in the core set (before external wikis). Names are
high-quality and culturally distinct (`Máirín Óscanlon`/Gaelic, `Gžegož Mirosław`/Slavic,
`Khosrow Qajar`/Persian, `Cesare Fusillo`/Italian) — ideal for the culture classifier.

**Free culture taxonomy:** `Infobox_ethnic_group` (52) + `Infobox_language` (29) pages
literally name in-world cultures (`Cartadanians`, `Caphiric_people`, `Udunaic`…). Strip
`_people`/`_language`/`_civilization`. Nation categories (`Urcea` 198, `Caphiria` 246,
`Burgundie` 225…) cluster pages by nation → weak-supervision labels to tune the classifier.

**Cleaning needs seen in samples:** underscores→spaces; strip disambig commas
(`Castelle County, Verona`), descriptor prefixes (`Republic of`, `_colony`), regnal
forms (`Rhys I of Faneria`→`Rhys`), and `_people`/`_language` suffixes.

**Size caps:** ~a few thousand names/dict is the ceiling; current core corpus is well
under that, so external wikis are what push toward the cap. Decide caps in Phase 4.

## Phase 1 — Extraction ✅ DONE — `scripts/onoma/extract-corpus.ts` (+ `.test.ts`)

**Result: 23,652 typed raw names** → `scripts/onoma/raw/corpus-raw.json` (gitignored).
- **IxWiki (SQL):** 1,406 (country 308, city 301, province 35, person 245, org 517).
- **iiwiki (API):** 22,246 (country 6,642, city 2,734, person 6,638, org 6,232).
- **althistory:** network `fetch failed` mid-loop — retryable; low value (timeline-organized,
  mostly real-world). Re-run picks it up via cache; not blocking.

**Key unblock:** iiwiki is Cloudflare-challenged, but `User-Agent: IxStats-Builder` is
allowlisted and clears it; endpoint is `https://iiwiki.com/api.php` (not `/mediawiki/api.php`).
Documented in CLAUDE.md → "External Wiki Access".

**The "optimized API" approach:** mirror the SQL infobox-typing remotely via
`list=embeddedin&eititle=Template:Infobox_country` per template — targeted (only typed
pages, not a full allpages dump), so external pages arrive already category-typed.
Disk-cached per wiki, 150ms politeness delay, continuation-paged.

### (original design notes)
- **IxWiki (SQL):** read `page` (ns=0, `page_is_redirect=0`), join `categorylinks`
  to tag each title with its categories; optionally `page_props`/infobox for type.
  Pull titles into raw buckets by category.
- **iiwiki / althistory (action API):** `list=categorymembers` for the naming
  categories, `aplimit=500`, follow `continue`. Cache raw responses to disk so a
  re-run is cheap. ponytail: plain `fetch` + continuation loop, no API client dep.
- Output: raw `{category, name, sourceWiki}` rows to a scratch JSON.

## Phase 2 — Clean ✅ DONE
- Logic: `src/lib/onoma/corpus/clean.ts` (pure, jest-tested — `clean.test.ts`, 8 cases).
  Runner: `scripts/onoma/clean.ts` → `raw/corpus-clean.json`.
- Rules: strip `(...)`/`[...]` disambig, drop `, Region` tails, strip double-quotes but
  **keep intra-word apostrophes** (O'Connor, T'kampa, Cote d'Or), country gov-descriptor
  prefix strip (Republic/Kingdom of → proper name), person regnal-numeral + `of <Place>`
  strip, reject digits/too-short/sentence-like, dedup case-insensitive per category.
- **Result: 34,373 raw → 28,424 clean** (country 7,527, person 10,301, org 7,117,
  city 3,406, province 30). Dropped 17.3% junk/dupes. (althistory recovered on retry:
  +10,721; added `fetchRetry` for transient network errors.)

## Phase 3 — Classify ✅ DONE (culture classifier)
- `src/lib/onoma/corpus/culture-classifier.ts` — char bigram+trigram Naive-Bayes,
  pure-TS, **trained at module load from the existing `CULTURAL_PROFILES`** (no hand
  weights, no ML dep, no model file). 7 cultures: latin, germanic, celtic, slavic,
  arabic, east-asian, austronesian. `classifyCulture(name) → {culture|"mixed", confidence}`.
- `MIN_MARGIN = 0.08` (tuning knob): ~90% coverage @ ~80% resubstitution precision.
  Below margin → `"mixed"`. Test (`culture-classifier.test.ts`, 8 cases): held-out real
  names per culture + precision-when-committed ≥70% regression floor.
- **Compound groups (resolves the old "mixed"):** when the top-2 cultures are within
  MIN_MARGIN, the name is labeled `A+B` (sorted) instead of mixed — conworld names blend
  the base families rather than matching new ones. `classifyCulture` returns
  `{culture, compound, components[], confidence}`; `rankCultures` exposes the full ranking.
- **Measured (28,424 corpus): 58% single, 42% compound, ~0% true-mixed.** Single: latin 13%,
  germanic 12%, celtic 9%, slavic 7%, austronesian 6%, arabic 6%, east-asian 5%. Top-6
  compound subgroups: celtic+germanic 6.1%, celtic+latin 4.3%, latin+slavic 2.6%,
  germanic+slavic 2.5%, germanic+latin 2.2%, arabic+austronesian 2.1%.
- **Rejected:** adding new single cultures (greek/french/japanese/… seed lists) — measured,
  absorbed <1.4% and caught mostly noise; deleted to avoid curation debt + micro-buckets.
- Phase 4 picks the top-N buckets (7 singles + top-6 compounds) and collapses the long
  compound tail. Future (not now): held-out tuning, per-category models.

### (original design notes)
- **Category:** from source namespace/category mapping → person / city / province /
  country / organization / geography (the existing `NameCategory` set).
- **Culture (the "backend algo"):** a lightweight, inspectable orthographic
  classifier in `src/lib/onoma/culture-classifier.ts`:
  - Per culture, a weighted feature set: characteristic suffixes (`-ov/-ski` slavic,
    `-ez` iberian, `-son/-sen` germanic/nordic, `-escu` romanian…), digraphs,
    diacritics, vowel/consonant ratios, common n-grams.
  - Score each name, take argmax; below a confidence threshold → `mixed`.
  - ponytail: pure scoring function, **no ML dep, no model file**. Tunable weights
    table = the calibration knob. **Ships with a `test_*.ts` of known names per
    culture** (this is money-path logic; it gets a real test).
- Reuse the buckets already in `CULTURAL_PROFILES` so the facet aligns with presets.

## Phase 4 — Emit compact dictionaries ✅ DONE
- Logic: `src/lib/onoma/corpus/bucket.ts` (`assignBucket`, `topCompounds`; pure, jest-tested
  `bucket.test.ts` 3 cases). Runner: `scripts/onoma/build-dicts.ts` (**run with `bun`**, not
  tsx — cultural-profiles has a type-only import tsx ESM chokes on).
- Output (tracked via the `!src/lib/onoma/data/**` negation):
  `src/lib/onoma/data/corpus/<category>.json` = `Record<bucket, string[]>`, +`manifest.json`
  (`keptCompounds` + per-category bucket counts for the frontend facet).
- Buckets per category = 7 singles + top-6 compounds (tail compounds collapse to dominant
  single; under-`MIN_BUCKET` cultures pool into a per-category `mixed` grab-bag so no names
  drop). `CAP_PER_BUCKET=300` (deterministic stride sample, avoids source-order bias).
- **Result: 13,101 names, 227 KB across 5 files** (person/country/org/city + province-30).
  Largest file 80 KB (~18 KB gzipped), loaded one category at a time → lightweight.
- **E2E verified:** `MarkovChain` trained on a bucket produces culturally-distinct names
  (latin→Lucius/Justus, slavic→Ivanek/Petrena, celtic+germanic→Blan Kühner, arabic→Semir Talam).

## Phase 5 — Wire + verify ✅ DONE
- `TrainingMode` += `"corpus"`; it's now the **default** source (the flagship wiki-trained mode).
- `useOnomaGenerator`: `CORPUS_LOADERS` dynamic-imports `data/corpus/<category>.json` per category
  (code-split, lazy — only the active category's chunk loads); new state `corpusBucket` +
  derived `corpusBuckets`; training branch trains the Markov on the selected bucket (or all
  buckets concat for "Any Culture"). `getTrainingData` query stays `enabled` only for ixworld.
- `GeneratorPanel`: 3-way source selector (IxWiki Corpus / Cultural Presets / Live IxWorld DB) +
  a **Culture Bucket** facet dropdown (Any + singles + top-6 compounds, `formatBucket` pretty-print).
- Verified: eslint clean (0 errors), Phase-4 e2e already confirmed Markov-on-bucket quality.

## ✅ Initiative complete (Phases 0–5)
Pipeline: IxWiki SQL + iiwiki/althistory API → 34,373 raw → 28,424 clean → classified
(7 cultures + compound blends) → 13,101 names in 227 KB of compact per-category dicts → lazy
client Markov. **Commit:** `src/lib/onoma/data/` (restored generator data + new `corpus/`),
`src/lib/onoma/corpus/` (clean/classifier/bucket + tests), `scripts/onoma/`, hook + panel, the
`.gitignore` negation, and the CLAUDE.md "External Wiki Access" doc.

## Explicitly NOT doing (YAGNI until asked)
- No cron/live refresh (manual re-run only).
- No server-side Markov tables (client training is cheap for a few-thousand-word dict).
- No per-nation frontend dimension (user: clutters fast).
- No new deps (raw `fetch`, raw `mysql2`/existing driver, pure-TS classifier).

## Already shipped (audit/fix pass, pre-plan)
- Restored 5 missing generated data files; un-ignored `src/lib/onoma/data/`.
- Markov dedup: suffix-trie → exact-match `Set` (correctness + the key scaling fix).
- Fixed `logActivity`→`logGeneration` and the `getTrainingData` category enum mismatch.
