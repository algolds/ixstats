# IxStates platform audit — 2026-09-30

> **Retired 2026-10-05** to [docs/history/](../../README.md). Open items live in [backlog.md](../../../roadmap/backlog.md) (PA); the area reports beside this file are unchanged snapshots.

**Branch audited:** `rose-garden` @ `e91e6b0b2`. **Method:** every system doc, the roadmap, the 2026-09-30 code
audit and the CHANGELOG were read and checked claim by claim against the code (routers, libs, schema, callers, and
a few measured runs). Where docs and code disagree, the code wins. Six area audits sit next to this file; this page
is the synthesis. Findings from those reports that matter most were re-checked by hand before being listed here
(marked ✔).

| Area report | Covers |
|---|---|
| [atlas.md](atlas.md) | Maps, editor, worldgen, terrain/climate/hydrology, imports, standalone IxWorld |
| [mycountry.md](mycountry.md) | Builder/Editor, Statecraft, Issues/Directives, politics, diplomacy, defense, Concord |
| [vault-identity.md](vault-identity.md) | Credits, cards, packs, marketplace, achievements, Lorewards, NS import, IxnayID/Passport, Realms, premium |
| [wikios-onoma.md](wikios-onoma.md) | WikiOS vs MediaWiki, standalone readiness, Stash/Repository, Onoma, Narrator |
| [social-core.md](social-core.md) | ThinkPages/ThinkShare/ThinkTanks, notifications, MyLeague/MyClub, IxTime, Facet, Halo |
| [ponytail.md](ponytail.md) | Code-simplification pass: dead code, duplication, monoliths, dependencies, `ponytail:` markers |

**Not covered:** the Discord conversation audit (#staff 557027746237120524, #general 557016199427522561). This
environment has no bot token and its network policy blocks `discord.com`; see [the last section](#discord-audit).

---

## 0. Status since the audit (updated 2026-10-05, after #48 and #49)

The audit describes `rose-garden` @ `e91e6b0b2`. The same day, PR #48 merged ten parallel fix branches and the
owner's 17-item bug list into `rose-garden` (`67e937a3f`). Items below are marked **✅ fixed**, **◐ partly fixed**
or left as found. The area reports are unchanged snapshots; this page tracks status.

**Fixed:**

- **Security (section 2):** all ten items. Two owner actions remain: check the IxWiki bot's grants on
  Special:BotPasswords, and rotate the MariaDB password that was committed.
- **Screens that lied:**
  - the Approval and Stability bands;
  - the fake ribbons;
  - the daily-roll copy and the multiplier row;
  - the "connected wiki" status;
  - the Caphiria mock-up as the country-profile default;
  - the ThinkShare encryption claim.
- **Economy:** entry packs no longer junk for more than their price (EV is now under 0.5× the price, and under 0.85×
  at the admin ceiling). Packs, junk and lore cards go through the ledger. The lore gallery is live and is the
  default Cards tab, and NationStates import is secondary.
- **Loops:**
  - Directives now move GDP (a growth modifier) and stability.
  - Hostile foreign-policy actions apply their effects.
  - Cooperative proposals and alliance invites can be accepted, through the API only.
  - Like and reply notifications reach the right person.
  - ThinkTank Chat and Docs tabs are mounted, with invites by username.
  - Sports predictions can be placed.
  - Diplomatic DMs are reachable.
- **Atlas:** feature IDs are stored as strings, terrain sampling is realm-scoped, the city fallback no longer
  overwrites national figures, the 14 `@turf/*` packages are declared, and the MapLibre worker is always shipped.
  These last two are the likely causes of the maps build error and the "map offline" reports.
- **WikiOS:** a namespace edit policy, stale-render fixes (sync clears `contentHtml`; edits render the submitted
  text), cached author lookups, and per-article canonical URLs.
- **Docs:** SYSTEM_STATUS ratings were corrected and the "Gold Master" badges removed (section 9).

**Closed by #49 (2026-09-30):** PR #49 closed the seven loops this list held:

1. ✅ **Issue consequences → stats.** GDP and population consequences create phased level `StorytellerEffect`s, issue
   stability deltas survive recalculation, and the `stat-progression` job persists stats and monthly history.
2. ✅ **First elections** (MC-2). Elections are scheduled once a legislature has at least 2 parties; bills can pass.
3. ✅ **Inbox UI** for foreign-policy proposals and alliance invites (MyCountry diplomacy Inbox; 14-day expiry).
4. ✅ **Social pull:** mention notifications fixed, persona follows, the `thinkpages-trending` job, and a personal
   persona for post-as-yourself.
5. ✅ **IxnayID-first economy:** the welcome bonus at account creation, 19 account-level achievements, background
   evaluation (`achievements-evaluate`), a passport showcase, and ribbons derived from real unlocks.
6. ◐ **Realms as places** and a realm-aware builder: nation caps, the nav and passport nation switcher, realm boards, a
   `/realms` directory (in the sidebar since 2026-10-05) and a realm filter on the ThinkPages feed. The dashboard
   feed and trending are not realm-scoped.
7. ✅ **Remaining truth fixes:** Diplomatic Standing is computed, the Trending tab has real data or an honest empty
   state, passport privacy is persisted and enforced on the server, and the Capacity band shows real CivCap.

**Still open:** the owner actions above; PR #49's known gaps (no region filter on rankings, DMs can't be sent as a
persona or country, appointed chambers are still seated by the vote simulation); the GDP-growth trigger unit bug in
national issues. [ROADMAP.md](../../../roadmap/ROADMAP.md) and [ACTION_PLAN_2026-10-05.md](../../../roadmap/ACTION_PLAN_2026-10-05.md) track the
rest.

The decisions the owner still owes (crafting pacing, FP expiry, passport privacy model, WikiOS Template/Category
policy, prediction stakes, premium for staff) are listed in PR #48.

---

## 1. Verdict

IxStates is large and mostly real: about **650k lines** of app code, **50k lines** of tests (348 files), **961**
tRPC procedures, **332** Prisma models. Several engines are genuinely strong — the MapLibre viewer and topology-aware
border editor, the map import pipelines, the MyLeague simulation, the Onoma language engine, the atomic credit
ledger, IxTime, and the issue/directive generators.

**What stands between it and "a true working NationStates-class platform" is not missing breadth. It is that the
loops don't close, several screens show numbers that aren't true, and the platform account is still shaped around a
single country.** Concretely:

- **A player's decisions don't reach the numbers they watch.** The Command Surface's Approval and Stability bands
  read fields that don't exist and show 68% / 78% for everyone ✔ *(fixed in #48; directives now move GDP and stability too)*. Issue consequences mostly write fields no
  progression reads; only `StorytellerEffect`s move GDP, and resolving an issue never creates one. Rankings read
  stored stats that only an admin button refreshes. (mycountry §1.2–1.3)
- **Politics and cooperative diplomacy are dead ends.** No first election is ever created, so no bill can pass;
  free-trade and alliance proposals can never be accepted because plan 312 deleted the accept procedure. (mycountry)
  *(Accept/decline restored in #48, still without UI; elections unchanged.)*
- **The social layer posts but doesn't pull people back.** Like/reply/mention notifications are all broken *(like and reply fixed in #48)*,
  there are no person follows, trending is always empty, and nothing is realm-scoped. (social-core §0, §3)
- **The platform economy is country-bound and leaky.** The dividend, the 5,000 IxC welcome bonus and all 76
  achievements need a country; a player without one earns ~1–60 IxC a day. Entry packs are worth more junked than
  they cost ✔ *(fixed in #48)*. (vault-identity §1.2–1.3)
- **The "standalone products" are hostname switches.** maps.ixwiki.com is the whole IxStates build; WikiOS renders
  through MediaWiki's copy of every page. Onoma is the one module that could ship on its own soon. (atlas §5,
  wikios-onoma §3–4)
- **The docs overstate.** Many system docs still carry "Gold Master (100% Ready)" badges from an earlier pass;
  SYSTEM_STATUS marks Politics, Diplomacy, Economy, National Issues, Worldgen, ThinkShare and the ledger ✅ Live
  where the code says partial. *(Corrected in #48.)*

The good news is structural: most gaps are wiring, not missing systems. The per-realm nation cap, the
active-nation pointer, the event spine, the Stash service, the media picker, the transport→economy loop and the
IxTwitter bridge already exist and prove the patterns.

---

## 2. Fix now (security and integrity)

Ranked by risk. All are small (S) unless noted.

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | **WikiOS pushes every signed-in user's edit to MediaWiki under one bot account.** Page protection can't be set (WK-3), so every title is editable, including `Template:`, `Module:` and `MediaWiki:` pages. What that reaches depends on the bot's grants. **Check Special:BotPasswords on IxWiki today**, then allowlist editable namespaces server-side. | `routers/wikios/editing.ts:32-43,81+`; `src/env.ts:92` | ✅ fixed (namespace policy); **bot grants still to check** |
| 2 | **Sending a message joins you to any group or ThinkTank chat**; ThinkTank group ids are public. | `modules/messaging/message-operations.ts:57-68` | ✅ fixed |
| 3 | **Personas can be created for any country** (no ownership check). | `routers/thinkpages/accounts.ts:104-150` | ✅ fixed |
| 4 | **Buy → open → junk mints credits**: five entry packs return 1.01–1.55× their price, uncapped; packs and junking also bypass the ledger (VT-4). | `lib/cards/valuation.ts:48`; `card-packs.json` | ✅ fixed (`junkRate` 0.25, cap 0.5; ledger) |
| 5 | **Viewing a public passport writes an unverified `wikiUsername`** (and a fake `wikiUserId = 1`); Lorewards pays its 2,500 IxC bonus to whoever holds that name. | `identity.service.ts:67-86`; `lorewards/sync.ts:569-576` | ✅ fixed (verified links only); legacy data cleanup pending |
| 6 | Users can **self-grant the verified badge** on personas. | `thinkpages/accounts.ts`; `AccountSettingsModal.tsx` | ✅ fixed (admin-only) |
| 7 | Public `messages.searchUsers` returns full user rows (`clerkUserId`, `discordUserId`, `lastSeenAt`); `thinkpages.getPost` ignores visibility. | `messages/participants.ts:127-147`; `posts/queries.ts:132-166` | ✅ fixed |
| 8 | A **real-looking MariaDB password** is committed as a script fallback. Rotate it if it was ever real; remove the fallback. | `scripts/sync-ixwiki-full.ts:35`; `scripts/audit/audit-wikios-parity.ts:31` | ✅ fallback removed; **rotation still to do** |
| 9 | Public `previewWikitext` lets anonymous users run MediaWiki's parser on 200k characters. | `wikios/editing.ts:59-79` | ✅ fixed (protected) |
| 10 | Narrator LLM client has no SSRF guard and silently reuses the sports keys. | `lib/narrator/client.ts` | ✅ fixed |

Original evidence: items 1–4 were re-checked by hand; items 5–10 come from the area reports. All ten were fixed in #36–#48 (see section 0).

---

## 3. Scorecard

| App / system | What works | Where the loop breaks | Standalone readiness |
|---|---|---|---|
| **Atlas** (maps, IxWorld) | Viewer, embeds, border/subdivision editor, SVG/PNG whole-map + province + city import, transport network → economy | Worldgen is a Labs demo that freezes the browser and saves nothing; ~~procedural import into a realm likely fails (numeric ids into a string column)~~ ✅ ids fixed; geography modifiers are displayed but never read by the economy; every map feature needs a country | Low — same build and DB as IxStates; no user-owned worlds; no GeoJSON/Azgaar import or export; no terrain raster |
| **MyCountry** | Builder (+ wiki prefill), issues and directives generate/resolve/log, politics drift, embassies | Issue decisions don't move headline stats (directives now do ✅; bands real ✅); two sources of truth for stats; elections/bills inert; cooperative foreign policy accept is API-only ◐; Defense premium is hollow (test switch `NEXT_PUBLIC_PREMIUM_FOR_ALL`) | n/a (the core game) |
| **Vault** | Atomic ledger with locks and idempotency, store (server-priced), pack opening, auctions/trades with escrow, NS import | Credits depend on a country; ~~pack/junk arbitrage~~ ✅; settlement crons off by default; crafting ◐ (ids fixed, pacing undecided); ~~lore gallery hidden~~ ✅; ~~fake ribbons~~ ✅ (rack empty until real ribbons) | n/a (platform service) |
| **Achievements / Lorewards** | 76 definitions, Lorewards scoring and calendars | Need a country; evaluated only on page visit (the background worker has 0 publishers); not shown on the passport; ~~Lorewards pays via an unverified column~~ ✅ | — |
| **IxnayID / Passport** | Identity module, verified wiki/forum links, 5-tab passport, "Play as" | No first-class handle or profile record; personas live in ThinkPages; premium ◐ one definition (`hasPremiumTier`) but staff pass the client check and fail the server gate; not in the version registry or main nav | — |
| **Realms** | Claims, per-realm nation cap, Play-as, realm-scoped map | Builder always uses the default realm; no directory; feed/sports/ThinkTanks ignore realms; geo leaks (terrain sampling, currents, planet scale) | — |
| **WikiOS** | Postgres storage, revisions/history/diff, links, special-page equivalents, Plate editor, Margin | Rendering, templates, Lua, images and uploads are MediaWiki's; ~~edits can render stale~~ ✅; category drift; rights model ◐ (namespace policy only); no protection, move/delete, edit conflicts | Low — needs a renderer contract, native media, tenancy, auth adapter, XML import/export |
| **Onoma** | Markov naming, IPA, declension, sound shifts, Kokoro bridge; phases match its roadmap | Language packs can't be published; stash ownership now accepts both user ids ✅ | **High** — 8.5k lines with two external imports |
| **Narrator** | Read-aloud (restricted) | LLM narration has no production caller since plan 312; SSRF guard added ✅ | — |
| **ThinkPages / ThinkShare / ThinkTanks** | Personas, posts, polls, reactions, real-time DMs, ThinkTank feed and roster, IxTwitter bridge | Notifications ◐ (like/reply ✅, mention still broken); no follows; can't post as yourself; ~~diplomatic DMs unreachable~~ ✅; ~~ThinkTank chat/docs not surfaced~~ ✅; trending empty | — |
| **MyLeague / MyClub** | 5 sport resolvers + F1, aging, transfers, promotion/relegation, World Cup, franchise claiming | ~~Predictions not placeable~~ ✅ (rivalries still not); ~~create pages 404~~ ✅ links removed; no league community; not realm-scoped | Medium — `lib/sports` (9.3k lines) is mostly pure |
| **IxTime** | Clean shared library (91 importers), bot as source of truth | `ixTimeTimestamp` columns hold real time in some writers and game time in others | High |
| **Facet / Halo** | Facet primitives are a true leaf layer; Halo command palette and plugins | Halo imports builder, wiki and tRPC — it's a platform shell, not part of the design system | — |

---

## 4. Cross-cutting patterns

1. **Loops that stop one step short.** Issue → consequence → *stat*; post → *notification* (◐ like/reply fixed); achievement →
   *background evaluation*; worldgen → *saved world*; auction/trade → *settlement cron (off)*; election → *first
   election*; foreign-policy proposal → *accept* (◐ API restored, no UI). Each has the first half built.
2. **Two sources of truth.** Projected vs stored country stats; ~~three premium definitions~~ (◐ one now); a heuristic passport
   handle; `ixTimeTimestamp` with two meanings; Clerk ids and internal ids mixed across tables.
3. **Screens that aren't true.** ~~Approval/Stability bands, 3 fake ribbons on every country page, a daily roll that
   promises 10,000 but pays ≤100, a reward multiplier that does nothing, "connected" wiki whenever you own a
   country~~ (all ✅ fixed in #48); still open: session-only passport privacy switches (now labelled), an empty
   Trending tab, Diplomatic Standing fixed at 70. The roadmap's
   M2 rule ("nothing on screen lies") is the right priority.
4. **Country where the platform should be.** Credits, achievements, personas and every map feature require a
   country. The owner's model (one IxnayID; countries live in realms) needs account-level earning, identity and
   map data.
5. **Realm-blind layers.** Feed, trending, ThinkTanks, sports and parts of geo ignore `realmId`. Realms have no
   "place" (the NationStates regional message board equivalent).
6. **Products in name only.** Atlas and WikiOS are branded apps inside one Next.js build; a hostname switch is not a
   product boundary. Their pure cores (worldgen, topology, Onoma, sports, IxTime, `lib/wiki-os`) are liftable; the
   seams around them are not.

---

## 5. The flywheel: which "better together" seams exist

| Seam | State |
|---|---|
| Wiki ↔ Maps embeds (`/maps?embed`, `CountryMapEmbed`, 10 consumers) | ✅ works; the maps build error and dead maps are fixed in #48 (undeclared `@turf/*`, MapLibre worker, embed CSP nonce) |
| Transport network → economy (`transport-sync` → StorytellerEffects) | ✅ the one real geography→economy loop |
| Discord ↔ ThinkPages (IxTwitter bridge) | ✅ works; `#thinkpages` mirror has no admin save (WK-10) |
| Forum DMs → ThinkShare; forum SSO | ✅ |
| Stash across WikiOS, Forum, Onoma, Messages, Lore Cards | ✅ (collision bug NEW-10; old stashes hidden by the id switch are visible again ✅) |
| Shared media picker across 6 apps | ✅ (lives in WikiOS) |
| MyCountry → Vault dividends | ✅ but it's the coupling the owner wants to loosen |
| Sports → ThinkPages bulletins, saints → StorytellerEffect | ✅ |
| Geography → economy (profiles, resources, climate) | ❌ displayed only |
| Issues/directives → stats → rankings | ❌ (section 1) |
| Achievements/ribbons/collection → passport showcase | ❌ not on the passport |
| Realm → feed / ThinkTank / league | ❌ |
| Halo plugins for ThinkPages, Messages, Vault, Maps | ❌ missing |

---

## 6. App/system tree

The owner's draft is close to what the code supports, and the repo already has two partial trees: the version
registry (`src/lib/buildVersion.ts`: apps IxWorld/WikiOS/IxVault; engines MyCountry/Concord/**Atlas**; systems
ThinkPages, Achievements, Stash, Repository, Halo, Onoma; design Facet) and the org chart in
`docs/reference/revision.md`. Grounded in the audits, this is the tree the data supports:

```text
SYSTEM APPS
  Atlas ─────────── maps viewer + editor, worldgen, terrain/climate/hydrology, imports, embeds
                    (IxWorld = realm 0, IxEarth = its geography; drop "IxMaps")
  MyCountry ─────── Builder (incl. wiki import) · Editor · Statecraft (issues + directives + policies
                    + politics + diplomacy + defense, one loop)
  Vault ─────────── IxCredits (ledger, streaks, dividends, store) · Cards (lore, country, special;
                    NationStates import as a sub-feature) · Marketplace · Achievements, Ribbons, Lorewards
  WikiOS ────────── reader · Canvas editor (+ templates/data embeds) · Margin · history/utilities
  ThinkPages ────── ThinkPages (feed incl. system wire, blurbs, polls) · ThinkShare (DMs, diplomatic
                    cables) · ThinkTanks as "Spaces" (also realm boards, league rooms, blocs)
  IxForum ───────── long-form dispatches (XenForo), bridged into ThinkShare
CORE
  IxnayID / Passport ─ account, handle, personas ("acting as"), linked accounts, entitlements/premium,
                       showcase (achievements, ribbons, collection)
  Realms ───────────── worlds that countries live in; nation caps; claims; the country-scoped boundary
  Temporal Engine ──── IxTime
  Simulation engine ── one engine (merge Concord into Statecraft; split a "world" module out only when
                       NPC agency/crises have real code)
  Library ──────────── Stash + media Repository + uploads, as data services
  Halo ─────────────── platform shell (command palette, tray, plugins)
  Facet ────────────── design system (tokens, primitives, motion, Cuelume)
LABS
  MyLeague/MyClub (graduates onto Spaces) · Onoma (+ SDK) · Narrator · Vexel
```

Answers to the owner's open questions:

- **Should Concord and Statecraft merge?** Yes. Neither is an engine in code: `lib/statecraft` is 9 pure helper
  files, "Concord" has no folder, and both `*_ENGINE_VERSION` constants have zero consumers; docs define
  "Statecraft" five ways and place Issues and Diplomacy under both. Keep "Statecraft" as the player-facing name.
  (mycountry §3)
- **Should Facet include Halo, Stash, Repository?** No. Facet is a leaf layer that imports only utils; Halo imports
  builder, wiki and tRPC code, so it's the shell built *on* Facet. Stash and Repository are data services used by
  5–6 apps; make them a core **Library** and ship only their UI parts through Facet. (social-core §5,
  wikios-onoma §6)
- **Is Atlas the right name?** The code already uses it (`engines.atlas`, "Atlas World Map" in admin). "ACE" has no
  footprint. The conflict to resolve is "IxWorld" meaning both the app and realm 0. (atlas §4)
- **Where does demographics go?** Split: spatial population (city/province, density) is Atlas; national composition
  and figures are MyCountry; the rollup is the contract between them. (atlas §4)
- **Where does wiki import go?** Inside Builder — it only prefills the builder. (mycountry §5)
- **Realms** are missing from both existing trees and belong in core.

---

## 7. Five countries per realm (and monetization)

Mostly modelled already: `Country.ownerUserId` allows many; `Realm.settings.maxNationsPerUser` (default 1, max 20)
is enforced in `assignNation` and claims; `User.countryId` is the active-nation pointer; `setActiveNation` exists.
What's needed (details: mycountry §6, vault-identity §3.4):

1. A platform default of 5 plus a tier-aware cap (`min(realm cap, tier cap)`), with **one premium definition** tied
   to IxnayID entitlements (today premium is `mycountry_premium` with three disagreeing checks).
2. A realm-aware builder: `createCountry` always uses the default realm and silently returns your existing nation.
3. A nation switcher in the passport/nav; write checks that decide between "active nation" and "any owned nation".
4. Economy decisions: dividends and achievements per account or per nation (today the active nation pays, so players
   can switch to their richest nation before payout); directive caps per nation or per account.
5. `adminAssignNation` must stop releasing a user's other nations in the same realm.

No schema change is strictly required.

---

## 8. Distance to the goal — suggested order

This reorders the existing [ROADMAP](../../../roadmap/ROADMAP.md) milestones around what the audits found; M0 is done in code.

1. ✅ **Fix now** — section 2. Done in #36–#48; owner actions remain (bot grants, password rotation).
2. ◐ **Make it true** (M2's rule, pulled forward): most fabricated numbers are fixed and the docs are corrected
   (#48). Left: Diplomatic Standing, Trending, the Capacity band, passport privacy.
3. ◐ **Close the MyCountry loop**: ~~bands read real fields~~ ✅; directives ✅ but issue GDP effects still need to go
   through `StorytellerEffect`; one stat source of truth with a progression job (MC-7); first elections (MC-2);
   foreign-policy accept path ✅ backend, needs an inbox UI; rankings from existing fields. **Next up.**
4. **Close the social loop**: notifications (◐ like/reply done; mention left), follows, trending job, post-as-yourself via an IxnayID "acting-as"
   identity.
5. ◐ **IxnayID-first economy**: welcome bonus at account creation, account-level achievements, background
   evaluation, passport showcase, ribbons as real records; ~~lore gallery in production, NS import moved to "one
   more thing", fix pack/junk economics~~ ✅ done in #48.
6. **Realms as places**: Spaces (ThinkTanks) as realm boards; realm-scoped feed, leagues and geo config; realm-aware
   builder; nation switcher.
7. **Atlas persistence**: saved procedural worlds imported into realms; map features without a country; geography
   feeding the economy; terrain raster.
8. **WikiOS independence track**: render from Postgres wikitext, native media, rights model, then renderer
   contract + XML import/export for other communities.
9. **Products**: Onoma SDK first (smallest lift), then Atlas and WikiOS once their seams exist; MyLeague onto Spaces.

---

## 9. Docs that need correcting

✅ **Done in #48:** system docs corrected against the code, Gold Master badges removed, SYSTEM_STATUS ratings
fixed, and statements updated for the fixes that merged with them. The list below is what the audit found:

- "Gold Master (100% Ready)" status headers in `maps.md`, `social.md`, `halo.md`, `ixtime.md` and other system docs.
- `SYSTEM_STATUS.md`: Politics, Diplomacy, Economy, National Issues, Worldgen/procedural pipeline, ThinkShare,
  Accounts, the ledger and the marketplace are rated ✅ Live; the code supports 🟡 Partial.
- `mycountry.md` (directives consume CivCap; premium sidebar gating), `economy.md` (a growth tick that doesn't
  exist), `wikios.md` family (sub-2 ms reads with no PHP, Postgres 100% authoritative, trigram search,
  `@wikios/core`), `branding.md` (Stash models, Halo plugins, missing files), `thinktanks.md` (personas and routes
  that don't exist), `ixcredits.md` / `ns-integration.md` (old NS bonus), help `thinkshare.md` (encryption that
  doesn't exist), `maps.md` (algorithm names).

---

## 10. Ponytail (simplification) summary

From [ponytail.md](ponytail.md), dead-code items verified by hand (path, exports, dynamic and string references):

- **~21,100 lines in 134 `src/` files are unreachable** from any production root, plus ~2,300 lines reached only by
  tests. Biggest clusters: the demo-seed service (3,722; its only caller is an archived script with a broken import,
  so the "seed-only" models in the code audit's §8 have no working writer), the intelligence chain (2,668 —
  `calculator.ts`, `engine.ts` and `live-data-transformers.ts` all have zero importers outside the folder ✔),
  `components/analytics` (2,286), `lib/builder/client-calculations.ts` (1,472), `user-analytics` + `recommender`
  (1,433), the home-page trio (1,206).
- **tRPC:** 8 of 961 procedures have no caller, 8 more only from dead files; the `autosaveHistory` router goes whole.
- **Duplication:** 16 patterns with a proposed single home — user lookup by id/Clerk id (13 copies), wiki
  title→slug (85 sites), the `spendByCategory` → `deriveBrokers` loop (6), the "staff = level ≤ 20" rule (7),
  ~40 direct SystemConfig reads.
- **Monoliths:** `audit:arch` fails with 15 files over ceiling; 52 files are 800+ lines; split proposals for the top
  15.
- **Dependencies:** nothing declared is unused, but ~20 packages are imported without being declared (resolve by
  hoisting only: 14 `@turf/*` ✅ declared in #48; `sharp`, `slate-react`, … still undeclared). **`audit:wiring` is broken** by the `minimatch: ^3`
  override (`export 'escape' not found`) ✔.
- **`ponytail:` markers:** 21 fine, 10 to revisit, 5 wrong or moot (e.g. `realms.access.ts` said "share it if a third
  caller appears" — the rule now exists in 7 places).
- **Archive:** `scripts/archive` holds 97 files / 19,488 lines, several unrunnable.

Suggested order: fix the `minimatch` override, then the low-risk deletions (intelligence, analytics,
client-calculations, home-page trio, user-analytics/recommender) with a full non-incremental typecheck after each
batch. Straight deletions total ~24,500 lines in `src/` plus ~19,500 in `scripts/archive`.

---

## Discord audit

Not run. This session has no Discord bot token and the environment's network policy denies `discord.com`
(the proxy reports an organization-policy block). To run it: allow `discord.com` in the environment's network
settings, add a read-only bot token as `DISCORD_BOT_TOKEN`, and start a new session; if the block persists, an org
admin's network policy is overriding the environment setting.
