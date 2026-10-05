# Backlog — open items

**Last updated:** 2026-10-05
**Status:** The single backlog. [ROADMAP.md](ROADMAP.md) is the plan that orders these items;
[SYSTEM_STATUS.md](../systems/SYSTEM_STATUS.md) says what is live.

This page holds only the items that are still open. It replaces three overlapping lists, now in
[docs/history/roadmap/](../history/roadmap/):

- the doc-based backlog [pending-features.md](../history/roadmap/pending-features.md) (2026-09-29). Its items keep
  their section numbers as **PF§1–PF§7**, which ROADMAP.md cites;
- the code audit [code-audit-2026-09-30.md](../history/roadmap/code-audit-2026-09-30.md). Its IDs (`MC-`, `AT-`,
  `WK-`, `VT-`, `SL-`, `PL-`) are stable;
- the [platform audit](../history/roadmap/platform-audit/README.md) (2026-09-30) and its six area reports, cited as
  **PA**.

Each item was checked against the code and ROADMAP.md on 2026-10-05; everything done is left out. The full evidence
(file paths, callers, sizes) for an ID stays in the history copy. When an item closes, delete its row here, mark it
done in ROADMAP.md, and update the system doc and SYSTEM_STATUS.

**Type:** `BUG` broken · `SEC` security · `STUB` placeholder behaviour · `UNFINISHED` partly built · `FLAGGED` built
but off · `DEAD` unused code or schema · `DEBT` maintainability · `OPS` an action on the server, not code.
**Size:** S under a day · M 1–3 days · L more than 3 days.

## Contents

1. [Owner and ops actions](#1-owner-and-ops-actions)
2. [Code audit items](#2-code-audit-items)
3. [Doc-audit items (PF§1–PF§7)](#3-doc-audit-items-pf1pf7)
4. [Platform audit leftovers (PA)](#4-platform-audit-leftovers-pa)
5. [Dead schema](#5-dead-schema)

---

## 1. Owner and ops actions

| Item | Refs | Detail |
|---|---|---|
| Rotate the `ixstats_readonly` / MariaDB password | PF§1, PA §2 #8, ROADMAP M0 #16 | The old password is in git history; the scripts no longer contain it |
| Check the IxWiki bot's grants on Special:BotPasswords | PA §2 #1 | WikiOS pushes every user's edit under one bot account; the namespace policy is in code |
| Run `audit:vault-exploits:apply` on production and record the result | ROADMAP M0 #17 | — |
| Restore a production `db:backup` dump into a scratch database | ROADMAP M0 #15, PL-11 | A scratch round trip passed on 2026-10-05 |
| Run `db:mark-match-revenue-collected` at the next deploy | ROADMAP M0 #13, SL-14 | — |
| CSP: remove the nginx/Cloudflare override, check for violations, then drop `'unsafe-inline'` from `script-src` | PL-2, PF§1 | The nonce reaches the page (#46); `src/lib/security/csp.ts` |
| Deploy rose-garden via the [runbook](../operations/deploy-rose-garden-2026-09.md) | ROADMAP M1 | Realms schema, backfill, Eurth |
| Enable the 21 cron jobs one per cycle, in the runbook's order | VT-15, PF§5 | None run until named in `CRON_ENABLED_JOBS`. Auctions and trades settle only through these jobs |
| Redis in production | PF§5 | Required for realtime across processes and shared rate limits; `/api/health` reports it |
| Run the web process under PM2 | PL-12 | The template (cron, ws, ixtwitter) is committed; the web app still runs from `start-production.sh` |
| Promote rose-garden → development → master | PL-14, PL-15 | Dependabot and scheduled workflows read config from `master` only |
| Gemini workflows: add `GEMINI_API_KEY` or delete them | PL-14, D15 | — |
| Legacy passport data: clear unverified `wikiUsername` values written before the fix | PA §2 #5 | Lorewards now pays verified links only |

## 2. Code audit items

Open IDs from the [code audit](../history/roadmap/code-audit-2026-09-30.md). "Left" notes what remains of a
partly done item.

### MyCountry & simulation (MC)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| MC-3 | UNFINISHED | Defense force structure can't be created (branch and unit CRUD deleted in plan 312), so PvNPC strength is 0. Waits on D2 | `security/military.ts:64-74`; `DeploymentWizard.tsx:136` | M–L |
| MC-6 | DEAD | The ScheduledChange pipeline (service, cron job, `usePendingLocks`) has no producer. Use or delete (D11); see [scheduled-changes.md](../systems/scheduled-changes.md) | `server/modules/scheduled-changes/service.ts` | M |
| MC-17 | UNFINISHED | Threshold alerts are written to `IntelligenceAlert` but nothing reads them; their notifications link to `/mycountry/intelligence`, which renders Defense | `server/shared/intelligence-alert-thresholds.ts` | M |
| MC-18 | DEAD | Zero-importer files. Left: the other components listed in the audit (re-check each; `builder-validation.ts` is in use, `tax-revenue-mapping.ts` and `government-preview/*` are gone) | — | S |
| MC-19 | DEAD | Area models read but never written outside the seed (`Treaty`, `DiplomaticChannel`, `TaxPolicy`, `QuickActionTemplate`, `VitalityHistory`, …) | `prisma/schema/*` | S |

### Atlas, Realms & identity (AT)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| AT-3 | UNFINISHED | Builder in any realm. Left: prefill from a claimed nation page (the builder is realm-aware with nation caps since #49) | `countries/management/create.ts` | M |
| AT-5 | UNFINISHED | Claimants can't see their claim status (`realms.myClaims` has no caller); rejections send no notification | `routers/realms/index.ts`; `realms.claims.ts` | S |
| AT-6 | UNFINISHED | Realm directory filtered by `visibility` and status. Left: `/realms` lists open realms but `visibility` is unused | `realms.hub.ts` | M |
| AT-8 | UNFINISHED | A realm's founder can't be assigned (no `ownerId` or thumbnail update, no delete) | `routers/realms/index.ts` | S |
| AT-9 | STUB | Labs map pipeline enrichment is placeholder data (now labelled "sample data"); `GeographicResource` has no writer | `lib/maps/pipeline/enrichment-pipeline.ts` | M |
| AT-14 | UNFINISHED | Storylines can't be created, so the pin timeline never appears | `geo/features/storyPins.ts` | M |
| AT-15 | DEAD | Unused map models (`WorldTemplate`, `ProceduralWorld`, `Transport*` segments, `ElevationZone`, `Territory`); `SharedVertex` written, never read | `maps.prisma` | S |

### WikiOS, forum, help & admin (WK)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| WK-2 | BUG | Edit-conflict detection is dead: `basetimestamp` is accepted and never checked | `routers/wikios/editing.ts`; `core/article-repository.ts` | S–M |
| WK-3 | UNFINISHED | Page protection can't be set (no writer, no UI) | `wiki.prisma`; `lib/wiki-os/auth.ts` | M |
| WK-4 | BUG | Turnstile is inert: the result is ignored and no client sends a token | `editing.ts` | S |
| WK-5 | BUG | Uploads never send the file to MediaWiki, and a `wiki_assets` row is written first. Waits on D3 | `editing.ts`; `write-service.ts` | M |
| WK-6 | BUG | The image picker's Commons tab has no search procedure behind it, so it is always empty | `editor/ImageSearchGrid.tsx:67` | S |
| WK-7 | UNFINISHED | Pages can't be moved or archived (plan 312 removed the procedures) | `core/page-management-service.ts` | M |
| WK-12 | DEAD | Narrator LLM narration has no production caller (the key is masked). Wire or retire (D10) | `routers/narrator/index.ts` | M |
| WK-16 | BUG | Revert and rollback skip the edge-cache purge | `editing.ts` | S |
| WK-17 | STUB | BlurHashes are generated from the filename, not the image | `core/blurhash-service.ts` | S–M |
| WK-19 | DEAD | Watchers are never notified when a watched page changes | `wiki.prisma` | S–M |
| WK-20 | UNFINISHED | Forum moderation happens on XenForo only (D12); make the help copy say so | `routers/forum/account.ts` | S |

### Vault, cards & achievements (VT)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| VT-12 | UNFINISHED | Only the buyer sees their own cosmetics (no public equipped-cosmetics query) | `hooks/useActiveCosmetics.ts` | M |
| VT-14 | BUG | Crafting. Left: the MYTHIC recipe (D6). The workbench sends ownership IDs and shows one slot per card a recipe consumes, and `db:seed` runs the crafting seed (2026-10-05) | `crafting/recipes.ts` | S |
| VT-16 | DEAD | The Exchange (₷) economy exists only in the schema (11 of 13 models unused); wallets seeded with 10,000 ₷; `spend` has no conditional decrement. D5 | `exchange.prisma`; `lib/vault/exchange-service.ts` | L |
| VT-19 | DEAD | `pdsConfig` is seeded on all 20 packs and never read | `prisma/seeds/data/card-packs.json`; `cards.prisma` | S |
| VT-25 | DEAD | `NSImport`, `SyncCheckpoint` and `CardTrade` are unused | `cards.prisma` | S |

### Social, Halo & Labs (SL)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| SL-4 | FLAGGED | Privacy. Blocking now covers group chats (messages, unread counts, previews, notifications). Left: the hidden toggles (DM/mention/trade permissions, online status, read receipts, indexing, telemetry, muted words, clear history) have no enforcement | `routers/users/preferences.ts`; `server/shared/user-blocks.ts` | M |
| SL-5 | FLAGGED | Notifications. Admin notices to one user and sports results respect recipient preferences (2026-10-05). Left: country-wide and global admin broadcasts are unfiltered by design; no email or push delivery | `lib/notifications/recipient-preferences.ts` | M |
| SL-16 | UNFINISHED | Rivalries are read but never created | `simulate-and-persist.ts` | M |
| SL-18 | UNFINISHED | The Onoma language-pack marketplace has no way to publish a pack | `routers/onoma/marketplace.ts` | M |
| SL-27 | FLAGGED | The Discord mirror, sports LLM commentary and sports TTS are off by default; Labs routes have no server-side gate (`src/app/labs/layout.tsx`) | `narrator.ts` | S |

### Platform & infrastructure (PL)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| PL-12 | DEBT | `next.config.js` isn't tracked; the web process isn't under PM2 (see §1) | — | S |
| PL-16 | DEBT | `src/tests` isn't typechecked in CI (≈890 errors on 2026-10-05; scripts, seeds, proxy, instrumentation and content are) | `ci.yml` | M |

**Router test gaps:** 35 of 69 routers had no router-level test on 2026-09-30; the largest are thinkpages, lore-cards,
national-issues, forum, blurbs and card-market.

## 3. Doc-audit items (PF§1–PF§7)

Open items from [pending-features.md](../history/roadmap/pending-features.md), under its section numbers. "Source"
links point at the doc that describes the intended behaviour.

### PF§1 Security

See §1 above (password rotation, CSP).

### PF§2 Broken or regressed features

| Item | System | Detail |
|---|---|---|
| Crafting | Vault | See VT-14 |
| Vexel attach-to-country | Labs › Vexel | Attach now refuses a design with no image instead of blanking the coat of arms; no PNG render exists, so attach always refuses ([vexel.md](../systems/vexel.md)) |
| `db.ts` runs `syncAchievements` on import | Platform | Fires whenever the module loads on the server outside tests and read-only mode, including in scripts |
| Auctions filter offers "Mythic" | Vault | Not a `CardRarity` value (`VaultAuctionsTab.tsx:225`) |
| Diplomatic missions and embassy upgrades removed | MyCountry › Diplomacy | `startMission`, `completeMission`, `upgradeEmbassy`, `allocateBudget` deleted (plan 312); playable missions are M4 |

### PF§3 Partly built — finish the documented scope

**MyCountry & simulation**
- **Information fog:** qualitative bands at governance-competence thresholds. Source: [design PRDs](../systems/mycountry-design-philosophy-and-prds.md) :39, :449; [game loops](../systems/statecraft/statecraft-game-loops.md) :115.
- **Universal event spine:** diplomacy, defense, elections and meetings bypass it (PRD Rule 6, :374). Meeting decisions don't reach it yet.
- **Issue recon ("SEE"):** enable `STATECRAFT_SPINE` and have recon meetings return minutes/cables (game loops :14).
- **Intelligence:** no dashboard; `/mycountry/intelligence` renders Defense (MC-17).
- **Crisis events:** taxonomy, lifecycle, response postures, mutations, admin UI ([crisis-events.md](../systems/crisis-events.md)); nothing writes `CrisisEvent` rows.
- **NPC AI:** trait drift (no callers); NPC responses for embassies and treaties; event-fatigue dampening ([npc-ai.md](../systems/npc-ai.md) :41, :54).
- **Relative-development asymmetry:** feed it into trade maths.
- **Builder companion guide:** diagnostics tab and subheader deep links ([spec](../specs/2026-09-08-builder-unified-companion-guide-design.md) :79).
- **Autosave rollout:** government/tax hooks, National Identity and Map Editor, a navigation flush (`syncAllNow`) and a shared sync badge ([autosave.md](../architecture/autosave.md)).
- **Reference formulas → live engine:** ERI, embassy synergy, GDP projection; PII is design-only ([calculations.md](../systems/calculations.md)).
- The `VitalitySnapshot`, `IntelligenceBriefing` and `IntelligenceRecommendation` models are still in the schema after their writers were deleted.

**Atlas & Realms**
- **Map editor inspector** ([2026-09-11 spec](../specs/2026-09-11-map-editor-properties-history-deep-overhaul-design.md)): telemetry chips, geometry actions (Snap to River, Calculate Centroid, Simplify Polygon, Snap Vertices to Cities, Smooth Spline), batch alignment and parent assignment, optimistic history.
- **Topology validation:** cross-country gap/overlap checks on save.
- **Named rivers/lakes → trade modifiers:** `computeEconomicGeoModifiers` ignores named features.

**WikiOS**
- **Export durability:** the MediaWiki export queue is in memory; per-user actor attribution is a no-op.
- **Margin:** `toggleCommentReaction`, `deleteComment`, the Stash tab, and un-hiding the Inspect tab ([margin spec](../systems/wikios/wikios-margin-spec.md)).
- **Stash share links:** `?stash=` is never read; stashes have no visibility field or public read path (M, schema change).
- **Guardian:** mass-blanking and homoglyph abuse filter.
- **Portability:** `transformers/html-transformer.ts` hard-codes `https://ixwiki.com/`.
- **Duplicate routes:** four dynamic pages exist under both `/wiki` and `/util`.

**Vault**
- **Packs:** wire the Keep/List quick actions; pack artwork.
- **NATION cards:** automatic per-country minting; the `card-values` job does nothing until then.
- **NS dump sync:** schedule it (admin-triggered today).
- **Premium:** real yield multiplier (`isPremium` hard-coded false in `vault-ledger.ts`); enforce tier limits.

**ThinkPages**
- **ThinkShare encryption & signatures:** schema fields exist, no cryptography (D7).

**Labs**
- **MyLeague:** boxing bout engine; Golden Box stage config UI and double elimination; patron-saint MyClub UI and Sports → Storyteller write-back.
- **Onoma:** partial phases 4, 5, 8, 9 ([onoma-roadmap.md](../systems/onoma-roadmap.md)).
- **Vexel:** external ornaments (crest, mantling, supporters, compartment); Commons charge seed; embedded attribution; autosave; `[id]/preview` route ([Vexel PRD](../specs/2026-07-15-vexel-prd.md)).

**Platform**
- **Rate limiting:** `wikios` mutations (20) wait on #52; `X-RateLimit-*` headers; stats endpoint, metrics and Discord alerts ([rate-limiting.md](../operations/rate-limiting.md)).
- **Admin cache:** evict/flush (only `getStats` exists).

### PF§4 Not started — planned features

**Realms Phases 2–4** ([realms-framework-spec.md](../architecture/realms-framework-spec.md))
- Public founding application (decisions 6–7)
- Founder tooling: settings, moderation, removing nations, succession using `lastSeenAt` (decisions 20–21; needs AT-8)
- Archived realms: read-only, excluded from crons and payouts (decision 21)
- Per-realm feed and a global-feed setting (decision 2): the dashboard feed and trending are not realm-scoped
- WikiOS front page as a portal to every realm's lore; realm-tagged forum (decision 3)
- Per-realm calendar label (a new realm settings key)
- Builder prefill from a claimed nation page (Eurth E-f; AT-3)
- Procedural realm generation: the wizard option and the `Realm.seed` / `generationParams` writes (M)

**MyCountry statecraft** ([design PRDs](../systems/mycountry-design-philosophy-and-prds.md), [game loops](../systems/statecraft/statecraft-game-loops.md))
- Intent DAG with Vision / Strategic / Operational layers, `NationalIntent` / `IntentDependency` (:274, :318, :333)
- Government-generated Plans A/B/C (Rule 2, :370)
- Deliberation meeting loop, 7 meeting categories, participant profiles (:398, :421, :432)
- AI morning briefing and "since last visit" (:478)
- Decide / Review / Monitor / Celebrate dashboard state engine (:489)
- Legislature domain: party red lines, bills as intent nodes (:535)
- Foreign Affairs domain: `ForeignMission`, treaties as programs, summits as meetings (:546)
- Infrastructure domain: Planning Board and projects (:531)
- Frameworks 1–4: Milestone, Coalition, Geography and Crisis loops (:152–191)
- Public governance ledger on the country profile (:247)
- Reactive/proactive split in the issue inbox (:249)
- Mandate as a gate/multiplier; weekly lever regeneration (game loops :51, :72)
- Atom-biased issue deck; atom-parameterized fog and regeneration (game loops :136–146)
- Cross-arena ripple beyond intent resistance (game loops :101)
- Directives that change transport network speeds ([route travel-time spec](../specs/2026-09-12-route-travel-time-design.md) §5)
- Edge cases: tier-transition smoothing, "IMF intervention" recession event, optimistic locking via a `version` column ([edge-cases.md](../reference/edge-cases.md))

**Vault & cards**
- Ribbons: Ribbons tab and community ribbons ([ribbons spec](../specs/2026-08-10-achievements-ribbons-design.md) §2, §3.2)
- Lore-first schema cleanup: unique slug, `@@unique([wikiArticleTitle, wikiSource])`, drop stats/cardType, `CardRarity` enum ([ixcards spec](../specs/2026-08-13-ixcards-lore-first-rebuild.md) Part III); 40/25/20/10/4/1 rarity distribution (Part IV)
- Vault reorder (Lore Gallery primary, category filters); category-themed packs; seasons
- Crafting extensions: catalysts, recipe discovery, guilds, bulk crafting, achievements, history/stats/admin endpoints
- Real-time card updates over WebSocket
- Premium: payments/checkout (D4), tiered rate limits, export quotas, history limits, ThinkPages Pro tiers ([premium-features.md](../reference/premium-features.md))

**ThinkPages**
- Joint working papers

**Labs**
- **Onoma** ([roadmap](../systems/onoma-roadmap.md)): vocabulary timeline slider (:114), language family trees (:115); semantic embeddings / TF-IDF (:121), corpus gap recommender (:122); AI Linguist (:127–128), free-text translator (:147), dialect branch merging (:153); Phase 10 AI agents (:158); platform integration: NPC dynasties, map toponyms, MyCountry demonyms (:175–180).
- **MyLeague / MySports** ([PRD](../specs/2026-06-12-myleague-v1-prd.md), [MySports v0](../specs/2026-09-22-mysports-v0.md)): AegisCore engine and sport DSL; dynasty detection, significance scoring, national leaderboards; market-currency club valuations; promotion/relegation bulletin; broadcast mode, live speed, momentum graph, `<AthleteCard>`; bid-distribution transfer UI, institutional management, scouting, medical, academy.
- **Vexel:** P1 templates, conflict detection, personal arms, keyboard shortcuts; P2 items 1–10.
- **Strata & Dynas** labs: roadmap only.

**Platform & integrations**
- Hugging Face Space offload for Whisper and an LLM ([huggingface-spaces-guide.md](../operations/huggingface-spaces-guide.md))
- Browser end-to-end tests (Playwright isn't installed)
- WikiOS Stage 3 MediaWiki isolation: nginx lockdown, 301s, `LocalSettings`, internal `WIKIOS_MEDIAWIKI_API` endpoint ([stage3 plan](../systems/wikios/wikios-stage3-config-plan.md))
- WikiOS Workstream C packaging: decouple Clerk, the IxStats DB and templates ([longevity workflow, historical](../history/systems/wikios/wikios-longevity-workflow.md))
- Lore-card portfolio boosts ([lore-lifecycle.md](../systems/lore-lifecycle.md))

### PF§5 Operations & infrastructure

- Cron enablement and Redis: see §1.
- **Drop unused Prisma models:** see §5. The `chore/drop-unused-prisma-models` branch is not on origin.
- **Incident-response runbook:** missing ([monitoring.md](../operations/monitoring.md#incident-response)).
- **Discord bot admin session:** the bot calls `admin.getSystemStatus` (admin-only); no doc covers how it authenticates.
- **Leftovers:** `scripts/post-build.sh` prints `pm2 restart ixstats` (no such app); `scripts/start-production.js` and `scripts/verify-router-splits.ts` are unwired.

### PF§6 Code health & tech debt

- **Git-ignored fixtures:** three checks read files CI doesn't have (`next.config.js`, `public/icons/game-icons-manifest.json`, `public/data/vector-seeds/`); they only run where the file exists.
- **Size ratchet:** `audit:arch` is blocking (2026-10-05); keep shrinking the 39 baselined files. The 800+-line files are tracked in [src-monolith-candidates.md](../audits/src-monolith-candidates.md).
- **Service layer:** about 200 router files query `ctx.db` directly.
- **Arch guard coverage:** no pre-commit hook for `audit:arch`; the router-split parity check covers 5 routers.
- **Logging:** a handful of `logger.*` calls against ~1,700 `console.*`; decide the framework's fate.
- **Duplication:** atomic government/economy/tax triplicates; rarity palettes; sports simulate/persist and `season-cron.ts`; random-string id helpers; JSON deep copies.
- **Size:** `lib/notifications/hooks.ts` (~1,300 lines); `wikios/templates.ts` holds static data.
- **Design cleanup (plan 346 remainder):** hex colours, `dark:` variants, blurs, pulses, Sparkles icons ([HEX_COLOUR_INVENTORY](../audits/HEX_COLOUR_INVENTORY_2026-09-27.md), [Facet style audit](../audits/FACET_STYLE_AUDIT_2026-09-30.md)).
- **Product calls:** deck.gl and tsparticles usage; `DATABASE_READONLY` replacement; IxTimeSyncManager / AccuracyVerifier; root provider nesting.
- **Stale code comments** (as of 2026-09-29): `AdminRouter.tsx:3`, `routers/forum/index.ts`, `routers/wikios/index.ts`, `cloudflare-guardian.ts`.
- **Pack seed:** the `LIMITED` pack type isn't in the `PackType` constant (`prisma/seeds/data/card-packs.json`).

### PF§7 Documentation gaps

- **Help center:** remove the "Not available yet" notes as features land ([help.md](../systems/help.md#known-gaps)). Every shipped system now has an article (Lorewards, ribbons and showcase, crafting, shop items and the activity feed added 2026-10-05).
- **Specs to retire once implemented and confirmed:** the realms foundation, realms Eurth and route travel-time specs; [myleague-top5-features](../systems/myleague-top5-features.md), [sports-llm-commentary](../research/sports-llm-commentary.md), [myleague-lore-integration](../systems/myleague-lore-integration.md) (mostly obsolete); [deploy-rose-garden-2026-09](../operations/deploy-rose-garden-2026-09.md) after the 1.4 release. Move them to [docs/history/](../history/README.md).
- **Trim:** [rate-limiting.md](../operations/rate-limiting.md) (~1,350 lines, mostly sketches); [refactoring.md](../processes/refactoring.md) (~1,000 lines of generic guidance).
- **Phase 4 follow-ups** ([action plan](ACTION_PLAN_2026-10-05.md#phase-4--consolidate-the-documentation-set)): one MyLeague system doc; Onoma and Stash subfolders; add doc updates to the PR checklist.

## 4. Platform audit leftovers (PA)

From the [platform audit](../history/roadmap/platform-audit/README.md) and its area reports
([atlas](../history/roadmap/platform-audit/atlas.md), [mycountry](../history/roadmap/platform-audit/mycountry.md),
[vault-identity](../history/roadmap/platform-audit/vault-identity.md),
[wikios-onoma](../history/roadmap/platform-audit/wikios-onoma.md),
[social-core](../history/roadmap/platform-audit/social-core.md), [ponytail](../history/roadmap/platform-audit/ponytail.md)),
items not already listed above:

- **PR #49 known gaps:** no region filter on rankings (`mycountry.getRankings` takes only `countryId`); DMs can't be sent as a persona or country; appointed chambers are still seated by the vote simulation.
- **Atlas:** worldgen is a Labs demo that saves nothing; geography modifiers (profiles, resources, climate) are displayed but never read by the economy; every map feature needs a country; no GeoJSON/Azgaar import or export; no terrain raster (atlas report).
- **Two sources of truth:** projected vs stored country stats; `ixTimeTimestamp` columns with two meanings (MC-16 fixed the wall-clock writers); Clerk ids and internal ids mixed across tables (for example, sports club notifications keyed by internal id never show in the tray list — [notifications.md](../systems/notifications.md#8-known-gaps)).
- **Country where the platform should be:** the dividend and many achievements still need a country; personas live in ThinkPages rather than IxnayID.
- **Five nations per realm:** a platform default of 5 with a tier-aware cap (`min(realm cap, tier cap)`) tied to one premium definition; decide dividends and achievements per account or per nation (PA §7).
- **Halo plugins** for ThinkPages, Messages, Vault and Maps are missing.
- **WikiOS independence:** render from Postgres wikitext, native media, rights model, then a renderer contract and XML import/export (wikios-onoma report).
- **Ponytail (simplification):** ~21,000 unreachable lines in `src/` (re-measure; some clusters are deleted), 16 duplication patterns with proposed homes, `audit:wiring` broken by the `minimatch: ^3` override, ~19,500 lines in `scripts/archive`.

## 5. Dead schema

From code audit §8 (2026-09-30, 332 models then; 338 now). 57 models had no accessor at all (c15t consent 8,
Exchange 11, diplomacy 7, economy modelling 7, social 5, media player 4, archetypes 3, security/logging 3, maps 5,
cards 3, military 1), 7 are read but never written, and about 16 are written only by the old demo seed. Dropping
them needs backups (done) and decisions D1, D2, D5 and D9. Don't drop models that defense (MC-3), crisis events,
procedural realms (AT-15) or the Exchange (VT-16) would use until those are decided. The full list is in the
[history copy](../history/roadmap/code-audit-2026-09-30.md#8-dead-schema).
