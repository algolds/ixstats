# IxStates platform audit — 2026-09-30

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

## 1. Verdict

IxStates is large and mostly real: about **650k lines** of app code, **50k lines** of tests (348 files), **961**
tRPC procedures, **332** Prisma models. Several engines are genuinely strong — the MapLibre viewer and topology-aware
border editor, the map import pipelines, the MyLeague simulation, the Onoma language engine, the atomic credit
ledger, IxTime, and the issue/directive generators.

**What stands between it and "a true working NationStates-class platform" is not missing breadth. It is that the
loops don't close, several screens show numbers that aren't true, and the platform account is still shaped around a
single country.** Concretely:

- **A player's decisions don't reach the numbers they watch.** The Command Surface's Approval and Stability bands
  read fields that don't exist and show 68% / 78% for everyone ✔. Issue consequences mostly write fields no
  progression reads; only `StorytellerEffect`s move GDP, and resolving an issue never creates one. Rankings read
  stored stats that only an admin button refreshes. (mycountry §1.2–1.3)
- **Politics and cooperative diplomacy are dead ends.** No first election is ever created, so no bill can pass;
  free-trade and alliance proposals can never be accepted because plan 312 deleted the accept procedure. (mycountry)
- **The social layer posts but doesn't pull people back.** Like/reply/mention notifications are all broken, there are
  no person follows, trending is always empty, and nothing is realm-scoped. (social-core §0, §3)
- **The platform economy is country-bound and leaky.** The dividend, the 5,000 IxC welcome bonus and all 76
  achievements need a country; a player without one earns ~1–60 IxC a day. Entry packs are worth more junked than
  they cost ✔. (vault-identity §1.2–1.3)
- **The "standalone products" are hostname switches.** maps.ixwiki.com is the whole IxStates build; WikiOS renders
  through MediaWiki's copy of every page. Onoma is the one module that could ship on its own soon. (atlas §5,
  wikios-onoma §3–4)
- **The docs overstate.** Many system docs still carry "Gold Master (100% Ready)" badges from an earlier pass;
  SYSTEM_STATUS marks Politics, Diplomacy, Economy, National Issues, Worldgen, ThinkShare and the ledger ✅ Live
  where the code says partial.

The good news is structural: most gaps are wiring, not missing systems. The per-realm nation cap, the
active-nation pointer, the event spine, the Stash service, the media picker, the transport→economy loop and the
IxTwitter bridge already exist and prove the patterns.

---

## 2. Fix now (security and integrity)

Ranked by risk. All are small (S) unless noted.

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | **WikiOS pushes every signed-in user's edit to MediaWiki under one bot account.** Page protection can't be set (WK-3), so every title is editable, including `Template:`, `Module:` and `MediaWiki:` pages. What that reaches depends on the bot's grants. **Check Special:BotPasswords on IxWiki today**, then allowlist editable namespaces server-side. | `routers/wikios/editing.ts:32-43,81+`; `src/env.ts:92` | ✔ code path |
| 2 | **Sending a message joins you to any group or ThinkTank chat**; ThinkTank group ids are public. | `modules/messaging/message-operations.ts:57-68` | ✔ |
| 3 | **Personas can be created for any country** (no ownership check). | `routers/thinkpages/accounts.ts:104-150` | ✔ |
| 4 | **Buy → open → junk mints credits**: five entry packs return 1.01–1.55× their price, uncapped; packs and junking also bypass the ledger (VT-4). | `lib/cards/valuation.ts:48`; `card-packs.json` | ✔ (floors, prices, 5-card packs) |
| 5 | **Viewing a public passport writes an unverified `wikiUsername`** (and a fake `wikiUserId = 1`); Lorewards pays its 2,500 IxC bonus to whoever holds that name. | `identity.service.ts:67-86`; `lorewards/sync.ts:569-576` | report |
| 6 | Users can **self-grant the verified badge** on personas. | `thinkpages/accounts.ts`; `AccountSettingsModal.tsx` | report |
| 7 | Public `messages.searchUsers` returns full user rows (`clerkUserId`, `discordUserId`, `lastSeenAt`); `thinkpages.getPost` ignores visibility. | `messages/participants.ts:127-147`; `posts/queries.ts:132-166` | report |
| 8 | A **real-looking MariaDB password** is committed as a script fallback. Rotate it if it was ever real; remove the fallback. | `scripts/sync-ixwiki-full.ts:35`; `scripts/audit/audit-wikios-parity.ts:31` | report |
| 9 | Public `previewWikitext` lets anonymous users run MediaWiki's parser on 200k characters. | `wikios/editing.ts:59-79` | report |
| 10 | Narrator LLM client has no SSRF guard and silently reuses the sports keys. | `lib/narrator/client.ts` | report |

"✔" = re-checked by hand for this page; "report" = from the area audit, with evidence there.

---

## 3. Scorecard

| App / system | What works | Where the loop breaks | Standalone readiness |
|---|---|---|---|
| **Atlas** (maps, IxWorld) | Viewer, embeds, border/subdivision editor, SVG/PNG whole-map + province + city import, transport network → economy | Worldgen is a Labs demo that freezes the browser and saves nothing; procedural import into a realm likely fails (numeric ids into a string column); geography modifiers are displayed but never read by the economy; every map feature needs a country | Low — same build and DB as IxStates; no user-owned worlds; no GeoJSON/Azgaar import or export; no terrain raster |
| **MyCountry** | Builder (+ wiki prefill), issues and directives generate/resolve/log, politics drift, embassies | Decisions don't move headline stats; two sources of truth for stats; elections/bills inert; cooperative foreign policy can't be accepted; Defense premium is hollow | n/a (the core game) |
| **Vault** | Atomic ledger with locks and idempotency, store (server-priced), pack opening, auctions/trades with escrow, NS import | Credits depend on a country; pack/junk arbitrage; settlement crons off by default; crafting broken; lore gallery hidden in production; fake ribbons | n/a (platform service) |
| **Achievements / Lorewards** | 76 definitions, Lorewards scoring and calendars | Need a country; evaluated only on page visit (the background worker has 0 publishers); not shown on the passport; Lorewards pays via an unverified column | — |
| **IxnayID / Passport** | Identity module, verified wiki/forum links, 5-tab passport, "Play as" | No first-class handle or profile record; personas live in ThinkPages; premium has 3 definitions; not in the version registry or main nav | — |
| **Realms** | Claims, per-realm nation cap, Play-as, realm-scoped map | Builder always uses the default realm; no directory; feed/sports/ThinkTanks ignore realms; geo leaks (terrain sampling, currents, planet scale) | — |
| **WikiOS** | Postgres storage, revisions/history/diff, links, special-page equivalents, Plate editor, Margin | Rendering, templates, Lua, images and uploads are MediaWiki's; edits can render stale; category drift; no rights model, protection, move/delete, edit conflicts | Low — needs a renderer contract, native media, tenancy, auth adapter, XML import/export |
| **Onoma** | Markov naming, IPA, declension, sound shifts, Kokoro bridge; phases match its roadmap | Language packs can't be published | **High** — 8.5k lines with two external imports |
| **Narrator** | Read-aloud (restricted) | LLM narration has no production caller since plan 312 | — |
| **ThinkPages / ThinkShare / ThinkTanks** | Personas, posts, polls, reactions, real-time DMs, ThinkTank feed and roster, IxTwitter bridge | Notifications broken; no follows; can't post as yourself; diplomatic DMs unreachable; ThinkTank chat/docs not surfaced; trending empty | — |
| **MyLeague / MyClub** | 5 sport resolvers + F1, aging, transfers, promotion/relegation, World Cup, franchise claiming | Predictions/rivalries not placeable; create pages 404; no league community; not realm-scoped | Medium — `lib/sports` (9.3k lines) is mostly pure |
| **IxTime** | Clean shared library (91 importers), bot as source of truth | `ixTimeTimestamp` columns hold real time in some writers and game time in others | High |
| **Facet / Halo** | Facet primitives are a true leaf layer; Halo command palette and plugins | Halo imports builder, wiki and tRPC — it's a platform shell, not part of the design system | — |

---

## 4. Cross-cutting patterns

1. **Loops that stop one step short.** Issue → consequence → *stat*; post → *notification*; achievement →
   *background evaluation*; worldgen → *saved world*; auction/trade → *settlement cron (off)*; election → *first
   election*; foreign-policy proposal → *accept*. Each has the first half built.
2. **Two sources of truth.** Projected vs stored country stats; three premium definitions; a heuristic passport
   handle; `ixTimeTimestamp` with two meanings; Clerk ids and internal ids mixed across tables.
3. **Screens that aren't true.** Approval/Stability bands, 3 fake ribbons on every country page, a daily roll that
   promises 10,000 but pays ≤100, a reward multiplier that does nothing, session-only passport privacy switches,
   "connected" wiki whenever you own a country, an empty Trending tab, Diplomatic Standing fixed at 70. The roadmap's
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
| Wiki ↔ Maps embeds (`/maps?embed`, `CountryMapEmbed`, 10 consumers) | ✅ works (but see the maps build error in the bug queue) |
| Transport network → economy (`transport-sync` → StorytellerEffects) | ✅ the one real geography→economy loop |
| Discord ↔ ThinkPages (IxTwitter bridge) | ✅ works; `#thinkpages` mirror has no admin save (WK-10) |
| Forum DMs → ThinkShare; forum SSO | ✅ |
| Stash across WikiOS, Forum, Onoma, Messages, Lore Cards | ✅ (collision bug NEW-10) |
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

This reorders the existing [ROADMAP](../ROADMAP.md) milestones around what the audits found; M0 is done in code.

1. **Fix now** — section 2 (days).
2. **Make it true** (M2's rule, pulled forward): remove or fix every fabricated number and switch listed in
   section 4.3; correct SYSTEM_STATUS and strip "Gold Master" badges from system docs.
3. **Close the MyCountry loop**: bands read real fields; issue GDP effects go through `StorytellerEffect`; one stat
   source of truth with a progression job (MC-7); first elections (MC-2); restore the foreign-policy accept path;
   rankings from existing fields.
4. **Close the social loop**: notifications, follows, trending job, post-as-yourself via an IxnayID "acting-as"
   identity.
5. **IxnayID-first economy**: welcome bonus at account creation, account-level achievements, background
   evaluation, passport showcase, ribbons as real records, lore gallery in production, NS import moved to "one more
   thing", fix pack/junk economics.
6. **Realms as places**: Spaces (ThinkTanks) as realm boards; realm-scoped feed, leagues and geo config; realm-aware
   builder; nation switcher.
7. **Atlas persistence**: saved procedural worlds imported into realms; map features without a country; geography
   feeding the economy; terrain raster.
8. **WikiOS independence track**: render from Postgres wikitext, native media, rights model, then renderer
   contract + XML import/export for other communities.
9. **Products**: Onoma SDK first (smallest lift), then Atlas and WikiOS once their seams exist; MyLeague onto Spaces.

---

## 9. Docs that need correcting

The area reports list each wrong claim with file and line. The most visible:

- "Gold Master (100% Ready)" status headers in `maps.md`, `social.md`, `halo.md`, `ixtime.md` and other system docs.
- `SYSTEM_STATUS.md`: Politics, Diplomacy, Economy, National Issues, Worldgen/procedural pipeline, ThinkShare,
  Accounts, the ledger and the marketplace are rated ✅ Live; the code supports 🟡 Partial.
- `mycountry.md` (directives consume CivCap; premium sidebar gating), `economy.md` (a growth tick that doesn't
  exist), `wikios.md` family (sub-2 ms reads with no PHP, Postgres 100% authoritative, trigram search,
  `@wikios/core`), `branding.md` (Stash models, Halo plugins, missing files), `thinktanks.md` (personas and routes
  that don't exist), `ixcredits.md` / `ns-integration.md` (old NS bonus), help `thinkshare.md` (encryption that
  doesn't exist), `maps.md` (algorithm names).

---

## Discord audit

Not run. This session has no Discord bot token and the environment's network policy denies `discord.com`
(the proxy reports an organization-policy block). To run it: allow `discord.com` in the environment's network
settings, add a read-only bot token as `DISCORD_BOT_TOKEN`, and start a new session; if the block persists, an org
admin's network policy is overriding the environment setting.
