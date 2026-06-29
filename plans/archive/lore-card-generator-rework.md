# Lore Card Generator: image-first generation, category browsing, API efficiency

## Context

The lore-card generator produces very few cards and the admin "random box" is slow and
trips the wiki's rate limit (429s). Three root causes:

1. **Gate too high.** `lore-card-generation-cron.ts` skips anything below `minQualityScore: 41`
   (RARE). The scoring formula in `wiki-lore-card-generator.ts` rarely clears 41 — a 10k-char
   article with an infobox + a few refs scores ~20–30 — so most image-having articles are
   rejected. The admin discovery route (`/api/wiki/random-articles`) is even stricter (default 60).
2. **No category browsing.** Discovery is random-only (`LoreCardBatchAdmin.tsx` → random pools).
3. **Wasteful previews.** `/api/wiki/random-articles` runs a **full `generateCard()` on count×3
   candidates** just to preview — each is a heavy multi-prop fetch + a separate backlinks call.
   With count up to 100 that's ~300 heavy requests → 429s and slowness.

Goal (confirmed with user): image-with-minimal-floor gate (image **and** not a near-empty stub →
card; quality only sets rarity), an interactive **sort-by-category** browser replacing the random
box in the admin batch tool, driven by **live wiki categories**, all within wiki API limits.

Verified working against ixwiki.com (read-only curl): `list=categorymembers`, `list=allcategories&acprefix=`,
and **batched `titles=A|B|C…` (≤50) with `prop=pageimages|info|extracts|categories`** returning image +
byte-length + intro extract + category count in one call.

## Changes

### 1. Generator lib — efficient batch + category methods
`src/lib/wiki-lore-card-generator.ts`
- **`fetchArticleMetadataBatch(titles[], wikiSource)`** — one request per ≤50 titles:
  `prop=pageimages|info|extracts|categories`, `piprop=original`, `exintro=1&explaintext=1&exlimit=max`.
  Returns `{ title, hasImage, imageUrl, length, extract, categoryCount, estimatedQuality, estimatedRarity }`.
  Build the estimate by reusing the existing `calculateQualityScore` + `determineRarity` with a
  lightweight `ArticleQuality` (length from `info.length` bytes, `categoryCount`, infobox heuristic
  from extract; refs/inbound omitted — exact recompute still happens in `generateCard` at real
  generation). Chunk titles into 50s; small fixed concurrency (e.g. 2–3 chunks).
- **`fetchCategoryMembers(category, wikiSource, limit)`** — `list=categorymembers&cmtype=page&cmlimit=max`
  (supports `cmcontinue` paging), returns titles.
- **`searchCategories(prefix, wikiSource)`** — `list=allcategories&acprefix=&aclimit=…`, returns names.
- Add a **minimal-floor reject** in `generateCard` (the real generation path): require image (already)
  **and** skip if cleaned text length < ~1000 chars (stub guard). Keep returning the candidate otherwise.

### 2. Lower the gate
- `src/lib/lore-card-generation-cron.ts`: drop the hard `minQualityScore` floor — set it low
  (e.g. `10`) so rarity, not a cutoff, is what quality drives; the stub guard in `generateCard`
  does the real filtering. Optionally raise `targetPerWiki`. The per-article quality check at
  ~line 213 becomes a stub/image check, not a RARE cutoff.
- `src/app/api/wiki/random-articles/route.ts`: default `minQuality` 60 → low; **replace the
  per-candidate `generateCard()` preview loop with `fetchArticleMetadataBatch`** (the perf fix).
  Keep image-first sort. Drop the now-unneeded `mapWithConcurrency`/generateCard preview path.

### 3. New discovery REST routes (match existing `/api/wiki/*` + fetch pattern in the component)
- `src/app/api/wiki/categories/route.ts` — `GET ?source=&prefix=` → `searchCategories` (picker source).
- `src/app/api/wiki/category-articles/route.ts` — `GET ?source=&category=&count=` →
  `fetchCategoryMembers` then `fetchArticleMetadataBatch`, image-first, returns same `ArticlePreview`
  shape the admin tool already consumes.
- `generate-lore-card` route unchanged — full `generateCard` runs only on admin-**selected** titles.

### 4. Admin UI — category browser replaces the random box
`src/app/admin/cards/LoreCardBatchAdmin.tsx` (generator sub-tab)
- Add a **mode toggle: "Random" | "By Category"**. Random keeps current behavior (now fast).
- **Category mode**: category search box → `/api/wiki/categories` (debounced, `<Select>`/combobox);
  on pick → `/api/wiki/category-articles` loads previews (image thumb, title, est. rarity badge,
  length, detected lore-type).
- Keep existing search/quality filters; add a **sort control** (rarity / length / title). Reuse the
  existing multiselect + `generate-lore-card` generation flow and `ArticlePreview` type unchanged.

## Efficiency result
- Preview: N articles → `ceil(N/50)` batched calls instead of N full `generateCard` calls (~50× fewer requests).
- Random mode already collapsed to a single `generator=random`+`pageimages` call (done earlier).
- Heavy `generateCard` (full text + backlinks) runs only on admin-selected titles at generation time.
- All calls cap titles at 50/request with low concurrency → stays under the wiki's ~60 req/min limit.

## Verification
- `curl` each new route (`/api/wiki/categories`, `/api/wiki/category-articles`, reworked `random-articles`)
  and confirm fast single/batched responses, no 429.
- Load `/admin/cards` batch tab → "By Category" → pick e.g. `Cities in Burgundie` → previews load
  quickly with thumbs + rarity → select a few → generate → cards created.
- Lowered gate: run `generateDailyLoreCards()` (manual trigger script under bun, or wait for 02:00 cron)
  and confirm it now yields cards across COMMON→rarer instead of "a few".
- After approval, mirror this plan to the project `plans/` dir (gitignored) per workflow prefs.

## Out of scope
- User-facing `/vault/lore-generator` request flow unchanged (admin-only rework, per decision).
- No change to rarity tiers, stat weights, or the card economy.
