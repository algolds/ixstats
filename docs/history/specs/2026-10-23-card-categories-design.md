# Card categories: design (owner-approved, 2026-10-23)

## Why

Lore cards are meant to be organised by category, but almost none are:

- In the `ixstats_cards` clone, 6 of 2,390 lore cards have a `category`, and no card has a `subcategory`.
- The Explore and Mine category filters offer 12 categories, and 9 of them hold no cards. The type filter offers Nation, which has no cards either.
- The new card back's lattice uses the card's category icon, and today it almost never can.
- Phase 5's automatic realm sets are "by category" (cards refresh spec, line 63), so they are blocked.

The classifier exists (`src/lib/cards/category-classifier.ts`, `classifyLoreArticle`), but:

- it was never run over the older cards;
- its strongest signal, the infobox template, never fires: `lore-card-generator.ts:541` passes the stripped `text` instead of `rawText`;
- the Commons importer classifies on the title alone (`cards.importer.ts:313`);
- with no signal it falls back to NATION, so a category is quietly wrong rather than empty.

About 2,375 lore cards also carry an old `metadata.category` label ("Historical Figures", "Geographical Locations" and so on), and a 30-card sample showed these are close to random.

**Success:** every lore card has a category it deserves, a subcategory where one fits, or an honest "Uncategorised" waiting in a review queue. The filters show only real options. Admins, realm owners and players each have a way to correct a category.

## Decisions (the owner's)

1. **Taxonomy:** keep the 12 `LoreCategory` values. Each gets a **fixed list of subcategories**, so filters and sets can rely on them.
2. **Backfill:** fix the classifier and run it over every lore card. Its inputs are:
   - real infobox templates;
   - the source wiki's own categories, through its API;
   - the title and the excerpt.

   Results below a confidence threshold go to an **admin review queue**.
3. **No signal means Uncategorised.** The category stays null, flagged for review, and the UI shows it as "Uncategorised". It is never forced to NATION or HISTORY.
4. **The filters now:** Explore's and Mine's category and type filters list only options that have cards. This lands first, on its own.
5. **Who edits:**
   - **Site admins:** in the cards admin (the Library), with the review queue, and an audit entry for every change.
   - **Realm owners:** for cards in their own realm, from the realm's card tools.
   - **Players:** "Suggest a category" on the card sheet, which goes to the admin queue for approval.
6. **The old `metadata.category` labels are deleted** by the backfill, after it has run. Nothing reads them.
7. **NationStates cards get no category,** as the cards refresh spec says (§143). Their "category" fact on the sheet is really the NS pretitle (NationStates' `<TYPE>`: Republic, Kingdom), so it is relabelled "Pretitle" in the UI and in code where it is named.
8. **The six February seed cards are retired:** Cathedral of Stars, Battle of Corumm, History of Ixnay, Treaty of Kiro and the two others with no `wikiArticleTitle`, created 2026-02-16. Their held copies stay, as retired copies worth 0. This is done on the clone here, and is a runbook step for production.
9. **Eurth's 102 IIWiki-sourced cards stay in Eurth.** The realm is the setting; the wiki is only the source.
10. **Nation cards** (minting players' countries as cards) are added to the Phase 5 plan. The Nation type stays hidden from the filters until such cards exist (decision 4 covers it).
11. **Scope:** all of it now, as one phase with its own SQL file, following the cards refresh process.

## Constraints

- **Databases:** cards work runs against `ixstats_cards` only, never `ixstats` or `ixstats_wv1`. The owner runs production.
- **Outbound calls:** wiki API calls use `User-Agent: IxStats-Builder`, at IxWiki's `https://ixwiki.com/api.php` and IIWiki's `https://iiwiki.com/api.php` (not `/mediawiki/api.php`). Batch 50 titles per request with `prop=categories|templates`, `tlnamespace=10`, and throttle politely. In MediaWiki 1.43 to 1.45 the local tables are normalised (`linktarget`); see CLAUDE.md, "External Wiki Access".
- **Schema:** one idempotent SQL file (`prisma/migrations/<stamp>_cards_categories/migration.sql`), wired into the dev SQL chain (`start-development.sh`, `scripts/refresh-local-db.sh`) and the deploy runbook. The controller applies it to `ixstats_cards`.
- **Process:** the cards house rules in `plans/cards-refresh-sdd/common.md` apply, but with the worktree `/home/jxsig/projects/ixstats-categories` and `ixstats_cards`. TDD, no `any`, Facet UI rules, commits by explicit path, and no version or changelog changes.
- **The lock order** in `docs/systems/cards.md` stays untouched. Category edits take no money or copy locks.

## What is built

1. **Filters.**
   - Explore's category and type options come from the catalogue's real counts.
   - Mine's come from the player's own copies.
   - An option with 0 cards is not listed.
   - "Uncategorised" is offered while any listed card has no category.
2. **The taxonomy module.**
   - `src/lib/cards/` gains the fixed subcategory list for each category, validated wherever a subcategory is written.
   - Labels are sentence case.
   - Draft lists (builder's call, for the owner to check in the plan):
     - Military: Army, Navy, Air force, Battle or war, Weapon or vehicle, Unit
     - Diplomacy: Treaty, Alliance or organisation, Embassy or envoy, Conference
     - Geography: Country, Region or province, City or settlement, River, lake or sea, Mountain or island, Landmark
     - Religion: Faith, Clergy, Holy site, Order or sect
     - Culture: Art or literature, Music, Sport, Festival or tradition, Language, Media
     - Government: Office or post, Legislature or body, Party, Agency or ministry, Constitution or law
     - People: Ruler or royal, Politician, Military figure, Religious figure, Artist or writer, Scientist, Family or dynasty
     - Economy: Company, Currency or bank, Industry, Trade route or market
     - Science: Technology, Discovery, Institution
     - History: Era or period, Event, Dynasty or state, Document
     - Nation: Nation, Former state
     - Special: none
3. **The classifier, fixed and extended.**
   - It reads the raw wikitext's infobox templates and the wiki's own categories.
   - It returns `{ category, subcategory, confidence }`, with `category: null` when nothing scores.
   - A per-wiki mapping table (from wiki category or infobox template to category and subcategory) is kept in code and tested.
   - The Commons importer passes the file page's categories.
   - Every importer path writes the new fields.
4. **Schema** (the SQL file and Prisma):
   - On `Card`:
     - `categorySource`: classifier, admin, realm owner or suggestion;
     - `categoryConfidence`;
     - `categoryNeedsReview`;
     - `categoryReviewedAt` and `categoryReviewedBy`.
   - A new `CardCategorySuggestion` table: card, user, proposed category and subcategory, note, status, reviewer and timestamps. Each user may hold one open suggestion per card.
   - Indexes for the review queue and the filter counts.
5. **The backfill script** (`scripts/cards/`).
   - Batches by source wiki, fetching categories and templates through the API, and classifies every lore card.
   - With `--dry-run` (the default) it writes a report: the distribution, a sample per category, the low-confidence list and the changes from the current value. With `--apply` it writes the categories, then deletes the `metadata.category` labels.
   - It is idempotent and resumable, and it never overwrites an admin-, realm-owner- or suggestion-set category.
   - It runs on `ixstats_cards` here, and it has a production runbook entry.
6. **Admin.**
   - In the Library, a category and subcategory editor on each card.
   - A "Needs review" queue that combines low-confidence classifications and player suggestions, each with approve, change or reject.
   - Every change is audited through the existing admin audit log.
7. **Realm owners:** the same editor for cards in their own realm, wherever realm owners already manage their realm's cards. The builder finds that place and reuses its permission check.
8. **Players:** "Suggest a category" on the card sheet, for signed-in players, as a small dialog with the category and subcategory pickers and an optional note. It is rate-limited, and one open suggestion per card per player.
9. **The sheet and the face:**
   - The sheet shows the category and subcategory in About, or "Uncategorised".
   - The NS "category" fact is relabelled "Pretitle".
   - The card back's lattice already uses the category (`back-motif.ts`), so it needs no change.
10. **Data:** the six seed cards are retired on the clone, and the runbook holds the production steps (the SQL, the backfill dry run then apply, and the retirement).
11. **Docs:**
    - `docs/systems/cards.md`: categories, the classifier, the queue and the editors, plus the runbook.
    - The help: lore cards, and how to suggest a category.
    - The Phase 5 plan note on Nation cards.

## Left to the builder

- The confidence threshold for review, chosen from the dry-run distribution.
- The scoring weights.
- The exact place for the realm owner's editor.
- The UI layout of the queue and the dialog, within Facet.
- The subcategory lists, within the drafts above. The plan names any change from them, for the owner to check.
