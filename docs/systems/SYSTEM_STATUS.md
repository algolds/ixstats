# IxStates System Status

**Platform:** 1.4.0 "Lobster Crosby", Release Candidate (integration branch `rose-garden`)
**Last verified:** 2026-09-29, by a doc-by-doc audit against the code
**Version registry:** [`src/lib/buildVersion.ts`](../../src/lib/buildVersion.ts) · **Versioning spec:** [`docs/reference/revision.md`](../reference/revision.md)
**Open work:** [`ROADMAP.md`](../roadmap/ROADMAP.md) (the plan) · [`pending-features.md`](../roadmap/pending-features.md) · [`code-audit-2026-09-30.md`](../roadmap/code-audit-2026-09-30.md)

This page replaces the August "Gold Master (100%)" matrix. That matrix rated every system as finished; the September audit
found several that are partly built, read-only, or broken, so each row now carries the status the code supports.

## Status key

| Label | Meaning |
| :--- | :--- |
| ✅ **Live** | Shipped, wired into navigation, works end to end |
| 🟡 **Partial** | Shipped, but documented scope is missing or a loop is broken (see Notes) |
| 🔒 **Premium** | Live, gated to premium accounts |
| 🧪 **Labs** | Experimental; reachable under `/labs` or a standalone route |
| ⛔ **Not built** | Designed or documented only |

---

## 🏛️ MyCountry — executive simulation

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Command Surface | UI v6 | `/mycountry`, `/mycountry/{executive,economy,politics,diplomacy}` | `mycountry/`, `quickactions/`; `components/mycountry/shell/` | ✅ Live | Overview/Executive, Economy, Politics and Diplomacy are open to every player |
| Directives (Intent) | engine v4 | `/mycountry` | `intent.ts`, `src/lib/intent/`, `src/lib/statecraft/` | ✅ Live | Flat intent tree; 3 per IxTime week plus cooldown. Intent DAG and layers not built |
| National Issues & 4-branch brief | engine v4 | `/mycountry` | `national-issues/`, `src/lib/national-issues/` | ✅ Live | Recon ("SEE") sits behind `STATECRAFT_SPINE`, off by default |
| Information fog | — | policy creator | `PolicyReconBanner.tsx` | 🟡 Partial | Warnings only; numbers are not masked into bands |
| Cabinet meetings | — | `/mycountry` agenda | `meetings/`, `quickactions/meetings.ts` | 🟡 Partial | Schedule-only; outcome and decision mutations were deleted (plans 312/332) |
| Event spine / canon feed | — | `/mycountry` | `src/lib/activity/event-spine.ts` | 🟡 Partial | Directives and issues write to it; diplomacy, defense, elections and meetings bypass it |
| Economy & fiscal policy | — | `/mycountry/economy` | `economics/`, `taxSystem/`, `src/lib/economy/`, `src/lib/government/` | ✅ Live | 20 built-in archetypes; 6 player tax-rate sliders over 42 engine tax components (the tax builder UI was removed); ERI, PII and GDP projection are reference formulas only |
| Politics: parties, legislature, bills, brokers | — | `/mycountry/politics` | `elections/`, `legislation.ts` | ✅ Live | |
| Elections | — | `/mycountry/politics` | `elections/`, `src/lib/government/election-simulation.ts` | 🟡 Partial | **Broken loop:** candidate registration was deleted (plan 312), so cron-scheduled follow-up elections never resolve |
| Diplomacy | — | `/mycountry/diplomacy` | `diplomacy/`, `diplomaticScenarios/` | ✅ Live | Embassies, alliances, cultural exchange, stances with drift cron. Embassy missions are not playable |
| Defense | — | `/mycountry/defense` (also serves `/mycountry/intelligence`) | `security/`, `militaryEquipment/` | 🔒 Premium | |
| Intelligence | — | — | `intelligence/` (templates), `diplo-intel.ts` | 🟡 Partial | No standalone dashboard; the old stack was deleted in plans 312/341 |
| Map editor section | — | `/mycountry/map-editor` | — | 🟡 Partial | Premium-gated, but the route falls through to the Executive home |
| Country Builder | v4 | `/builder`, `/mycountry/editor` | `builderDraft.ts`, `countries/`, `economics/`, `customTypes.ts` | ✅ Live | 4-step wizard plus wiki import; guided/expert modes, 50-step undo in edit mode |
| Builder companion guide | — | `/builder` | `BuilderGuideSheet.tsx` | 🟡 Partial | No diagnostics tab or subheader deep links |
| Autosave | — | builder | `useGenericAutoSync` | 🟡 Partial | Only the Economy builder uses the engine; no navigation flush or shared sync badge |

## 🌍 Atlas & Realms — geography and worlds

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Interactive map | IxWorld v2 | `/maps` (`?realm=`) | `geo/core/`, `geo/sovereignty.ts`, `countryGeo.ts` | ✅ Live | MapLibre 6 globe; realm-scoped layers |
| Map editor | IxWorld v2 | in place on `/maps`; world editor at `/admin/maps/editor` | `geo/editor/`, `geo/admin/` | 🟡 Partial | Border/coast/river snapping and history ship; the 2026-09-11 inspector spec is only partly built; no cross-country gap/overlap validation |
| Map pipeline (SVG/PNG/procedural) | Atlas v5 | `/labs/map-pipeline`, admin wizard | `geo/editor/procedural.ts`, `src/lib/maps/` | ✅ Live | PNG realm maps with colour → nation mapping |
| Worldgen (UPG v2) | Atlas v5 | `/labs/map-pipeline` | `src/lib/worldgen/v2/` | ✅ Live | Not yet connected to realm generation |
| Routes & travel time | — | `/maps` | `transport/`, `src/lib/economy/travel-time.ts` | ✅ Live | Sea routes use currents and wind; directive-driven network speeds not built |
| Realms Phase 1 + Eurth | — | `/r/[realm]`, `/admin/realms` | `realms/`, `src/server/modules/realms/` | ✅ Live | Ownership, verified-creator claims, realm-scoped listings, lore index. Merged 2026-09-29 |
| Realms Phases 2–4 | — | — | — | ⛔ Not built | Founding applications, founder tooling, archived realms, per-realm feeds, realm switcher, procedural realm generation |

## 📖 WikiOS — lore platform

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Native lore engine | WikiOS v1 | `/wiki/*`, `/util/*` | `wikios/`, `src/lib/wiki-os/` | ✅ Live | PostgreSQL store with inbound MediaWiki recent-changes sync; no MariaDB path |
| Multi-wiki reading | — | `/wiki/[slug]?source=` | `wikios/` | ✅ Live | Other wikis' pages are read-only |
| Canvas editor (Plate) | Canvas v1 | `/wiki/[slug]/edit` | `wikios/editing.ts`, `components/wiki-os/editor/plate/` | ✅ Live | WikiAST, slash menu, TemplateData forms |
| MediaWiki export | — | — | `adapters/mediawiki/sync-worker.ts` | 🟡 Partial | In-memory queue (lost on restart); bot session only, no per-user attribution |
| Margin | — | `/wiki/*?margin` | `components/wiki-os/margin/` | 🟡 Partial | No comment reactions or deletion; no Stash tab; Inspect tab hidden |
| Stash | v1 | `/stashes` | `wikios/stash.ts`, `forum/stash.ts` | 🟡 Partial | Share links are not read |
| Lorewards & article awards | Achievements v2 | `/util/lorewards` | `lorewards/` | ✅ Live | |
| Repository (Commons) | v2 | `/util/repository` | `commons.ts` | ✅ Live | |
| Guardian | — | — | `guardian/cloudflare-guardian.ts` | 🟡 Partial | Turnstile optional; no abuse filter |
| Stage 3 MediaWiki isolation | — | — | `scripts/ops/stage3-nginx-cutover.conf` | ⛔ Not built | Staged config only; not cut over |

## 💎 Vault — credits, cards, achievements

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxCredits ledger | IxVault v2 | `/vault` | `vault/`, `src/lib/vault/` | ✅ Live | Passive income + catch-up, daily streak, `EARN_BONUS` |
| Cards | IxVault v2 | `/vault/cards` | `cards/`, `lore-cards/` | ✅ Live | 5 card types. NATION cards are re-priced daily but not auto-minted |
| Pack store & opening | IxVault v2 | `/vault/marketplace?tab=store` | `card-packs/` | 🟡 Partial | `guaranteedRarity` and `themeFilter` not enforced; Keep/List quick actions only log |
| Marketplace (auctions) & trading | IxVault v2 | `/vault/marketplace`, `/vault/trading` | `card-market/`, `trading/` | ✅ Live | Escrow-locked |
| Crafting | — | `/vault/crafting` (unlinked) | `crafting/` | 🟡 Partial | **Broken end to end:** wrong ID type, success-rate units, seed/schema mismatch |
| NationStates import | — | `/vault/import`, `/vault/ns-deck` | `ns-import/` | ✅ Live | Dump sync is admin-triggered |
| Achievements | v2 | `/achievements`, `/leaderboards` | `achievements/` | ✅ Live | Evaluated only on page visit; ribbons are decorative |
| Premium tiers | — | — | `premiumProcedure`, `PremiumPreviewFrame` | 🟡 Partial | Only Defense and 10 security procedures are gated; no payments |

## 💬 ThinkPages — social

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Feed | v2 | `/dashboard`, `/thinkpages/post/[id]`, `/hashtags/[tag]` | `thinkpages/`, `polls/` | ✅ Live | `[blurb:slug]` is a Blurbs cross-post prefix |
| Accounts (personas) | v2 | `/thinkpages` | `thinkpages/accounts.ts` | ✅ Live | 25 accounts per user; Discord mirror and IxTwitter import |
| ThinkTanks | v2 | `/thinktanks` | `thinkpages/thinktanks/` | 🟡 Partial | Feed and Members only; Docs tab built but not mounted; no chat |
| ThinkShare messages | v2 | `/messages` | `messages/` | ✅ Live | Live over `/ws/thinkpages`; encryption fields exist but no cryptography |
| Blurbs | — | `/blurbs` | `blurbs/` | ✅ Live | |

## 🗨️ Forum & identity

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxForum (XenForo bridge) | platform | `/forum` | `forum/` (`reading`, `writing`, `stash`, `account`) | ✅ Live | Moderation and alerts removed (plan 312) |
| Passport | — | `/@user`, `/id/[username]`, `/r/[realm]/[username]` | `src/server/modules/identity/` | ✅ Live | Overview/Work/Realms/History tabs |
| Verified wiki accounts | — | `/settings` | `identity.wiki-links.ts` | ✅ Live | Token saved to the user page on ixwiki, iiwiki or althistory |

## ⚙️ Concord — living world

| Subsystem | Version | Routes | Routers / code | Status | Notes |
|---|:---:|---|---|:---:|---|
| IxTime | Concord v2 | platform | `src/lib/ixtime/`, `/api/ixtime/sync-from-bot` | ✅ Live | Discord bot is the source of truth; continuous across multiplier changes |
| Crisis events | Concord v2 | — | `crisis-events.ts` | 🟡 Partial | Read-only (`getActive`, `getStatistics`); only the demo seed creates rows; no admin UI |
| NPC personalities | Concord v2 | `/admin/npc-personalities` | `npcPersonalities/`, `src/lib/diplomacy/npc-personality.ts` | 🟡 Partial | Traits drive cultural-exchange responses only; drift has no callers; no event fatigue |
| Cron | — | — | `cron-runner.mjs`, `src/server/cron/jobs.ts` | ✅ Live | 17 jobs (incl. `db-backup`, `budget-year-rollover`); none run unless listed in `CRON_ENABLED_JOBS` |

## 🎨 Design, Halo & admin

| Subsystem | Version | Routes | Code | Status | Notes |
|---|:---:|---|---|:---:|---|
| Facet design system | v2 | global | `src/styles/facet/`, `src/components/ui/facet*` | ✅ Live | Plan 346 cleanup partial (hex colours, blur, pulse counts in the audits) |
| Halo overlay & command palette | v5 | global | `src/components/halo/` | ✅ Live | |
| Cuelume audio | v1 | global | `src/lib/sound/cuelume.ts` | ✅ Live | 17 synthesized cues |
| Admin console | platform | `/admin/*` | `admin/`, `AdminRouter.tsx` | 🟡 Partial | 39 sections; `/admin/calculations` has no `page.tsx`; the audit log middleware persists nothing (PL-1) |
| Help center | platform | `/help` | `src/content/help/`, `HelpExplorer.tsx` | 🟡 Partial | See [help.md](help.md) for registered vs unregistered articles |
| Rate limiting | platform | — | `src/lib/cache/rate-limiter.ts`, `trpc/middleware.ts` | 🟡 Partial | Fewer than 100 of ~960 procedures are limited; no `X-RateLimit-*` headers |

## 🧪 Labs

| Tool | Version | Routes | Routers | Status | Notes |
|---|:---:|---|---|:---:|---|
| Onoma | v4 | `/labs/onoma` | `onoma/`, `/api/onoma/tts` | 🧪 Labs | Roadmap phases 1–3 and 7 done; 4, 5, 8, 9 partial; 6 and 10 not started |
| MyLeague & MyClub | platform | `/myleague`, `/myclub` | `sports/` | 🧪 Labs | 7 sport presets; boxing reuses the soccer loop |
| Vexel heraldry | — | `/labs/vexel` | `heraldry/` | 🧪 Labs | P0 mostly built; not in the Labs menu; attach-to-country blanks the coat of arms |
| Map pipeline | Atlas v5 | `/labs/map-pipeline` | `geo/editor/procedural.ts` | 🧪 Labs | |

---

## Known blockers on `rose-garden`

- **M0 follow-ups (code audit 2026-09-30).** The exploit and authorization fixes are merged ([#36](https://github.com/algolds/ixstats/pull/36), [#37](https://github.com/algolds/ixstats/pull/37), [#38](https://github.com/algolds/ixstats/pull/38), [#39](https://github.com/algolds/ixstats/pull/39)).
  Still open: rate limits on the remaining protected mutations, removing the nginx CSP override (the nonce itself is
  fixed), and
  these ops steps (besides the password rotation below): run `db:backup` and test a restore; run
  `db:mark-match-revenue-collected` right after the schema push; run `db:remap-budget-years`;
  review `audit:vault-exploits` and run `audit:vault-exploits:apply`; review `audit:forum-links`; enable `db-backup` and
  `budget-year-rollover` in `CRON_ENABLED_JOBS`; set `DISCORD_GUILD_ID`. Plan: [ROADMAP M0](../roadmap/ROADMAP.md#m0--integrity-security--economy-exploits).
- **`audit:arch` (non-blocking in CI) reports 15 source files over their line ceiling** (largest:
  `routers/wikios/templates.ts`, 1,298 lines). Split them or add them to `RELAXED_FILES`.
- **Rotate the `ixstats_readonly` Postgres password** (plan 325): the old one is in git history since 2026-05-31.
  The script no longer contains it.
