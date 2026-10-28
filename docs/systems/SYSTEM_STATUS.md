# IxStates System Status

**Platform:** 1.5.0 "Lobster Crosby" internal (`INTERNAL_VERSIONS.platform`), deployed to production at https://beta.ixwiki.com; public version 1.0.0 "Lobster Crosby", Stable (`VERSIONS.platform`)
**Last verified:** 2026-10-27, after release 1.5.0 reached production (platform line, WikiOS, IxWorld, ThinkPages accounts, cron and help rows). Earlier passes: 2026-10-05, against the code at `rose-garden` @ `6d53b0c` (after PRs #48–#49 and the 2026-10-05 docs audit); the Vault, Lorewards and Exchange rows were updated on 2026-10-14 for the collectathon hub release, and the card rows on 2026-10-17 for the cards hub, and the WikiOS rows on 2026-10-25 for native lore and the WikiOS launch hardening (Workstreams A to D of [the launch hardening spec](../history/specs/2026-10-24-wikios-launch-hardening-design.md))
**Version registry:** [`src/lib/buildVersion.ts`](../../src/lib/buildVersion.ts) (the Version column below gives the internal numbers, `INTERNAL_VERSIONS`; the public registry `VERSIONS`, which the exported `*_VERSION` constants and every user-facing surface read, shows every app, system and design number as v1; engines are the same in both) · **Versioning spec:** [`docs/reference/revision.md`](../reference/revision.md)
**Open work:** [`ROADMAP.md`](../roadmap/ROADMAP.md) (the plan) · [`pending-features.md`](../history/roadmap/pending-features.md) · [`code-audit-2026-09-30.md`](../history/roadmap/code-audit-2026-09-30.md)

This page replaces the August "Gold Master (100%)" matrix. That matrix rated every system as finished; the September audit
found several that are partly built, read-only, or broken, so each row now carries the status the code supports.

## Status key

| Label | Meaning |
| :--- | :--- |
| ✅ **Live** | Shipped, wired into navigation, works end to end |
| 🟡 **Partial** | Shipped, but documented scope is missing or a loop is broken (see Notes) |
| 🔒 **Premium** | Live, gated to premium accounts |
| 🧪 **Labs** | Experimental; reachable under `/labs/<tool>` or a standalone route (there is no `/labs` index page) |
| ⛔ **Not built** | Designed or documented only |
| 💤 **Retired** | Switched off on purpose; data kept, every call refuses |
| ⏸️ **Deferred** | Built and merged, held back from the current launch on purpose; nothing turns it on by default |

---

## 🏛️ MyCountry — executive simulation

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Command Surface | UI v6 | `/mycountry`, `/mycountry/{executive,economy,politics,diplomacy}` | `mycountry/`, `quickactions/`; `components/mycountry/shell/` | ✅ Live | Overview/Executive, Economy, Politics and Diplomacy are open to every player |
| Directives (Intent) | engine v4 | `/mycountry` | `intent.ts`, `src/lib/intent/`, `src/lib/statecraft/` | ✅ Live | Flat intent tree; 3 per IxTime week plus cooldown. Economy and infrastructure directives add a phased GDP level effect; defense raises stability. Directives consume executive bandwidth while active (or one IxTime week). Intent DAG and layers not built |
| National Issues & 4-branch brief | engine v4 | `/mycountry` | `national-issues/`, `src/lib/national-issues/` | ✅ Live | GDP and population consequences become phased `StorytellerEffect` level effects (±3% / ±1% caps); approval and stability consequences persist and survive recalculation. Recon ("SEE") sits behind `STATECRAFT_SPINE`, off by default |
| Information fog | — | policy creator | `PolicyReconBanner.tsx` | 🟡 Partial | Warnings only; numbers are not masked into bands |
| Cabinet meetings | — | `/mycountry` agenda | `meetings/`, `quickactions/meetings.ts` | 🟡 Partial | Schedule-only; outcome and decision mutations were deleted (plans 312/332) |
| Event spine / canon feed | — | `/mycountry` | `src/lib/activity/event-spine.ts` | 🟡 Partial | Directives and issues write to it; diplomacy, defense, elections and meetings bypass it |
| Economy & fiscal policy | — | `/mycountry/economy` | `economics/`, `taxSystem/`, `src/lib/economy/`, `src/lib/government/` | 🟡 Partial | The `stat-progression` cron (off until enabled) persists the projection into stored `current*` stats and writes monthly history; tax sliders still do not feed GDP growth |
| Politics: parties, legislature, bills, brokers | — | `/mycountry/politics` | `elections/`, `legislation.ts` | ✅ Live | First election is scheduled once a legislature and 2+ parties exist; results seat parties and bills pass through whip/legislative-vote. Needs the `elections` cron (or the owner's Count votes button) |
| Elections | — | `/mycountry/politics` | `elections/`, `src/lib/government/election-simulation.ts` | ✅ Live | First, follow-up and snap elections are created, get candidates from active parties, and resolve (cron or Count votes). Non-elected chambers are still seated by the vote simulation |
| Diplomacy | — | `/mycountry/diplomacy` | `diplomacy/`, `diplomaticScenarios/` | 🟡 Partial | Embassies, alliances, cultural exchange, stances with drift cron. Diplomacy Inbox: accept/decline FP proposals and alliance invites, withdraw, 14-day expiry, notifications. Diplomatic Standing is computed from the real record. Embassy missions are not playable, and NPC targets never answer alliance invites |
| Defense | — | `/mycountry/defense` (also serves `/mycountry/intelligence`) | `security/`, `militaryEquipment/` | 🔒 Premium | |
| Intelligence | — | — | `intelligence/` (templates, alerts) | 🟡 Partial | No standalone dashboard; threshold alerts are read on the MyCountry overview. The old stack was deleted in plans 312/341 |
| Map editor section | — | `/mycountry/map-editor` | `app/mycountry/map-editor/page.tsx` | ✅ Live | Free for every owner. The route renders the map editor full-screen; the shell's `map-editor` section navigates there |
| Country Builder | v4 | `/builder`, `/mycountry/welcome`, `/mycountry/editor` | `builderDraft.ts`, `countries/` (`management/create.ts`, `editor.ts`), `src/server/shared/founding-snapshot.ts` | ✅ Live | Founding in five steps (plus Realm) with a live nation card from the same calculation as founding, wiki import, welcome and First steps; the editor saves per section with stale-tab checks |

## 🌍 Atlas & Realms — geography and worlds

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Interactive map | IxWorld v3 | `/maps` (`?realm=`) | `geo/core/`, `geo/sovereignty.ts`, `countryGeo.ts` | ✅ Live | MapLibre 6 globe; realm-scoped layers. maps.ixwiki.com is this page of the main app (nginx sends it to `ixstats-web` on :3550, every other path 301s to beta.ixwiki.com); there is no separate IxWorld build. Geometry layers come from the versioned `/api/map-layers` route and altitudes, rivers and lakes from cached vector tiles (next row) |
| Map editor | IxWorld v3 | in place on `/maps`; world editor at `/admin/maps/editor` | `geo/editor/`, `geo/admin/` | 🟡 Partial | Border/coast/river snapping and history ship; the Stories tab creates storylines (AT-14); the 2026-09-11 inspector spec is only partly built; no cross-country gap/overlap validation. Atlas R0: a border vertex drag costs 2.0 ms of JS per frame on Caphiria (p95 after warm-up in one benchmark run; the first frame of the drag took 4.5 ms), autosave stores 154 KB after 50 drags and offers Restore or Discard, region reshape checks overlaps once, when the browser is idle after mouse-up (none of it in the release frame; the check took 66 ms in that run) |
| Map delivery (Atlas R0) | Atlas R0 | `/api/map-layers/<realm>/<version>/<layer>`, `/api/map-tiles/<realm>/<version>/f<format>/<layer>/<z>/<x>/<y>` | `src/server/modules/maps/` (`layer-delivery.ts`, `coverage-simplify.ts`, `tile-cache.ts`, `tile-prerender.ts`, `tile-render.ts`), `src/server/shared/map-invalidation.ts` | ✅ Live | `Realm.mapVersion` in every URL; packed layers in a 256 MB byte-bounded cache (`immutable` for Ixnay and published realms, `private, no-store` for unpublished); tiles on disk under `MAP_TILE_DIR`; political layer simplified as one coverage in PostGIS. `bun run perf:atlas` on the local clone, one run on 2026-10-12: the 14 targets it gates pass (layer hit 8.53 ms max, tile hit 0 queries and 1.69 ms max, the reshape release frame 0 ms of overlap work). Ops, not done by the code: apply `prisma/migrations/20261021120000_atlas_r0/migration.sql`, set one `MAP_TILE_DIR` (outside the repository and `data/`) for the two processes that serve or render tiles (the web app, which also serves maps.ixwiki.com, and `ixstats-cron`), add `map-tiles` to `CRON_ENABLED_JOBS` |
| Geo profiles | Atlas R0 | `/maps` country panel, `/mycountry` geography | `geo/core/geo-profile.ts`, `geo/core/profile-job.ts` | ✅ Live | Queries on `geom_postgis`: `getCountryGeoProfile` for Caphiria took 294 ms warm in one benchmark run (limit 400 ms), cached 1 h. `geoCore.recalculateGeoProfiles` only queues; the `geo-profiles` cron job (`CRON_ENABLED_JOBS`) recomputes one country at a time |
| Map import (PNG/SVG/GeoJSON) | Atlas v5 | Atlas → Import a map; realm Manage → Map import | `geoEditor.mapImport`, `src/lib/maps/import/`, `src/server/modules/maps/map-import.*` | ✅ Live | A realm's political map from a flat-colour image, an SVG of nations or GeoJSON, with dry run, apply and rollback. The layered Inkscape SVG pipeline, Quick Update, the per-layer SVG uploader and the procedural source were removed in the Atlas and World Studio overhaul (`runPipeline`, `importPipelineResult`, `processSvgUpload` and their kin are gone) |
| Worldgen (UPG v2) | Atlas RA | `/maps?realm=<slug>&editor=world` (World tab) | `src/lib/worldgen/`, `src/server/modules/maps/world-import*.ts`, `geoEditor.mapImport` (kind `world`), `realms.map.worldStatus`, `realms.map.worldPresets` | ✅ Live | Founders and `map` officers of any realm except Ixnay generate in a Web Worker (a published preset, or their own map with the missing layers generated to fit), preview, and apply through a `world` map import job: physical layers plus nation slots (`Country.worldgen`, `claimable`) with a derived baseline. Regeneration and apply are blocked while a claim is pending or approved. The generator is staged: a changed field restarts at the first stage that reads it. No cities, named rivers or lakes, labels or provinces. `bun run perf:atlas` on the local clone, one run on 2026-10-12: first generation 874 ms and reroll 687 ms at 66,626 cells (limits 1000 and 900 ms), restarts at mesh 593, land 307, climate 139, nations 76 and output 64 ms (limits 1000, 600, 250, 250, 200 ms). Ops, not done by the code: apply `prisma/migrations/20261022120000_atlas_ra/migration.sql` (the deploy script does), then build Ixnay's and Eurth's relief once with `bun scripts/realms/build-realm-map.ts --realm <ixnay|eurth> --steps relief --apply` |
| Atlas (admin) | Atlas | `/admin/maps`, `/admin/maps/realms/<slug>` | `atlas` router (`studio`, `presets`, `jobs`, `realms`, `health`), `src/server/modules/maps/atlas-*.ts`, `src/app/admin/maps/_components/atlas/` | ✅ Live | The admin home for every realm's map, site admins only: a health strip (jobs, storage, last cron runs), tabs Realms (layers, relief, linkage, nations, claims, last job, problem flags), Jobs (every map import job with cancel, retry and roll back), Edit queue and Map style; a realm page with figures, recent jobs, open in editor or Studio, rebuild relief, run steps, roll back and refresh caches. Replaces the Atlas world map page, the SVG pipeline and the Settings tab |
| World Studio | Atlas | `/admin/maps/studio` (full screen, site admins) | `src/components/maps/studio/`, `src/lib/worldgen/` (`v2/stages.ts`, `measure-world.ts`, `diagnostics.ts`, `render-png.ts`, `zip-store.ts`), `atlas.studio`, `atlas.presets` | ✅ Live | Every generator parameter by stage, automatic regeneration from the changed stage, diagnostic layers, live calibration against any realm's stored map (cached by map version), presets in the database (draft, publish, versions, reset to factory; founders see only published ones), GeoJSON zip and PNG export, apply to a realm (Ixnay only with ticked physical layers) and new realm from a world. Ops, not done by the code: apply `prisma/migrations/20261023120000_atlas_studio/migration.sql` BEFORE `db push` (the deploy script and dev startup do); it drops `procedural_worlds`, `world_templates` and `realms.templateId` |
| Relief (Atlas RA) | Atlas RA | raster layer `relief` on `/maps`; `/api/map-rasters/<realm>/relief/<version>/<z>/<x>/<y>` | `src/server/modules/maps/realm-relief*.ts`, `src/lib/worldgen/relief.ts` | ✅ Live | Hillshade tiles z0 to 5 (lossy WebP, transparent tiles skipped, about 500 to 740 tiles and 3 MB) for generated worlds (built after the apply; **Rebuild relief** in the World tab) and for any realm with stored altitude bands (`build-realm-map.ts --steps relief`, no stored pipeline needed; a realm with none is reported as skipped) |
| Routes & travel time | — | `/maps` | `transport/`, `src/lib/economy/travel-time.ts` | ✅ Live | Sea routes use currents and wind; directive-driven network speeds not built |
| Realms Phase 1 + Eurth | — | `/r/[realm]`, `/admin/realms` | `realms/`, `src/server/modules/realms/` | ✅ Live | Ownership, verified-creator claims, realm-scoped listings, lore index. Merged 2026-09-29 |
| Realms Phases 2–4 | — | — | — | 🟡 Partial | Built: per-realm feed filter, realm boards (`/thinkpages/r/[realm]`, the forum's live board), `/realms` directory, realm-aware builder, tier-aware nation cap, nation switcher. Not built: founding applications, founder tooling, archived realms. Realm world generation is the Worldgen row |

## 📖 WikiOS — lore platform

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Native lore engine | WikiOS v1 | `/wiki/*`, `/util/*` | `wikios/`, `src/lib/wiki-os/` | ✅ Live | Live with release 1.5 at https://beta.ixwiki.com (no base path), `WIKIOS_V1_ENABLED=true`; 23,518 pages imported from classic MediaWiki, which stays at ixwiki.com/wiki, public and editable, with canonical and share URLs on classic. PostgreSQL store; rendering, templates and Lua come from a private MediaWiki engine on `127.0.0.1:8081` (`scripts/ops/nginx/wikios-render-internal.conf`). Two-way sync: classic saves arrive through the MediaWiki save webhook (`/api/wiki/sync-webhook`) plus the `wiki-recentchanges` job every 10 minutes; WikiOS edits mirror to classic through the `wiki-mirror` job as the `WikiOSMirror` bot. When both wikis change a page, the last writer wins on both and the overwritten editor is always told (`services/conflict-rule.ts`). Classic is the authority for blocks, user groups and `MediaWiki:` messages ([WIKIOS.md](wikios/WIKIOS.md#launch-shape-and-modes), [operations](wikios/operations.md), [launch runbook](../history/operations/wikios-v1-cutover.md)) |
| Native lore pieces | — | `/countries/[slug]/lore` | `countryLore.ts`, `src/server/modules/lore/`, `components/country-profile/lore/` | 🟡 Built, writing off | A country's people, places, events and organisations as ordinary wiki pages, written from the country page by the owner and a lore team, listed on the Lore tab by `Category:<Country> lore` with owner pins and hides ([explore-and-country-profiles.md](explore-and-country-profiles.md#native-lore)). Built on `rose-garden` (2026-10-25). Reading is on once deployed: pages already in `Category:<Country> lore` show on the Lore tab. Writing (entry points, curation, lore team) follows WikiOS editing, so it launches with WikiOS v1. Needs the `country_lore` SQL (runbook on that page) |
| Multi-wiki reading | — | `/wiki/[slug]?source=` | `wikios/`, `src/lib/wiki-os/upstream-guard.ts`, `src/lib/utils/sanitize-sister-html.ts` | 🟡 Partial | Other wikis' pages (iiwiki, AltHistory) are read-only. Built on `rose-garden` (2026-10-25): links to them open in the reader with `?source=` (rendered articles, the composer, Discord, admin link tools, media search), hover previews, a per-host breaker and limiter, a typed "could not be reached" answer instead of an empty one, and one sanitizer for their HTML. Classic shows `{{Sister}}` as a link box (runbook step 3d); WikiOS shows it as a live embed of the page (cached about an hour, up to ten a page, the rest stay link boxes) ([WIKIOS.md](wikios/WIKIOS.md#sister-wikis)) |
| Canvas editor (Plate) | Canvas v1 | `/wiki/<title>?action=edit` | `wikios/editing.ts`, `components/wiki-os/editor/plate/` | ✅ Live | WikiAST, slash menu, TemplateData forms |
| MediaWiki export | — | — | `services/mirror-worker.ts` (+ `mirror-outbox.ts`, `mirror-queue.ts`) | ✅ Live | Durable outbox (`wiki_mirror_jobs`), per-title FIFO, backoff and dead letter; revisions imported with the real author (plan 407) |
| Margin | — | `/wiki/*?margin` | `components/wiki-os/margin/` | 🟡 Partial | No comment reactions or deletion; no Stash tab |
| Stash | v1 | `/stashes` | `wikios/stash.ts`, `forum/stash.ts` | 🟡 Partial | Share links are not read. Also written by forum, Onoma and the media editor |
| Lorewards & article awards | Achievements v3 | `/util/lorewards`, `/vault/achievements` (Lorewards tab) | `lorewards/` | ✅ Live | One `LorewardsView` in WikiOS and the Vault; tiered payouts and trophy cards. Weekly and monthly runner-ups are not recorded, so only recorded places pay or mint ([achievements.md](achievements.md#lorewards)) |
| Repository (Commons) | v2 | `/util/repository` | `commons.ts` | ✅ Live | |
| Guardian | — | — | `guardian/cloudflare-guardian.ts` | 🟡 Partial | No CAPTCHA (Turnstile removed, plan 416: edits are rate-limited and rights-checked); no abuse filter |
| WikiOS standalone takeover of `/wiki/*` (replaces Stage 3) | — | `/wiki/*` | `scripts/deploy-wikios.sh`, `scripts/ops/nginx/wikios-takeover.conf`, `scripts/ops/mediawiki/wikios-localsettings.php`, `src/lib/system/wikios-standalone.ts` | ⏸️ Deferred | Kit merged with WikiOS v1 (2026-10-06), nothing applied on the server. The launch keeps ixwiki.com classic (owner, 2026-10-24). Its MediaWiki parts (the `/classic/` article path, the canonical hook) apply only with `define( 'WIKIOS_TAKEOVER', true )`, which nothing in the launch sets; its steps are the deferred section of the [launch runbook](../history/operations/wikios-v1-cutover.md) |
| Gold proof and gates | — | — | `scripts/audit/wikios-proof.ts`, `scripts/lib/wikios-proof-gate.ts`, `scripts/audit/wikios-proof-thresholds.json`, `src/server/cron/wikios-proof-cron.ts` | 🟡 Local proof passed, launch run pending | One CLI runs the three harnesses (editor round trip, render parity against MediaWiki, bench) under a profile and checks them against the thresholds file. The weekly `wikios-proof` job (Monday 05:30 UTC, off until named in `CRON_ENABLED_JOBS`) runs it on the server; `deploy-production.sh` runs its `predeploy` check before every deploy and refuses a release whose WikiOS code has no committed passing proof (`WIKIOS_PROOF_OVERRIDE=1` deploys anyway). Local proof (2026-10-27, commit `528f6b69c`): round trip 12,706 of 12,706 pages byte-identical (100%); parity over 497 sampled pages at the revision WikiOS holds, 99.8% at 98 or more, mean 99.97, none below 70; bench: launch run pending (dev server numbers are reference only) ([`docs/audits/wikios-proof/`](../audits/wikios-proof/README.md)) |

## 💎 Vault — wallet, cards, achievements, store

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxCredits ledger & Wallet | IxVault v3 | `/vault` | `vault/`, `src/lib/vault/` | 🟡 Partial | Bank-statement Wallet page; the nightly Vault dividend (`vault-dividend` job, off until named in `CRON_ENABLED_JOBS`) replaced the country dividend; daily streak, `EARN_BONUS`. No country action pays IxCredits. Pack purchases (`SPEND_PACKS`) and the lore token refunds (`REFUND`) go through the ledger; lore card suggestions are free |
| Cards | IxVault v3 | `/vault/cards/mine`, `/vault/cards/sets`, `/vault/cards/explore`, `/admin/cards` | `cards/`, `lore-cards/`, `src/lib/cards/hub/`, `src/server/modules/cards/` | ✅ Live | 5 card types; Loreward trophy cards. One card face, back and sheet; the hub's Mine, Sets (showcases) and Explore (realm shelves, every card's art, uncollected cards marked) ([cards.md](cards.md#the-hub)). Imports from IxWiki, IIWiki, AltHistory and Commons run as server-side jobs and wait in review; the nine-tab admin is `cards.admin.*` ([cards.md](cards.md#cards-admin)). The card economy ([cards.md](cards.md#card-economy)): finishes and fusion, dust per realm and crafting, copy levels with a daily XP cap (`card-holding-xp` job), signing copies with inscription reports, and one value formula whose market medians and reference values the `card-values` job writes every 6 h (off until named in `CRON_ENABLED_JOBS`). NATION cards are not auto-minted |
| Pack store & opening | IxVault v3 | `/vault/store?view=packs` | `card-packs/` | 🟡 Partial | Each pack shows its odds; one short reveal (tap, swipe or arrow keys; Escape reveals all). `guaranteedRarity`, `themeFilter` and the pack's card type are enforced at open; a pack never falls back to another rarity: while a rarity it shows has no card it is not sold, and a bought one stays unopened ([cards.md](cards.md#packs-and-the-reveal)) |
| Market: listings, auctions & trading | IxVault v3 | `/vault/cards/market` | `card-market/`, `trading/` | 🟡 Partial | Fixed-price listings, auctions of 24 h to 7 days, the wishlist, and the two-column trade builder with counters in place; the market fee on sales and trade IxC, with the nation royalty out of it. Escrow-locked, but settlement (auction completion, listing expiry, trade expiry) runs only through crons that are off unless listed in `CRON_ENABLED_JOBS` |
| The Exchange (₷) | — | `/labs/exchange` (Labs-gated; the Vault's old address redirects) | `exchange/`, `src/lib/exchange/` | 🟡 MVP + phase 2 | Sovereign wallet (conditional, idempotent spends; the IxC ⇄ ₷ conversion was removed), companies, B2B contracts and B2G tenders with escrow and admin dispute decisions, a fixed-price share market with dividends, sector indices with zero-sum sector funds, company decisions, notifications; on by default behind `vault_isExchangeEnabled`. Jobs `exchange-market` and `exchange-contract-expiry` are off until named in `CRON_ENABLED_JOBS` ([exchange.md](exchange.md)) |
| Card workshop (crafting) | IxVault v3 | the card sheet and Mine (the old crafting page redirects to Mine) | `crafting/`, `src/server/modules/cards/workshop/` | ✅ Live | Break down for dust per realm, fuse duplicates into Foil and Holo, craft cards up to Epic for dust plus IxC ([cards.md](cards.md#dust-and-crafting)). The old recipe crafting was removed in Phase 1 |
| NationStates import | — | `/vault/import` | `ns-import/` | ✅ Live | Dump sync is admin-triggered |
| Achievements | v3 | `/vault/achievements`, `/leaderboards` | `achievements/` | ✅ Live | 114 active and 47 Legacy definitions (`sets/`); account-level achievements work without a country; background evaluation via event hooks and the `achievements-evaluate` cron. Ribbons are derived from unlocks and shown on the passport and country pages |
| Premium tiers | — | — | `premiumProcedure`, `PremiumPreviewFrame` | 🟡 Partial | Only Defense and 10 security procedures are gated; no payments |

## 💬 ThinkPages — social

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Feed | ThinkPages v3 | `/dashboard`, `/dashboard/post/[id]`, `/dashboard/profile/[username]`, `/dashboard/saved`, `/hashtags/[tag]` | `thinkpages/`, `polls/` | ✅ Live | `[blurb:slug]` is a Blurbs cross-post prefix. Trending and "hot" are scored by the `thinkpages-trending` cron (off until enabled); a realm filter scopes the feed to one realm |
| Accounts (personas) | ThinkPages v3 | `/dashboard/accounts` | `thinkpages/accounts.ts` | 🟡 Partial | 25 accounts per user (admin setting) plus one personal persona ("post as yourself", no country); four country types capped per country: citizen 17, government 5, media 10, corporate 10 (corporate personas for companies and brands); unclaimed IxTwitter-imported handles can be claimed by creating a persona with that name ([social.md](social.md#2-account-manager--discord-bridge)); persona follows with real counts. The Discord mirror is off by default and cannot be enabled from the UI; the verified flag is admin-only |
| ThinkTanks | ThinkPages v3 | `/thinktanks` | `thinkpages/thinktanks/` | 🟡 Partial | Feed, Members, Docs and Chat tabs; invites by username search, an invite inbox and single-use invite codes; the older realm boards are a ThinkTank type (a realm's page now shows the forum's live board) |
| Forum (ThinkPages) | — | `/thinkpages`, `/thinkpages/c/[key]`, `/thinkpages/r/[realm]`, `/thinkpages/r/[realm]/[key]`, `/thinkpages/t/[threadId]`, `/thinkpages/mod` | `thinkpagesForum/`, `thinkpagesForumMod` | 🟡 Partial | Sitewide boards and a section per realm (its landing page is the realm's live board), reports, warnings, bans, appeals and a moderation log. The XenForo import tooling was retired on 2026-10-21 ([runbook, in history](../history/operations/forum-xenforo-import-runbook.md)). The XenForo bridge is retired and `/forum/*` is a 404 (IxForum row, below) |
| ThinkShare messages | ThinkPages v3 | `/messages` | `messages/` | 🟡 Partial | Live for 1:1 and group DMs over `/ws/thinkpages`, with message requests, "Seen" and online status (SL-4); diplomatic conversation creation from the UI is unreachable, joining a thinktank-linked conversation requires active membership of that group, and encryption fields exist but no cryptography |
| Blurbs | — | `/blurbs` | `blurbs/` | ✅ Live | |

## 🗨️ Forum & identity

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxForum (XenForo bridge) | platform | — (`/forum/*` is a 404) | — | ⛔ Retired | Bridge deleted in ThinkPages forum phase 4b; its `/forum/*` redirects deleted in phase 5 |
| Passport | — | `/@user`, `/id/[username]`, `/r/[realm]/@user` | `src/server/modules/identity/` | ✅ Live | Five tabs plus a showcase (achievements, pinned ribbons, top cards, Lorewards). Privacy settings are persisted and enforced server-side; nation switcher for multi-nation owners |
| Old IxWiki names (name claims) | — | `/settings`, `/admin/users` | `identity.name-claims.ts`, `src/lib/identity/wiki-names.ts` | ✅ Live | A player asks for an old IxWiki name and an administrator approves it, or links it directly; one resolver answers who a wiki name is. WikiOS edits are signed with the passport handle |
| Sister wiki accounts | — | `/settings` | `identity.wiki-links.ts` | ✅ Live | Token saved to the user page on iiwiki or althistory; IxWiki is no longer linked |

## ⚙️ Concord — living world

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxTime | platform (grouped under Concord in docs) | platform | `src/lib/ixtime/`, `/api/ixtime/sync-from-bot` | ✅ Live | Discord bot is the source of truth; continuous across multiplier changes |
| Crisis events | Concord v2 | — | `crisis-events.ts` | 🟡 Partial | Read-only (`getActive`, `getStatistics`); nothing writes `CrisisEvent` rows now that the demo seed is gone. The one working event producer is the admin world-events (Storyteller) tool at `/admin/storyteller` (`admin/worldEvents.ts`), which writes `WorldEvent` and `StorytellerEffect` rows |
| NPC personalities | Concord v2 | `/admin/npc-personalities` | `npcPersonalities/`, `src/lib/diplomacy/npc-personality.ts` | 🟡 Partial | Traits drive cultural-exchange responses only; drift has no callers; no event fatigue |
| Cron | — | — | `cron-runner.mjs`, `src/server/cron/jobs.ts` | ✅ Live | 36 jobs ([events.md](../reference/events.md#scheduled--batch-jobs)); none run unless listed in `CRON_ENABLED_JOBS`. Each run takes a lease row (`job_leases`), is recorded as a `CronRun` row and alerts Discord on failure; `/api/health` shows the last run per job |

## 🎨 Design, Halo & admin

| Subsystem | Version | Routes | Code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Facet design system | v4 | global | `src/styles/facet/`, `src/components/ui/facet*` | ✅ Live | Five layers and the sidebar shell are in; the per-app sweep is in progress ([facet-design-system.md](../reference/facet-design-system.md)) |
| Halo overlay & command palette | v6 | global | `src/components/halo/` | ✅ Live | |
| Cuelume audio | v1 | global | `src/lib/sound/cuelume.ts` | ✅ Live | 17 synthesized cues |
| Admin console | platform | `/admin/*` | `admin/`, `AdminRouter.tsx` | ✅ Live | The sidebar's area list is the admin navigation; `/admin/calculations` has a page; `auditLogMiddleware` persists every admin mutation and failed call to `AuditLog` (PL-1) |
| Help center | platform | `/help` | `src/content/help/`, `src/app/help/_lib/help-sections.ts` | ✅ Live | All 69 articles are registered (a test checks it); see [help.md](help.md) |
| Rate limiting | platform | — | `src/lib/cache/rate-limiter.ts`, `trpc/middleware.ts` | 🟡 Partial | Fewer than 100 non-admin procedures of 922 are limited; 243 mutations are unlimited; no `X-RateLimit-*` headers |

## 🧪 Labs

| Tool | Version | Routes | Routers | Status | Notes |
|---|:---:|---|---|:---:|---|
| Onoma | v4 | `/labs/onoma` | `onoma/`, `/api/onoma/tts` | 🧪 Labs | Roadmap phases 1–3 and 7 done; 4, 5, 8, 9 partial; 6 and 10 not started. Kokoro read-aloud (`/api/onoma/tts`) is restricted to owners, admins and beta testers; everyone else gets browser Web Speech |
| MyLeague & MyClub | platform | `/myleague`, `/myclub` | `sports/` | 🧪 Labs | 7 sport presets; boxing reuses the soccer loop |
| Vexel heraldry | — | `/labs/vexel` | `heraldry/` | 🧪 Labs | P0 mostly built; not in the Labs menu; attach-to-country blanks the coat of arms |

---

## Known blockers on `rose-garden`

Updated 2026-10-26, after the pre-production audit fixes (`claude/preprod-audit-fixes`), before release 1.5 was
deployed; not re-checked on 2026-10-27, so some ops items below may have been done during the release.

**Fixed on this branch:**

- **The architecture guard is green and blocking again.** The oversized files were split (`intent.ts`,
  `security/conflicts.ts`, `EventWizard.tsx`, `IssueDetailBrief.tsx`, `ixtime/core.ts` and three components grown past
  their baseline), and `bun run audit:arch` passes. In CI it is an ordinary blocking step.
- **CI runs every gate.** The job used to stop at the first red step, so lint, the typechecks and the docs check had not
  run for seven pushes. Every gate after the unit tests now runs whenever setup succeeded, and the job fails if any of
  them fails. A new step typechecks `tsconfig.json`, the config `next build` checks, so a build-breaking type error the
  partitioned configs miss cannot land unseen.
- **The deploy.** A failed deploy keeps the live site serving: nothing touches `.next` before the build, the build
  moves it to `.next.prev` and puts it back on failure, and `bun run clean` is gone. An additive schema step breaks the
  cycle between the hand SQL and `db push`; the Realms drop and all twelve forum files run before the push; cron and the
  websockets run the commit the web app was built from (there is no separate IxWorld build: maps.ixwiki.com is the
  app's `/maps` page); the web app can run under PM2 (`ixstats-web`);
  old servers get `SIGTERM`, then `SIGKILL` after 30 seconds; `f-defense.sql` survives D2a; the legacy notification
  links are rewritten once the new server answers; a rollback never pushes an older schema. See the
  [release guide](../operations/release-guide.md#a4-build-and-deploy).

**Still open, code:** rate limits on the remaining protected mutations, and removing the nginx CSP override (the nonce
itself is fixed; [release guide, CSP](../operations/release-guide.md#csp-the-apps-header-then-unsafe-inline)). Plan:
[ROADMAP, next](../roadmap/ROADMAP.md#next-server-rebuild-and-ops-10x).

**Still open, ops work** (owner; the [release guide's open operations items](../operations/release-guide.md#open-operations-items)
lists them):

- **Rotate the `ixstats_readonly` Postgres password** (plan 325): the old one is in git history since 2026-05-31.
  The script no longer contains it.
- **Run `db:backup` and test a restore** into a scratch database.
- **Review `audit:vault-exploits`, then run `audit:vault-exploits:apply`.**
- **Review `audit:forum-links`.**
- **Enable `db-backup`, `log-retention` and `budget-year-rollover` in `CRON_ENABLED_JOBS`** (`budget-year-rollover`
  only after the remap below).
- **Set `DISCORD_GUILD_ID`.**
- **Run `db:mark-match-revenue-collected`** right after the schema push.
- **Run the budget-year remap.** Its tool `db:remap-budget-years` was retired on 2026-10-21; restore it from
  `65fd9dcdc^` first ([MyCountry runbook, step 8](../history/operations/deploy-mycountry-2026-10.md#8-turn-the-jobs-on)).
