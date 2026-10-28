# Backlog — open items

**Last updated:** 2026-10-27
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

Each item was checked against the code and ROADMAP.md on 2026-10-05 and again on 2026-10-27, after release 1.5
(public 1.0.0); items done in 1.5 are listed in [Done in 1.5](#done-in-15-2026-10-27). The full evidence
(file paths, callers, sizes) for an ID stays in the history copy. When an item closes, delete its row here, mark it
done in ROADMAP.md, and update the system doc and SYSTEM_STATUS.

**Type:** `BUG` broken · `SEC` security · `STUB` placeholder behaviour · `UNFINISHED` partly built · `FLAGGED` built
but off · `DEAD` unused code or schema · `DEBT` maintainability · `OPS` an action on the server, not code.
**Size:** S under a day · M 1–3 days · L more than 3 days.

## Contents

1. [Owner and ops actions](#1-owner-and-ops-actions) (including Ops post-1.5)
2. [Code audit items](#2-code-audit-items)
3. [Doc-audit items (PF§1–PF§7)](#3-doc-audit-items-pf1pf7)
4. [Platform audit leftovers (PA)](#4-platform-audit-leftovers-pa)
5. [Dead schema](#5-dead-schema)
6. [Done in 1.5 (2026-10-27)](#done-in-15-2026-10-27)

---

## 1. Owner and ops actions

### Ops (post-1.5)

Opened after the 1.5 deploy (2026-10-26/27). ROADMAP orders them under
[Next: server rebuild and ops](ROADMAP.md#next-server-rebuild-and-ops-10x).

| ID | Type | Item | Detail | Size |
|---|---|---|---|---|
| OPS-1 | SEC | **Rebuild production on a clean server with full secret rotation** | The server was found compromised (since 2026-09-26) and contained. Rotate every secret (Clerk, Discord bot token, database and Redis passwords, cron and webhook secrets, API keys, SSH keys) and redeploy from `master`; nothing carried over from the old host unchecked | L |
| OPS-2 | SEC | Rotate the `ixstats_readonly` / MariaDB password | The old password is in git history (PF§1, PA §2 #8); the scripts no longer contain it. Fold into OPS-1 | S |
| OPS-3 | OPS | Restore a production `db:backup` dump into a scratch database | [Release guide: open operations items](../operations/release-guide.md#open-operations-items); a scratch round trip passed on 2026-10-05 (PL-11) | S |
| OPS-4 | OPS | Copy `backups/` off the server | The dumps sit on the same disk as the database | S |
| OPS-5 | OPS | Review `audit:vault-exploits`, then `audit:vault-exploits:apply`; then `refund-lore-tokens.ts`, then `db:refund-retired-store-items -- --apply` | 9 corrections, including −5,000 IxC. Retired-store refunds pay each purchase once at what was paid ([myvault.md](../systems/myvault.md#retired-store-items)) | S |
| OPS-6 | OPS | Review `audit:forum-links` | 4 forum accounts linked without proof (WK-1) | S |
| OPS-7 | OPS | Hand-set `Country.ownedSince` for 8 nations | The backfill could not date them | S |
| OPS-8 | OPS | Link Carthinova to Kir | Admin → Users → Name claims | S |
| OPS-9 | OPS | Re-run card compliance with `--fetch` | `scripts/cards/backfill-card-compliance.ts`; Wikimedia Commons rate-limited the first run | S |
| OPS-10 | OPS | Enable the remaining cron jobs one per cycle | [Release guide A7](../operations/release-guide.md#a7-cron-jobs); none run until named in `CRON_ENABLED_JOBS`, and auctions and trades settle only through them (VT-15) | S |
| OPS-11 | BUG | WikiOS weekly proof can't run against production | `src/server/cron/wikios-proof-cron.ts` pins `BASE_PATH: "/projects/ixstates"`; production is now at beta.ixwiki.com with no base path | S |
| OPS-12 | DEBT | Remove WikiOS's unused site-editing rights (owner decision D21) | `editinterface`, `editsitecss`, `editsitejs`, `editsitejson` in `src/lib/wiki-os/rights.ts`; nothing reads them ([cutover runbook](../history/operations/wikios-v1-cutover.md)) | S |
| OPS-13 | OPS | Confirm Clerk allowed origins include beta.ixwiki.com | Clerk dashboard | S |

### Standing owner and ops actions

| Item | Refs | Detail |
|---|---|---|
| Check the IxWiki bot's grants on Special:BotPasswords | PA §2 #1 | WikiOS pushes every user's edit under one bot account; the namespace policy is in code. Re-check after OPS-1 |
| CSP: check for violations, then drop `'unsafe-inline'` from production `script-src` | PL-2, PF§1 | On beta.ixwiki.com nothing replaces the app's header and it carries the nonce (checked 2026-10-27); `src/lib/security/csp.ts`; [release guide](../operations/release-guide.md#csp-the-apps-header-then-unsafe-inline) |
| Optional: configure notification email (`EMAIL_*`) and Web Push (`VAPID_*`), then enable `notification-email-digest` | SL-5 | Built and off until configured; Settings shows the switches only then |
| Redis in production | PF§5 | Required for realtime across processes and shared rate limits; `/api/health` reports it |
| Gemini workflows: add `GEMINI_API_KEY` or delete them | PL-14, D15 | Four `gemini-*.yml` workflows remain in `.github/workflows/` |

## 2. Code audit items

Open IDs from the [code audit](../history/roadmap/code-audit-2026-09-30.md). "Left" notes what remains of a
partly done item.

### MyCountry & simulation (MC)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| MC-19 | DEAD | Area models read but never written outside the seed (`Treaty`, `DiplomaticChannel`, `QuickActionTemplate`, …; `TaxPolicy` and `VitalityHistory` dropped with D9) | `prisma/schema/*` | S |

### Atlas, Realms & identity (AT)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| AT-15 | DEAD | `SharedVertex` written, never read. The unused `Transport*` segment models, `ElevationZone` and `Territory` were dropped with D9 (2026-10-27); `WorldTemplate`, `ProceduralWorld` (38 rows on the local clone) and `Realm.templateId` were dropped by the Atlas and World Studio overhaul (`prisma/migrations/20261023120000_atlas_studio/migration.sql`, run before `db push`) | `maps.prisma` | S |

### Vault, cards & achievements (VT)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| VT-16 | UNFINISHED | Exchange (₷) leftovers. The MVP and phase 2 (share market, dividends, sector indices and funds, `EXPAND`/`ENTER_SECTOR` decisions, B2G tenders, contract expiry, notifications, relaxed out allowance) are built (2026-10-06); left: `RND`/`ACQUIRE`/`LOBBY`/`PRICE` decisions, admin- or sim-issued tenders (a ₷ faucet) and a nation ₷ treasury, an order book, an admin control for `SectorIndex.dmModifier` ([spec §8](../specs/2026-10-06-exchange-economy-design.md#still-not-built)) | `exchange.prisma`; `lib/exchange/` | M |
| VT-19 | DEAD | Left: the `pdsConfig` key is still seeded on all 20 packs; the column is gone from `cards.prisma` | `prisma/seeds/data/card-packs.json` | S |

**Crafting is deprecated (owner, 2026-10-05).** Every `crafting.*` call refuses and the workbench, its nav entries and
admin switch are gone, so VT-14 (crafting fixes), its PF§2 row and the PF§4 crafting extensions are moot, as are
decision D6 (the MYTHIC recipe) and "failed crafting rolls consume materials". The `CraftingRecipe` and
`CraftingHistory` models are gone from the schema; the `crafting` router directory remains.

### Social, Halo & Labs (SL)

| ID | Type | Item | Evidence | Size |
|---|---|---|---|---|
| SL-27 | FLAGGED | The Discord mirror, sports LLM commentary and sports TTS are off by default. `/labs/*` is gated on the server (2026-10-05) | `SPORTS_LLM_*` in `src/env.ts`; `src/lib/sports/` (the narrator was removed with D10) | S |

### Platform & infrastructure (PL)

**Router test gaps:** all 69 top-level routers had a router-level test on 2026-10-05; `src/server/api/root.ts` now
mounts 78, so the newer ones need a re-check. 63 sub-router files were imported by no test then; the largest were
`wikios/templates`, `wikios/page-content`, `admin/worldEvents`, `admin/wiki` and `diplomaticScenarios/scenarios`.

## 3. Doc-audit items (PF§1–PF§7)

Open items from [pending-features.md](../history/roadmap/pending-features.md), under its section numbers. "Source"
links point at the doc that describes the intended behaviour.

### PF§1 Security

See §1 above (OPS-1, OPS-2, CSP).

### PF§2 Broken or regressed features

| Item | System | Detail |
|---|---|---|
| Diplomatic missions and embassy upgrades removed | MyCountry › Diplomacy | `startMission`, `completeMission`, `upgradeEmbassy`, `allocateBudget` deleted (plan 312); playable missions are M4 |

### PF§3 Partly built — finish the documented scope

**MyCountry & simulation**
- **Information fog:** qualitative bands at governance-competence thresholds. Source: [design PRDs](../systems/mycountry-design-philosophy-and-prds.md) :39, :449; [game loops](../systems/statecraft/statecraft-game-loops.md) :115.
- **Universal event spine:** diplomacy, defense, elections and meetings bypass it (PRD Rule 6, :374). Meeting decisions don't reach it yet.
- **Issue recon ("SEE"):** enable `STATECRAFT_SPINE` and have recon meetings return minutes/cables (game loops :14).
- **Intelligence:** no dashboard; `/mycountry/intelligence` renders Defense. Threshold alerts are read and resolved on the overview (MC-17, done 2026-10-05).
- **Crisis events:** taxonomy, lifecycle, response postures, mutations, admin UI ([crisis-events.md](../systems/crisis-events.md)); nothing writes `CrisisEvent` rows.
- **NPC AI:** trait drift (no callers); NPC responses for embassies and treaties; event-fatigue dampening ([npc-ai.md](../systems/npc-ai.md) :41, :54).
- **Relative-development asymmetry:** feed it into trade maths.
- **Reference formulas → live engine:** ERI, embassy synergy, GDP projection; PII is design-only ([calculations.md](../systems/calculations.md)).
- The `VitalitySnapshot`, `IntelligenceBriefing` and `IntelligenceRecommendation` models are still in the schema after their writers were deleted.

**Atlas & Realms**
- **Map editor inspector** ([2026-09-11 spec](../specs/2026-09-11-map-editor-properties-history-deep-overhaul-design.md)): telemetry chips, geometry actions (Snap to River, Calculate Centroid, Simplify Polygon, Snap Vertices to Cities, Smooth Spline), batch alignment and parent assignment, optimistic history.
- **Topology validation:** cross-country gap/overlap checks on save.
- **Named rivers/lakes → trade modifiers:** `computeEconomicGeoModifiers` ignores named features.

**WikiOS**
- **Margin:** `toggleCommentReaction`, the Stash tab, and un-hiding the Inspect tab ([margin spec](../systems/wikios/wikios-margin-spec.md)). `deleteComment` exists (`wikios/discussions.ts`, used by `MarginThreadsTab`).
- **Stash share links:** `?stash=` is never read; stashes have no visibility field or public read path (M, schema change).
- **Guardian:** mass-blanking and homoglyph abuse filter.

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
- Founder tooling left: automatic succession using `lastSeenAt` and founder removal of a nation (decisions 20–21). Settings, officers, the inactivity release and Hand over shipped ([realms.md](../systems/realms.md))
- Archived realms: excluded from crons and payouts (decision 21); read-only on the site already
- Per-realm feed and a global-feed setting (decision 2): the dashboard feed and trending are not realm-scoped
- WikiOS front page as a portal to every realm's lore; realm-tagged forum (decision 3)

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
- Directives that change transport network speeds ([route travel-time spec](../history/specs/2026-09-12-route-travel-time-design.md) §5)
- Edge cases: tier-transition smoothing, "IMF intervention" recession event, optimistic locking via a `version` column ([edge-cases.md](../reference/edge-cases.md))

**Vault & cards**
- Ribbons: Ribbons tab and community ribbons ([ribbons spec](../specs/2026-08-10-achievements-ribbons-design.md) §2, §3.2)
- Lore-first schema cleanup: unique slug, `@@unique([wikiArticleTitle, wikiSource])`, drop stats (the `CardRarity` enum shipped with the cards refresh) ([ixcards spec](../history/specs/2026-08-13-ixcards-lore-first-rebuild.md) Part III); 40/25/20/10/4/1 rarity distribution (Part IV)
- Category-themed and realm packs; seasons (cards refresh Phases 4 and 5; the Vault reorder shipped as the cards hub, whose Explore tab has the category filters)
- Real-time card updates over WebSocket
- Premium: payments/checkout (D4), tiered rate limits, export quotas, history limits, ThinkPages Pro tiers ([premium-features.md](../reference/premium-features.md))

**ThinkPages**
- Joint working papers

**Labs**
- **Onoma** ([roadmap](../systems/onoma-roadmap.md)): vocabulary timeline slider (:114), language family trees (:115); semantic embeddings / TF-IDF (:121), corpus gap recommender (:122); AI Linguist (:127–128), free-text translator (:147), dialect branch merging (:153); Phase 10 AI agents (:158); platform integration: NPC dynasties, map toponyms, MyCountry demonyms (:175–180).
- **MyLeague / MySports** ([PRD](../history/specs/2026-06-12-myleague-v1-prd.md), [MySports v0](../specs/2026-09-22-mysports-v0.md)): AegisCore engine and sport DSL; dynasty detection, significance scoring, national leaderboards; market-currency club valuations; promotion/relegation bulletin; broadcast mode, live speed, momentum graph, `<AthleteCard>`; bid-distribution transfer UI, institutional management, scouting, medical, academy.
- **Vexel:** P1 templates, conflict detection, personal arms, keyboard shortcuts; P2 items 1–10.
- **Strata & Dynas** labs: roadmap only.

**Platform & integrations**
- Hugging Face Space offload for Whisper and an LLM ([huggingface-spaces-guide.md](../history/operations/huggingface-spaces-guide.md))
- Browser end-to-end tests (Playwright isn't installed)
- WikiOS Stage 3 MediaWiki isolation: nginx lockdown, 301s, `LocalSettings`, internal `WIKIOS_MEDIAWIKI_API` endpoint ([stage3 plan](../history/systems/wikios/wikios-stage3-config-plan.md))
- WikiOS Workstream C packaging: decouple Clerk, the IxStats DB and templates ([longevity workflow, historical](../history/systems/wikios/wikios-longevity-workflow.md))
- Lore-card portfolio boosts ([lore-lifecycle.md](../systems/lore-lifecycle.md))

### PF§5 Operations & infrastructure

- Cron enablement and Redis: see §1.
- **Drop unused Prisma models:** applied (D9, see §5).
- **Incident-response runbook:** missing ([monitoring.md](../operations/monitoring.md#incident-response)).
- **Discord bot admin session:** the bot calls `admin.getSystemStatus` (admin-only); no doc covers how it authenticates.
- **Leftover:** `scripts/verify-router-splits.ts` is not wired into CI (it is a documented manual tool in `scripts/README.md`); wire it or leave it manual.

### PF§6 Code health & tech debt

- **Git-ignored fixtures:** two checks read files CI doesn't have (`public/icons/game-icons-manifest.json`, `public/data/vector-seeds/`); they only run where the file exists.
- **Size ratchet:** `audit:arch` is blocking (2026-10-05); keep shrinking the 39 baselined files. The 800+-line files are tracked in [src-monolith-candidates.md](../audits/src-monolith-candidates.md).
- **Service layer:** about 200 router files query `ctx.db` directly.
- **Arch guard coverage:** no pre-commit hook for `audit:arch`; the router-split parity check covers 5 routers.
- **Logging:** a handful of `logger.*` calls against ~1,700 `console.*`; decide the framework's fate.
- **Duplication:** atomic government/economy/tax triplicates; rarity palettes; sports simulate/persist and `season-cron.ts`; random-string id helpers; JSON deep copies.
- **Size:** `lib/notifications/hooks.ts` (~611 lines); `wikios/templates.ts` holds static data.
- **Design cleanup (plan 346 remainder):** hex colours, `dark:` variants, blurs, pulses, Sparkles icons ([HEX_COLOUR_INVENTORY](../history/audits/HEX_COLOUR_INVENTORY_2026-09-27.md), [Facet style audit](../history/audits/FACET_STYLE_AUDIT_2026-09-30.md)).
- **Product calls:** deck.gl and tsparticles usage; `DATABASE_READONLY` replacement; IxTimeSyncManager / AccuracyVerifier; root provider nesting.
- **Stale code comments** (as of 2026-09-29): `AdminRouter.tsx:3`, `routers/wikios/index.ts`, `cloudflare-guardian.ts`.

### PF§7 Documentation gaps

- **Help center:** remove the "Not available yet" notes as features land ([help.md](../systems/help.md#known-gaps)). Every shipped system now has an article (Lorewards, ribbons and showcase, shop items and the activity feed added 2026-10-05); the crafting article was removed when crafting was deprecated.
- **Docs to retire:** [myleague-lore-integration](../systems/myleague.md#lore-fidelity) (mostly obsolete); move it to [docs/history/](../history/README.md). The realms, route travel-time and MyLeague specs and the rose-garden deploy runbook already moved (2026-10-27).
- **Trim:** [rate-limiting.md](../operations/rate-limiting.md) (~1,350 lines, mostly sketches); [refactoring.md](../processes/refactoring.md) (~1,000 lines of generic guidance).
- **Phase 4 follow-ups** ([action plan](../history/roadmap/ACTION_PLAN_2026-10-05.md#phase-4--consolidate-the-documentation-set)): one MyLeague system doc; Onoma and Stash subfolders; add doc updates to the PR checklist.

## 4. Platform audit leftovers (PA)

From the [platform audit](../history/roadmap/platform-audit/README.md) and its area reports
([atlas](../history/roadmap/platform-audit/atlas.md), [mycountry](../history/roadmap/platform-audit/mycountry.md),
[vault-identity](../history/roadmap/platform-audit/vault-identity.md),
[wikios-onoma](../history/roadmap/platform-audit/wikios-onoma.md),
[social-core](../history/roadmap/platform-audit/social-core.md), [ponytail](../history/roadmap/platform-audit/ponytail.md)),
items not already listed above:

- **PR #49 known gaps:** no region filter on rankings (`mycountry.getRankings` takes only `countryId`); DMs can't be sent as a persona or country; appointed chambers are still seated by the vote simulation.
- **Atlas:** geography modifiers (profiles, resources, climate) are displayed but never read by the economy; every map feature needs a country; no GeoJSON/Azgaar import or export; the only terrain raster is the hillshade `relief` layer (Atlas Release A) (atlas report).
- **Two sources of truth:** projected vs stored country stats; `ixTimeTimestamp` columns with two meanings (MC-16 fixed the wall-clock writers); Clerk ids and internal ids mixed across tables (for example, sports club notifications keyed by internal id never show in the tray list — [notifications.md](../systems/notifications.md#8-known-gaps)).
- **Country where the platform should be:** the dividend and many achievements still need a country; personas live in ThinkPages rather than IxnayID.
- **Five nations per realm:** a platform default of 5 with a tier-aware cap (`min(realm cap, tier cap)`) tied to one premium definition; decide dividends and achievements per account or per nation (PA §7).
- **Halo plugins** for ThinkPages, Messages, Vault and Maps are missing.
- **WikiOS independence:** a renderer contract (wikios-onoma report). Rendering from Postgres wikitext, native media, the rights model and XML import/export shipped with WikiOS v1 (#52).
- **Ponytail (simplification):** ~21,000 unreachable lines in `src/` (re-measure; some clusters are deleted), 16 duplication patterns with proposed homes, `audit:wiring` broken by the `minimatch: ^3` override, ~19,500 lines in `scripts/archive`.

## 5. Dead schema

From code audit §8 (2026-09-30, 332 models then; 334 after the D9 drop). 57 models had no accessor at all (c15t consent 8,
Exchange 11, diplomacy 7, economy modelling 7, social 5, media player 4, archetypes 3, security/logging 3, maps 5,
cards 3, military 1), 7 are read but never written, and about 16 are written only by the old demo seed. Dropping
them needs backups (done) and decisions D1, D2, D5 and D9. Don't drop the force-structure models (`MilitaryBranch`,
`MilitaryUnit`, `MilitaryAsset`, live since MC-3 closed on 2026-10-06), or models that crisis events would use until
that is decided. `ProceduralWorld`, `WorldTemplate` and `Realm.templateId` are already gone (Atlas and World Studio). **The 13 Exchange
models are off the drop list (D5 decided "build", 2026-10-06):** 9 are in use since the Exchange MVP, and `SectorIndex`,
`SectorIndexHistory`, `SectorPosition` and `CompanyDecision` are kept for its phase 2. `CraftingRecipe` and
`CraftingHistory` are gone. What is left: the read-never-written models (MC-19, AT-15's `SharedVertex`) and
`VitalitySnapshot`, `IntelligenceBriefing` and `IntelligenceRecommendation` (PF§3). The full list is in the
[history copy](../history/roadmap/code-audit-2026-09-30.md#8-dead-schema).

**Drop applied in the schema (2026-10-27, D9):** the 49 models of the 2026-10-06 list still unused on the merged
tree are gone from `prisma/schema/` (with `c15t.prisma` and the `MediaType` enum); the cards refresh and Atlas had
already removed the other seven and `CardPack.pdsConfig`. Production drops the tables during the deploy's
`db:push:force`; the read-only row counts to run first are in
[drop-unused-models.md](../history/operations/drop-unused-models.md). It keeps the Exchange models (D5), the military and
defense models (D2) and every model still read through a relation (for example `Permission`, `GovernmentBranch`,
`EconomicModel`, `ThinktankMessage`).

## Done in 1.5 (2026-10-27)

Removed from the lists above after a re-check against the code and git on 2026-10-27:

- `db:mark-match-revenue-collected` ran after the 1.5 push (2026-10-27): 4,646 completed matches marked collected (SL-14).
- **Deploy rose-garden via the runbook** and **promote rose-garden → development → master** (PL-14, PL-15): PRs #118
  and #119; release 1.5 (public 1.0.0) in production 2026-10-26/27.
- **WikiOS v1 cutover** (D20): launched with live two-way sync with classic MediaWiki.
- **PL-12** the web process under PM2: `ixstats-web` in `ecosystem.config.example.cjs`; `deploy-production.sh`
  reloads it.
- **PF§2** `db.ts` ran `syncAchievements` on import: it now runs from `src/instrumentation-node.ts`.
- **VT-25** `NSImport`, `SyncCheckpoint` and `CardTrade`: gone from the schema. **VT-19** partly: the `pdsConfig`
  column is gone (the seed key remains, above).
- **Crafting models:** `CraftingRecipe` / `CraftingHistory` gone (the "stay until the drop decision" note was stale).
- **PF§5 leftovers:** `post-build.sh` no longer prints `pm2 restart ixstats`; `scripts/start-production.js` is
  deleted (`verify-router-splits.ts` remains, above).
- **PF§2 Vexel attach-to-country:** saving renders a PNG on the server and attach writes it ([vexel.md](../systems/vexel.md)).
- **Margin `deleteComment`:** built and wired (`toggleCommentReaction` remains, above).
- **PF§6 pack seed:** no pack uses the `LIMITED` type any more.
- **D9:** 49 unused Prisma models dropped (§5).
- **Beta feedback (PRs #112–#117):** MyCountry saves, ThinkPages composer/messages/accounts, ThinkTanks, Vault/Wiki
  nav and Trending UI, polar ice caps. None was listed here.
