# Pending Features & Open Work

**Compiled:** 2026-09-29 from a doc-by-doc audit of `docs/`, the `src/**/README.md` files and the in-app help, each
claim checked against the code on `rose-garden`.
**Companion:** [System Status](../systems/SYSTEM_STATUS.md) lists what is live.

Every item here is something a doc promised, planned or assumed that the code does not do today. Items are grouped by
kind, then by system. "Source" points to the doc that describes the intended behaviour.

## Contents

1. [Security findings](#1-security-findings)
2. [Broken or regressed features](#2-broken-or-regressed-features)
3. [Partly built — finish the documented scope](#3-partly-built--finish-the-documented-scope)
4. [Not started — planned features](#4-not-started--planned-features)
5. [Operations & infrastructure](#5-operations--infrastructure)
6. [Code health & tech debt](#6-code-health--tech-debt)
7. [Documentation gaps](#7-documentation-gaps)

---

## 1. Security findings

Fix before the RC2 release. Fixed on 2026-09-29: `achievements.unlock` is admin-only; the Kokoro API key is
masked in the admin config; sports season and simulation procedures require the league's manager;
`scripts/refresh-local-db.sh` reads the role password from `IXSTATS_READONLY_PASSWORD`.

| Item | Where | Detail |
|---|---|---|
| Rotate the read-only DB password | `ixstats_readonly` role (plan 325) | The old password is in git history since 2026-05-31; the script no longer contains it, but the credential itself must be changed on the server |
| CSP nonce not enforced | `src/lib/security/csp.ts`, [deploy runbook](../operations/deploy-rose-garden-2026-09.md) | Waits on removing the nginx/Cloudflare header override |

## 2. Broken or regressed features

| Item | System | Detail |
|---|---|---|
| Follow-up elections never resolve | MyCountry › Politics | Plan 312 deleted `registerCandidate`, `scheduleElection` and `simulateElection`; the cron schedules the next election with no candidates ([elections.md](../systems/elections.md)) |
| Cabinet meetings can't conclude | MyCountry | `completeMeeting` and the decision/implement mutations were deleted (plans 312/332); meetings are schedule-only |
| Crafting fails end to end | Vault | `/vault/crafting` sends card IDs where `CardOwnership` IDs are expected; `successRate` 0–1 vs 0–100; seed uses fields and a `MYTHIC` rarity the schema lacks ([cards.md](../systems/cards.md)) |
| Vexel attach-to-country blanks the coat of arms | Labs › Vexel | Writes an empty `coatOfArms` to `Country` |
| `/mycountry/map-editor` has no surface | MyCountry | The route falls through to the Executive home |
| `/admin/calculations` 404s on reload | Admin | No `page.tsx`; works only via client routing |
| Topic links 404 | ThinkPages | `PostBody.tsx:61` links `/thinkpages/topic/<slug>`, which has no route |
| Premium check disagrees for owners/admins | Premium | Client ability check passes them; `premiumMiddleware` blocks them |
| "Cabinet Research" shown with `STATECRAFT_SPINE` off | MyCountry | The action is visible but the recon spine is disabled by default |
| `db.ts` runs `syncAchievements` on import | Platform | Fires whenever the module loads, including in scripts |
| Defense/Intelligence admin toggles do nothing | Admin › MyCountry | `showDefenseTab` / `showIntelligenceTab` only feed `MyCountrySidebarNav`, which nothing renders; the command bar and mobile menu show both to everyone |
| Auctions filter offers "Mythic" | Vault | Not a `CardRarity` value |
| Diplomatic missions and embassy upgrades removed | MyCountry › Diplomacy | `startMission`, `completeMission`, `upgradeEmbassy`, `allocateBudget` deleted as zero-caller (plan 312); the UI shows "Coming Soon" and help articles still describe them |

## 3. Partly built — finish the documented scope

### MyCountry & simulation
- **Information fog:** mask numeric previews into qualitative bands; governance-competence thresholds (>75% clear, <45% fogged). Source: [design PRDs](../systems/mycountry-design-philosophy-and-prds.md) :39, :449; [game loops](../systems/statecraft/statecraft-game-loops.md) :115.
- **Universal event spine:** diplomacy, defense, elections and meetings bypass it (PRD Rule 6, :374).
- **Issue recon ("SEE"):** enable `STATECRAFT_SPINE` and have recon meetings return minutes/cables (game loops :14).
- **Intelligence:** no dashboard; `/mycountry/intelligence` renders Defense. The 5-tab Intelligence page in [premium-features.md](../reference/premium-features.md) is unbuilt.
- **Crisis events:** taxonomy, lifecycle state machine, player response postures, mutations and an admin UI ([crisis-events.md](../systems/crisis-events.md)). Only `getActive`/`getStatistics` exist.
- **NPC AI:** apply trait drift (no callers); NPC responses for embassies, alliances and treaties; event-fatigue dampening ([npc-ai.md](../systems/npc-ai.md) :41, :54).
- **Relative-development asymmetry:** display-only; feed it into trade maths (vision audit :80).
- **Embassy missions:** not playable.
- **Builder companion guide:** diagnostics tab and subheader deep links ([spec](../superpowers/specs/2026-09-08-builder-unified-companion-guide-design.md) :79).
- **Autosave rollout:** mount the government/tax hooks, add National Identity and Map Editor, a navigation flush (`syncAllNow`) and a shared sync badge ([autosave.md](../architecture/autosave.md)).
- **Reference formulas → live engine:** ERI, embassy synergy, GDP projection; PII is design-only ([calculations.md](../systems/calculations.md)).
- **Delete dead code:** `VitalitySnapshot` (never written) and `src/lib/intelligence/*`.

### Atlas & Realms
- **Map editor inspector** ([2026-09-11 spec](../superpowers/specs/2026-09-11-map-editor-properties-history-deep-overhaul-design.md)):
  - coastline/perimeter/transport-density telemetry, Köppen chip, metric/imperial toggle, WikiOS status chip and thumbnail, Narrative Lore card;
  - geometry actions: Snap to River, Calculate Centroid, Simplify Polygon, Snap Vertices to Cities, Smooth Spline;
  - batch alignment, batch parent assignment, batch delete;
  - optimistic history updates.
- **Topology validation:** cross-country gap/overlap checks on save (only PostGIS validity today).
- **Named rivers/lakes → trade modifiers:** `computeEconomicGeoModifiers` ignores named features.

### WikiOS
- **Export durability:** the MediaWiki export queue is in memory and lost on restart; per-user actor attribution is a no-op.
- **Margin:** `toggleCommentReaction`, `deleteComment`, the Stash tab, and un-hiding the Inspect tab (`WikiMarginDrawer.tsx:157`) ([margin spec](../systems/wikios/wikios-margin-spec.md)).
- **Stash share links:** `?stash=` is never read.
- **Guardian:** mass-blanking and homoglyph abuse filter.
- **Portability:** `transformers/html-transformer.ts` hard-codes `https://ixwiki.com/`.
- **Duplicate routes:** four dynamic pages exist under both `/wiki` and `/util`.

### Vault
- **Packs:** enforce `guaranteedRarity` and `themeFilter`; wire the Keep/List quick actions; add pack artwork and sound assets.
- **NATION cards:** automatic per-country minting (only daily re-pricing exists).
- **Achievements:** background evaluation (today they unlock only when `/achievements` is visited).
- **NS dump sync:** schedule it (admin-triggered today).
- **Premium:** real yield multiplier (`isPremium` hard-coded false in `vault-ledger.ts`); enforce tier limits.

### ThinkPages
- **ThinkTanks Docs:** mount `ThinktankPapersTab` in the workspace.
- **ThinkShare encryption & signatures:** schema fields exist, no cryptography.

### Labs
- **MyLeague:** boxing bout engine (uses the soccer loop); pay the sponsor `winBonus`; Golden Box stage config UI and double elimination; patron-saint MyClub UI and Sports → Storyteller write-back.
- **Onoma:** partial phases 4, 5, 8, 9 ([onoma-roadmap.md](../systems/onoma-roadmap.md)).
- **Vexel:** add to the Labs menu; full external ornaments (crest, mantling, supporters, compartment); Commons charge seed; embedded attribution; autosave; `[id]/preview` route ([vexel-prd.md](../specs/vexel-prd.md)).

### Platform
- **Rate limiting:** cover more than the ~100 of ~960 procedures limited today; `X-RateLimit-*` headers; stats endpoint, metrics and Discord alerts ([rate-limiting.md](../operations/rate-limiting.md)).
- **Admin audit log:** record all mutations, not only `execute` paths and errors.
- **Admin cache:** evict/flush (only `getStats` exists).
- **Help center:** register the unregistered articles and add sections for shipped systems (see §7).

## 4. Not started — planned features

### Realms Phases 2–4 ([realms-framework-spec.md](../architecture/realms-framework-spec.md))
- Public founding application (decisions 6–7)
- Founder tooling: settings, moderation, removing nations, succession; use the recorded `lastSeenAt` (decisions 20–21)
- Archived realms: read-only, excluded from crons and payouts (decision 21)
- Per-realm ThinkPages feed and a global-feed setting (decision 2)
- WikiOS front page as a portal to every realm's lore; realm-tagged forum (decision 3)
- Passport realm/nation switcher and nav chip (decision 22)
- Per-realm calendar label (`yearOffset`)
- Builder prefill from a claimed nation page (Eurth E-f)
- Procedural realm generation (`Realm.seed`, `generationParams`, `templateId`, status `generating` are never written)

### MyCountry statecraft ([design PRDs](../systems/mycountry-design-philosophy-and-prds.md), [game loops](../systems/statecraft/statecraft-game-loops.md))
- Intent DAG with Vision / Strategic / Operational layers, `NationalIntent` / `IntentDependency`, Blocked → Proposed (:274, :318, :333)
- Government-generated Plans A/B/C (Rule 2, :370)
- Deliberation meeting loop (convene → brief → deliberate → commit), 7 meeting categories, participant profiles (:398, :421, :432)
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
- Statecraft directives that change transport network speeds ([route travel-time spec](../superpowers/specs/2026-09-12-route-travel-time-design.md) §5)
- Edge cases never built: tier-transition smoothing, "IMF intervention" recession event, optimistic locking via a `version` column ([edge-cases.md](../reference/edge-cases.md))

### Vault & cards
- Ribbons: Ribbons tab, signature shelf, tab sync ([ribbons spec](../specs/2026-08-10-achievements-ribbons-design.md) §2, §3.2)
- Lore-first schema cleanup: unique slug, `@@unique([wikiArticleTitle, wikiSource])`, drop stats/cardType, `CardRarity` enum ([ixcards spec](../specs/2026-08-13-ixcards-lore-first-rebuild.md) Part III)
- 40/25/20/10/4/1 rarity distribution (Part IV)
- Vault reorder with the Lore Gallery as the primary view and category filters (Phase 6); category-themed packs (Phase 7); seasons and pack composition (open questions)
- Crafting extensions: catalysts, recipe discovery, guilds, bulk crafting, crafting achievements, history/stats/admin endpoints
- Real-time card updates over WebSocket
- Premium: payments/checkout, tiered rate limits, export quotas, history limits, ThinkPages Pro account tiers ([premium-features.md](../reference/premium-features.md))

### ThinkPages
- ThinkTanks group chat ([thinktanks.md](../systems/thinktanks.md) :89)
- Joint working papers

### Labs
- **Onoma** ([roadmap](../systems/onoma-roadmap.md)):
  - vocabulary timeline slider (:114), language family trees (:115);
  - semantic embeddings / TF-IDF (:121), corpus gap recommender (:122);
  - AI Linguist etymology composer and guardrails (:127–128), free-text translator (:147), dialect branch merging (:153);
  - Phase 10 AI agents (:158);
  - platform integration: NPC dynasties, map toponyms, MyCountry demonyms (:175–180).
- **MyLeague / MySports** ([PRD](../specs/myleague-v1-prd.md), [MySports v0](../specs/mysports-v0.md)):
  - AegisCore engine and custom sport DSL; `SportDefinition` adapter;
  - dynasty detection, significance scoring, national leaderboards; market-currency club valuations;
  - promotion/relegation news bulletin;
  - broadcast mode, live speed, persisted speed, momentum graph, `<AthleteCard>`;
  - bid-distribution transfer UI, institutional management, scouting, medical, academy.
- **Vexel:** P1 templates, conflict detection, personal arms, keyboard shortcuts; P2 items 1–10.
- **Strata & Dynas** labs (tectonic relief, dynastic genealogy) — roadmap only.

### Platform & integrations
- Hugging Face Space offload for Whisper and an LLM ([huggingface-spaces-guide.md](../operations/huggingface-spaces-guide.md))
- Browser end-to-end tests (Playwright isn't installed)
- Telemetry opt-out / global discoverability settings: schema flags exist, UI was removed on 2026-08-24, nothing enforces them
- WikiOS Stage 3 MediaWiki isolation: nginx lockdown, 301s, `LocalSettings`, internal `WIKIOS_MEDIAWIKI_API` endpoint; namespace-redirect decisions undecided ([stage3 plan](../systems/wikios/wikios-stage3-config-plan.md))
- WikiOS Workstream C packaging: decouple Clerk, the IxStats DB and templates ([longevity workflow](../systems/wikios/wikios-longevity-workflow.md))
- Lore-card portfolio boosts ([lore-lifecycle.md](../systems/lore-lifecycle.md))

## 5. Operations & infrastructure

- **Postgres backup/restore:** `db:backup` and `db:restore` are stubs; production uses `pg_dump` by hand.
- **`deploy:rollback`:** a v1.2-era script, out of step with the current deploy.
- **Cron:** enable jobs one at a time via `CRON_ENABLED_JOBS` (none run by default).
- **Redis in production** and a rate-limit load test.
- **Drop unused Prisma models** (all of `c15t.prisma` and others): the `chore/drop-unused-prisma-models` branch is unmerged and the migration is operator-gated.
- **AuditLog `target` index:** in the schema, but with no migration.
- **Incident-response runbook:** referenced but missing.
- **Discord bot admin session:** the bot calls `admin.getSystemStatus` (admin-only); the runbook doesn't cover how it authenticates.
- **Leftovers:**
  - `scripts/post-build.sh` prints `pm2 restart ixstats` (no such app).
  - Unwired: `scripts/deployment/deploy-to-production.sh`, `scripts/start-production.js`, `scripts/verify-router-splits.ts`.
  - `scripts/audit/arch-baseline.json` still lists the deleted `labs/design-bible` page.

## 6. Code health & tech debt

From the status blocks in [`docs/audits/`](../audits/):

- **Git-ignored fixtures:** three checks read files CI doesn't have — `next.config.js`, `public/icons/game-icons-manifest.json` and `public/data/vector-seeds/`. They now run only where the file exists (dev machines, the server), so CI doesn't cover them; tracking the assets would restore that coverage.
- **`audit:arch` reports 15 files over their ceiling** (non-blocking in CI) — split them or add them to `RELAXED_FILES`. The 52 source files ≥800 lines are tracked in [src-monolith-candidates.md](../audits/src-monolith-candidates.md).
- **`docs:sync` undercounts procedures:** `extractApiInventory` reports 901 procedures (runtime count 958) because it misses spread and `mergeRouters` routers.
- **Service layer:** 199 router files query `ctx.db` directly.
- **Arch guard coverage:** no pre-commit hook for `audit:arch`; the router-split parity check covers 5 routers.
- **Logging:** 6 `logger.*` calls against ~1,700 `console.*`; decide the framework's fate.
- **Duplication:**
  - atomic government/economy/tax triplicates;
  - 8 remaining rarity palettes;
  - sports simulate/persist and `season-cron.ts`;
  - 27 random-string id helpers;
  - 29 JSON deep copies.
- **Size:** `lib/notifications/hooks.ts` is 1,288 lines; `wikios/templates.ts` holds static data.
- **Design cleanup (plan 346 remainder):** 966 hex colours, 3,972 `dark:` variants, 1,376 blurs, 174 pulses, 180 Sparkles icons; hex inventory classes in [HEX_COLOUR_INVENTORY](../audits/HEX_COLOUR_INVENTORY_2026-09-27.md).
- **Product calls:**
  - deck.gl used in 4 places and tsparticles in 2;
  - `DATABASE_READONLY` replacement;
  - IxTimeSyncManager / AccuracyVerifier;
  - root provider nesting.
- **Stale code comments:**
  - `AdminRouter.tsx:3` ("47 interfaces");
  - `routers/forum/index.ts` (moderation, alerts);
  - `routers/wikios/index.ts` (`search-categories`);
  - `cloudflare-guardian.ts` (Zero-Trust);
  - `useNavigationItems.ts:110` (says Vexel isn't built).
- **Crafting seed:** the `LIMITED` pack type isn't in the `PackType` constant.

## 7. Documentation gaps

- **Help center (see [help.md](../systems/help.md)):**
  - 13 of 54 articles are not in the `helpSections` registry (`src/app/help/_components/HelpExplorer.tsx`): `defense/*` (6), `diplomacy/scenarios`, `economy/modeling`, `government/synergy`, and `intelligence/{executive-operations,forecasting,strategic-intelligence,unified-overview}`. Register or delete them; `strategic-intelligence` and `unified-overview` have no inbound links at all. Add a `systems` filter and refresh stale hub descriptions (Embassies, Intel).
  - Shipped systems with no article:
    - Realms, nation claims (`/setup`) and `/r/[realm]`; the passport and verified wiki accounts;
    - Atlas `/maps` and the map editor; WikiOS, the Canvas editor and Lorewards; Stash; Forum;
    - MyCountry → Economy & Budget; how to get Premium;
    - MyLeague/MyClub; Onoma;
    - ribbons and the showcase shelf; Vault import, crafting and shop items;
    - the activity feed, Blurbs, hashtags, Explore/country profiles; the Halo command palette; Settings.
  - Articles now carry "Preview feature" / "Not available yet" notes for Intelligence, Defense (Premium), diplomatic missions and crisis responses; remove them as those features land.
- **Docs that still overpromise gating:** some `docs/systems/*` text describes Defense and Intelligence as "developer preview, gated from public nav"; in code they are premium-gated and visible to everyone (see §2).
- **Docs to archive once their work closes:**

  | Doc | When |
  |---|---|
  | [realms-foundation](../superpowers/specs/2026-09-27-realms-foundation-design.md), [realms-eurth](../superpowers/specs/2026-09-28-realms-eurth-design.md), [route-travel-time](../superpowers/specs/2026-09-12-route-travel-time-design.md) specs | implemented |
  | [map-editor-improvements-overview](../systems/map-editor-improvements-overview.md) | historical |
  | [myleague-v1-prd](../specs/myleague-v1-prd.md), [myleague-top5-features](../systems/myleague-top5-features.md), [sports-llm-commentary](../research/sports-llm-commentary.md) | implemented |
  | [myleague-lore-integration](../systems/myleague-lore-integration.md) | mostly obsolete |
  | [mycountry-vision-audit](../systems/statecraft/mycountry-vision-audit.md) | dated snapshot |
  | [wikios-longevity-workflow](../systems/wikios/wikios-longevity-workflow.md) | round complete |
  | [wikios-independence-2b-3](../systems/wikios/wikios-independence-2b-3.md) | after the Stage 3 cutover |
  | [user-profile-utils](../reference/user-profile-utils.md) | module deleted |
  | [REFACTOR_PLAN_2026-06](../audits/REFACTOR_PLAN_2026-06.md), [test-suite-audit](../audits/test-suite-audit-and-justification.md) | all items resolved |
  | [deploy-rose-garden-2026-09](../operations/deploy-rose-garden-2026-09.md) | after the release ships |

  `docs/archive/` is git-ignored, so archiving there removes a file from the repository. Use a tracked archive folder
  or keep the file with its status line.
- **Trim:**
  - [rate-limiting.md](../operations/rate-limiting.md) (~1,350 lines, mostly sketches);
  - [refactoring.md](../processes/refactoring.md) (~1,000 lines of generic guidance);
  - the Vercel/Netlify/Docker sections of [deployment-checklist.md](../operations/deployment-checklist.md).
