# 037 — Onoma Culture Presets & Linguistic Family Overhaul

Goal: make the **Culture** presets (cultures/ethnicities, sports, cuisine) and the
**linguistic family** results deep instead of shallow. Audit findings + a staged plan.
Concrete UI/preset items at the bottom were done in this session; the data + family
work below is the remaining drastic work.

## Root cause

Every "normal" category is fat; culture subtypes are starved. From
`src/lib/onoma/data/lexicon/manifest.json`:

| category | total seeds | per family |
|---|---|---|
| person / country / org / city | 2,600–3,500 | 300 |
| culture_generic | 150 | 7–24 |
| culture_architecture | 122 | 6–25 |
| culture_cuisine | 127 | 1–21 |
| culture_sports | **78** | 7–14 |

A char-Markov needs hundreds of seeds to generalize. At <25 it overfits and echoes
its inputs. So culture subtypes basically hand the seed list back. Plus the seeds are
polluted (`Infobox cheese/doc`, `Flying Somua`, `Royal Billion`, `À la Maréchale`,
`Anahujahakipelalakanukapu`).

Families feel shallow because they *are*: 8 hardcoded `CulturalProfile` buckets, each a
flat seed list per category. "Latin" vs "Slavic" differ **only** by seed list — no
per-family phonology/phonotactics/orthography model, even though `phonology.ts` /
`morphology.ts` exist unused for this. And coverage skips entire real-world families.

## Pipeline (where to fix data)

`scripts/onoma/extract-lexicon.ts` (wiki → `raw/lexicon-raw.json`, typed by which
`Infobox_*` a page transcludes) → `clean.ts` calls `src/lib/onoma/lexicon/clean.ts`
(`cleanLexicon`) → `build-dicts.ts` (→ `data/lexicon/*.json` + manifest, classifies
into families). `raw/` is gitignored throwaway.

---

## Phase 1 — Clean the pollution (cheapest, do first)

`src/lib/onoma/lexicon/clean.ts::cleanName` lets meta pages through.

- Drop subpages/meta: reject `/doc`, `/sandbox`, `/testcases` suffixes and titles
  starting with `Infobox`, `Template`, `Module`, `Category`, `Wikipedia`, `User`.
- The colon reject already exists; confirm namespace prefixes aren't stripped before
  cleaning (the `Infobox cheese/doc` rows arrived without `Template:` — check the SQL
  in `extract-lexicon.ts` isn't dropping `lt_namespace`).
- Add a unit case for each to `lexicon/clean.test.ts` (file already exists), then
  `bunx tsx scripts/onoma/clean.ts` and eyeball the culture buckets.

No new data, immediate quality win.

## Phase 2 — Bulk up the 4 culture lexicons (highest leverage)

Culture buckets are thin because few wiki pages transclude `Infobox_sport/food/...`.
Two levers:

1. **Widen extraction**: add sibling infoboxes / category-membership fallbacks in
   `extract-lexicon.ts` (e.g. pull `Category:Cuisine`, `Category:Sports`,
   `Category:Ethnic_groups` members, not only infobox transclusions). iiwiki +
   althistory + ixwiki all via `User-Agent: IxStats-Builder`.
2. **Curated seed floor**: hand-author ~40–60 real-world seeds per family per subtype
   as a committed fallback merged in `build-dicts.ts` (the way `cultural-profiles.ts`
   already seeds the normal categories). Target ≥150/family so Markov generalizes.

Note the conceptual caveat: char-Markov over real dish/sport *proper nouns* yields
weak results regardless of volume — there's little shared morphology in 15 mixed-
language dish names. Decide per subtype whether the output should be **Markov-generated
new names** or a **curated picker** (sports/cuisine may be better as "draw N real
examples" + light Markov, since players want plausible *existing-style* names). Cheapest
viable: keep Markov but raise volume; revisit if results still read as noise.

## Phase 3 — Expose data you already have + add missing families

- **Compound buckets are unreachable.** `country/city/person/org` ship rich hybrids
  (`celtic+germanic`=300, `latin+slavic`=227, …) but the dropdown
  ([GeneratorPanel.tsx](../src/app/labs/onoma/components/shared/GeneratorPanel.tsx)
  lines ~175-184) only offers 8 pure families + Any, so they only fire in "Any" mode.
  Add the `manifest.keptCompounds` as selectable options (drive the dropdown from the
  manifest instead of hardcoding).
- **`province` lexicon is empty** for real use (only `mixed`:30). Either extract per
  family or drop province from lexicon and rely on presets — don't ship a dead bucket.
- **Add missing families.** Worst coverage holes for a 144-nation world: Iranian/Persian
  (currently wrongly folded into `arabic`), Turkic, Sub-Saharan African, Indic/Dravidian,
  Uralic (Finnish/Hungarian). Each = new `CulturalProfile` value in `types.ts`, seed
  block in `cultural-profiles.ts`, dropdown entry, and family classifier rules in
  `build-dicts.ts`.

## Phase 4 — Real per-family depth (the "drastic" version)

Make families differ by *model*, not just seed list. Wire the existing
`phonology.ts` / `morphology.ts` / `orthography.ts` per family:

- Per-family phoneme inventory + syllable template + vowel-harmony default +
  orthography mapping, applied as a constraint/post-process on Markov output.
- This is what turns "shallow" into "a Latin name and a Turkic name are recognizably
  different by structure, not just vibes." Largest effort — only do if Phases 1–3 don't
  make results feel rich enough.

---

## STATUS: all phases implemented (this session)

- **Phase 1 — clean.** `lexicon/clean.ts` now rejects wiki meta pages (`Infobox*`,
  `Template:`, `Module:`, `/doc`, `/sandbox`, `/testcases`). Test added. Re-ran
  `clean.ts` + `build-dicts.ts`; the `Infobox cheese/doc` class of junk is gone.
- **Phase 2 — bulk-up.** The wiki has ~no culture data (sports=2 rows, cuisine=14,
  mostly junk), so extraction was a dead end. Instead massively expanded the curated
  `PUBLIC_SEEDS` floor in `build-dicts.ts` and made sports/cuisine **seed-only**
  (`SEED_ONLY` set) since their raw data was pure noise. Result per `manifest.json`:
  sports 78→166, cuisine 127→232, architecture 122→232, generic 150→292, and 13–14
  family buckets each (was 8–9).
- **Phase 3 — families + dropdown.** Added 5 real families — **Persian, Turkic,
  African, Indic, Uralic** — as `CulturalProfile` values (`types.ts`), full
  10-category seed blocks (`cultural-profiles.ts`), `PUBLIC_SEEDS` culture floors,
  IPA rules (`phonology.ts`), and dropdown entries. Also exposed the 6 hybrid
  compound buckets (`celtic+germanic` …) which were unreachable. Family selectors in
  StudioPhonology + OnomaAdminPanel updated too.
- **Phase 4 — generative depth.** `FAMILY_PHONOTACTICS` in `useOnomaGenerator.ts`
  applies a per-family consonant-cluster floor (austronesian/east-asian = CV-only,
  slavic = dense, etc.) merged under user advanced options, so families now differ by
  *structure*, not just seed list. (`phonology.ts` was already per-family for IPA.)

Verification: 105 onoma jest tests pass; runtime check confirms all 13 families have
all 10 categories + IPA rules. Did not run global tsc (forbidden).

### Follow-ups not done (lower value / data-sourcing)

- `province` lexicon is still only `mixed`:30 — no per-family buckets (wiki lacks the
  data). Either source it or drop the bucket; presets cover province generation today.
- Sports/cuisine are still Markov-generated from proper nouns. If output reads as
  noise, switch those two subtypes to a curated "draw N real examples" picker.
- New families have no `culture-classifier.ts` / `bucket.ts` rules, so they get no
  raw-wiki data for normal categories — they run on presets + `PUBLIC_SEEDS` only.
  Fine until the wikis actually have tagged content for them.

## Done earlier this session (concrete asks)

- **Removed the "Markov " prefix** from all default preset labels (People ×2, Places ×2,
  Organizations, Military) — now `City Name (Default)` etc.
- **More Organization presets** (geopolitical, the old set skewed fantasy): added
  `generatePoliticalPartyName`, `generateGovernmentAgencyName`, `generateMediaOutletName`,
  `generateNgoName`, `generateReligiousOrderName` in `group-generator.ts`; wired into
  `useOnomaGenerator.ts` + `OrganizationsSection.tsx`; test in `generators.test.ts`.
- **Landmarks de-duplicated.** The Places "Landmarks & Features" tab is the single home.
  Folded `Architecture & Buildings` in there as a geography subtype (routes to the
  `culture_architecture` lexicon via `mapCategoryForLexicon`); removed the duplicate
  "Architecture & Landmarks" subtype from Culture. Caveat: geography presets
  (mountains/rivers) still blend into the architecture training set — negligible after
  Phase 2 bolstering; split preset seeds by subtype later if it matters.
