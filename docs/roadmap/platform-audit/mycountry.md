# MyCountry / Statecraft / Concord: read-only platform audit

Branch `rose-garden`, 2026-09-30. Nothing in the repo was modified. Code is treated as the source of truth; every claim
below cites a path. The code audit rows (MC-1 to MC-21) and SYSTEM_STATUS (audited 2026-09-29) were spot-checked, not
taken on trust. Findings marked **NEW** do not appear in SYSTEM_STATUS, pending-features or code-audit-2026-09-30.

---

## 0. Bottom line

- **The loop is create → project → respond → log. It does not close back into the numbers the player watches.**
  - Creating a country works end to end (builder or wiki prefill).
  - Issues and directives generate, resolve and write a ledger row.
  - But the headline Approval and Stability bands on the Command Surface never read the fields that issues change.
    They show hard-coded fallbacks: 68% approval and 78% stability (**NEW**, section 1.3).
  - GDP and population come from a closed-form projection that ignores 65 of the issue consequences
    (`actualGdpGrowth`, `currentTotalGdp`).
  - Rankings and vitality read stored `current*` fields, which only an admin button refreshes (MC-7).
- **Politics and cooperative diplomacy are dead ends.**
  - No bill can pass, because nothing ever creates a first election (MC-2).
  - Cooperative foreign-policy proposals (free trade, military alliance) can never be accepted: the accept procedure
    was deleted in plan 312 (**NEW**).
- **"Concord" and "Statecraft" are labels, not engines.**
  - Neither has an orchestrating module.
  - `src/lib/statecraft/` is 9 pure helper files (1,260 lines) that import only `~/lib/utils`.
  - "Concord" has no code folder at all: one unused version integer and one admin-nav subtitle.
  - Docs define "Statecraft" five different ways. Recommendation: merge (section 3).
- **Multi-country ownership is already half-modelled.**
  - `Country.ownerUserId`, a per-realm `maxNationsPerUser` cap (default 1, max 20) and an active-nation pointer
    (`User.countryId`) already exist.
  - The builder path blocks it: it creates one country per account, always in the default realm (section 6).

---

## 1. Inventory: what exists

### 1.1 Subsystem status table

| Subsystem | Status (code) | Key paths | Evidence |
|---|---|---|---|
| Command Surface shell | Working | `src/components/mycountry/shell/` (9,097 lines); `src/app/mycountry/*/page.tsx` (5-line wrappers around `MyCountryRouter`) | Renders; data via `CountryDataProvider` → `countries.getByIdWithEconomicData` |
| Standing bands (Approval / Stability / Capacity) | **Broken / fabricated (NEW)** | `shell/StandingBands.tsx:52-70` | See 1.3 |
| Country Builder (create) | Working | `src/app/builder/` (36,925 lines); `countries/management/create.ts` (404) | One `$transaction`, then `assignNation` (`create.ts:365`) |
| Country Editor (edit) | Working, but bypasses guardrails | `src/app/mycountry/editor/page.tsx`; `countries/management/update.ts` | Writes `current*`, growth rates and inflation directly. No spine and no change log (1.4) |
| Wiki import | Working (prefill only) | `builder/components/sections/ImportSection.tsx` (508); `countries.parseInfobox`, `wikiCache.builderDeepScan`; `lib/builder/wiki-data-extractor.ts` | Maps infobox and deep scan into `BuilderState` (`ImportSection.tsx:322-375`). The player still finishes the wizard. It does not create a country by itself |
| Second creation path `users.createCountry` | **Dead (NEW)** | `routers/users/country-linking.ts:22-150` | Zero UI callers (only tests). Duplicates builder creation; the only path that writes a first `HistoricalDataPoint` |
| Stat progression over time | Partial: projection on read only | `lib/economy/calculations.ts` (`IxStatsCalculator`, 667); `countries/economy.ts:101-160, 302-345` | Pop/GDP = f(baseline, `baselineDate`, `adjustedGdpGrowth`, `StorytellerEffect`s). Persisted only by admin `forceRecalculation` (`admin/system.ts:374`). No cron (MC-7). History is synthesised when fewer than 5 points (`economy.ts:136-160`) |
| National Issues | Working for generate / resolve / log | `lib/national-issues/` (2,775); `routers/national-issues/` (1,165); 114 templates, 342 options (`prisma/seeds/national-issue-templates.ts`) | Cron every 30 min for owned countries (`jobs.ts:172`, `generation-cron.ts`). Capped at 5 per week via `data/national-issues-config.json` (a file on disk, not the DB) |
| Issue consequences | Partial | `lib/national-issues/consequences.ts` (550) → `lib/activity/event-spine.ts` (311) | Direct clamped field writes plus `CountryChangeLog`. Most don't reach anything the player sees (1.3) |
| Directives (Intent) | Working | `routers/intent.ts` (425); `lib/intent/` (819) | 3 per IxTime week (`intent.ts:31-33`); packages from the policy registry; resistance issues; budget deltas. The `civCapCost` it computes is display-only: never stored or consumed (**NEW**) |
| Policies | Partial | `routers/policies/crud.ts` (304); `lib/policies/` (1,406) | Create and read only. No repeal or expiry (MC-5). `policy-maintenance` job unsafe to enable (PL-8) |
| CivCap | Partial | `lib/government/atomic-utils.ts:340`; duplicated in `national-issues/player.ts:37-120` and `policies/crud.ts` (MC-21) | Uses stored `currentPopulation`, which does not progress. The "Capacity" band shows directive slots, not CivCap (**NEW**) |
| Recon ("SEE") | Built, off by default | `lib/statecraft/recon.ts`; `nationalIssues.commissionRecon/getReconReveal` | `STATECRAFT_SPINE` defaults false (`lib/gameplay-flags.ts`) |
| Cabinet meetings | Stub (schedule only) | `routers/meetings/` (329); `quickactions/meetings.ts` | No complete / decide mutations |
| Parties / legislature / bills | **Dead end** | `routers/elections/` (481); `legislation.ts` (245); `lib/statecraft/{whip,legislative-vote}.ts` | `election.create` exists only in the follow-up branch of `election-cron.ts:65`. No first election or candidate is ever made. Seats are created without a party (`legislature.ts:158-171`), so `holdVote` always throws (`legislation.ts:162-167`) (MC-2) |
| Elections | Dead (cron runs, resolves nothing) | `lib/government/election-{cron,simulation}.ts` | As above |
| Politics drift | Working | `lib/government/politics-drift-cron.ts` (123) → `component-effects.ts` | Also the only producer of government-component `StorytellerEffect`s |
| Diplomacy: embassies, relations, stances, drift | Working | `routers/diplomacy/` (4,199); `lib/diplomacy/drift-cron.ts` | Embassy missions and upgrades deleted (plan 312). Shared data is synthesised (MC-8) |
| Foreign policy | **Half broken (NEW)** | `diplomacy/policies/foreignPolicy.ts` | Hostile actions apply at once, as `StorytellerEffect` plus relation and trade changes. Cooperative actions (`free_trade`, `military_alliance`) are stored as `proposed` (`:325`) and wait for `respondToForeignPolicyProposal` / `getForeignPolicyProposals`, both deleted in `cc12cf122` (plan 312). They also block re-proposal (`:241-254`) |
| Alliances | Partial | `diplomacy/policies/alliances.ts` | An invite makes the target a member at once (MC-10). Actions and votes exist |
| Cultural exchanges plus NPC responses | Working, over-engineered | `lib/diplomacy/{npc-personality,npc-cultural-participation,markov-engine,cultural-*}.ts` (~5k lines) | The only live NPC behaviour (`predictResponse` called only from `npc-cultural-participation.ts:310`). Drift has no callers. Random percentages in the UI (MC-9) |
| Defense | Premium; mostly stub | `routers/security/` (1,361); `components/mycountry/domains/defense/` (3,867) | No branch or unit authoring (MC-3); PvP never resolves (MC-4); stability inputs faked (MC-13) |
| Intelligence | Fragments | `lib/statecraft/diplo-intel.ts`; `routers/intelligence/` (163, templates only); `lib/intelligence/` (2,266, about 1,480 dead) | `/mycountry/intelligence` renders Defense. Alerts are written but never read (MC-17) |
| Crisis events | Read-only stub | `routers/crisis-events.ts` (117) | Only `getActive` and `getStatistics`; rows come only from the seed |
| Admin "Storyteller" world events | Working GM tool; undocumented in `crisis-events.md` (**NEW**) | `routers/admin/worldEvents.ts` (611) | Admin creates world events that become `StorytellerEffect`s. This is the only functioning "crisis" producer |
| NPC AI | Partial | `lib/diplomacy/npc-personality.ts` (1,511); `routers/npcPersonalities/` (454) | Traits → cultural-exchange responses only. NPC nations take no autonomous action |
| Rankings | Thin | `server/shared/mycountry-helpers.ts:82+` (`generateRankings`) | 2 categories (GDP per capita, population), realm-scoped, from stored non-progressing fields. `/leaderboards` is achievements, not nation stats |
| IxTime | Working | `src/lib/ixtime/` (2,144) | Bot is the source of truth |
| Budget-year fix (MC-1) | Fixed | `lib/government/budget-year.ts`; no `getFullYear()` left in `intent.ts`, `player.ts`, `crud.ts`, `brokers.ts` | Verified |

### 1.2 The core loop, traced

1. **Create.**
   - `/builder` or `/mycountry/builder` → `BuilderRouter` → `countries.createCountry` (`create.ts`).
   - The player gets the one-time new-player bonus, plus the wiki-import bonus whenever `foundationCountry` is set.
   - Creation always lands in `DEFAULT_REALM_ID` (`create.ts:84`).
   - If the user already has an active nation, it silently returns that nation (`create.ts:59-64`).
   - No `HistoricalDataPoint` is written, so every history chart starts on synthesised data (`economy.ts:136-160`).
   - ✅ Works.
2. **Stats over time.**
   - The MyCountry UI shows `getByIdWithEconomicData`, which projects from `baselinePopulation` / `baselineGdpPerCapita`
     at `baselineDate` using `adjustedGdpGrowth` and active `StorytellerEffect`s (`country-helpers.ts:17-36`,
     `calculations.ts:178-240`).
   - Stored `current*` fields (read by rankings, `getCountryDashboard` vitality, `/countries` sort, CivCap, foreign-policy
     impact maths, passive income) are refreshed only by the admin `forceRecalculation`.
   - ⚠️ So there are two sources of truth.
3. **Issues and directives.**
   - Issues are generated from a grounded snapshot (neighbours, ministers, capital) and cooldown-capped. Directives are
     capped at 3 per week.
   - ✅ Works.
4. **Decisions → consequences.** ⚠️ The loop breaks here.
   - Template consequences target, by count: `publicApproval` 259, `totalDebtGDPRatio` 91, `actualGdpGrowth` 61,
     `infrastructureRating` 37, `stabilityScore` 32, …, `currentTotalGdp` 4.
   - `actualGdpGrowth` is read by no progression code. `calculations.ts:99-124` only copies it, and no `.tsx` shows it.
   - `currentTotalGdp` is overwritten by the projection on read and by admin recalculation.
   - `publicApproval` is not what the Approval band shows (see 1.3).
   - Only paths that write `StorytellerEffect` move GDP: foreign policy, operations and conflicts, elections, politics
     drift and component effects, admin world events, policy `effects-sync`. Issue resolution is not one of them.
   - Net result: a player answers an issue, sees a change-log line in `getCanonFeed`, and none of the headline numbers
     move.
5. **Politics.**
   - Parties can be created and the legislature configured.
   - ❌ Seats are never filled, so bills cannot pass and elections never occur.
6. **Diplomacy.**
   - Embassies, stances and drift, and hostile foreign policy work.
   - ❌ Cooperative foreign policy dead-ends (NEW); alliance invites skip consent.
   - Of all these actions, only foreign policy moves GDP. None go through the event spine; only three callers do (1.5).

### 1.3 NEW: the headline bands are fabricated

`src/components/mycountry/shell/StandingBands.tsx`:

```ts
country?.currentPublicApproval ?? country?.approvalRating ?? 68   // :54-56
country?.currentStability ?? country?.stability ?? 0.78           // :62
```

- `country` is the `getByIdWithEconomicData` response (`CountryDataProvider.tsx:79`).
- That response spreads the DB row, whose field is `publicApproval` (`prisma/schema/core.prisma:83`), and adds none of
  the four names the band reads (`economy.ts:217-283`).
- So every player sees Approval 68% and Stability 78%, forever.
- The same fallback pattern appears in:
  - `ExecutiveOpportunityHero.tsx:125` and `ExecutiveActionCards.tsx:147` (stability 0.78);
  - `IntentComposer.tsx:97` (`approvalRating ?? 65`), so its `approval < 50` branch never fires.
- `identity.mappers.ts:45` does map `publicApproval → currentPublicApproval`, but only for the passport.
- The third band, "Capacity" (`:67-70`), is `(3 − directivesUsedThisWeek)/3`. It is not the CivCap
  Allocated / Total that `mycountry.md` and `statecraft-game-loops.md §3` describe.

### 1.4 NEW: the editor is an unlogged stat-edit path

- `countries.updateCountry` (`management/update.ts:70-140`) lets the owner set:
  - `currentPopulation`, `currentGdpPerCapita`, `adjustedGdpGrowth`, `populationGrowthRate`, `inflationRate` and more;
  - with no spine call and no `CountryChangeLog`.
- `intent.ts:7` states directives "can never touch core stats (Editor-only)". So the design deliberately makes the
  Editor the owner of core stats, but that contradicts the PRD's Burg guardrail ("every change logged / bounded").
- Worse, the edits land inconsistently:
  - The edited `current*` values are ignored by the projection, which uses `baseline*`.
  - An edited `adjustedGdpGrowth` retroactively rewrites the whole projected history since `baselineDate`.

### 1.5 Event spine coverage

- `recordCountryEvent` has 3 callers: `intent.ts:270`, `national-issues/consequences.ts:380` and
  `policies/maintenance-cron.ts:268`.
- Nothing else calls it: not the editor, diplomacy, foreign policy, defense, elections, politics drift, meetings or
  admin world events.
- The spine's narrative sink is `lib/diplomacy/news-generator.ts`, which elections and politics drift also use. It is
  domain-generic despite its name.

### 1.6 Smaller NEW items

- `getCountryComponentsStatsData` (`server/shared/country-helpers.ts`) runs `updateMany` writes to activate components
  from inside public queries. This is the same pattern as MC-13.
- Issue-engine settings live in `data/national-issues-config.json`, a file on the server disk. They are not in the DB,
  and not per realm.
- There is no player-facing way to abandon or delete a nation: `management/lifecycle.ts` has only `update`.

---

## 2. Docs vs code

### 2.1 Wrong, stale or overstated

| Doc (file:line) | Claim | Code reality |
|---|---|---|
| `SYSTEM_STATUS.md` MyCountry table, "Politics: parties, legislature, bills, brokers" | ✅ Live | Bills can never pass (MC-2). Should be 🟡 or ⛔ |
| `SYSTEM_STATUS.md` "Elections" | Follow-up elections never resolve | Broader: no first election or candidate is ever created (code-audit §10 already says so; STATUS not updated) |
| `SYSTEM_STATUS.md` "Diplomacy" | ✅ Live | Cooperative foreign policy dead-ends (NEW), alliance invites skip consent (MC-10), shared data synthesised (MC-8), exchange analysis random (MC-9). Should be 🟡 |
| `SYSTEM_STATUS.md` "Economy & fiscal policy" | ✅ Live | No persisted progression (MC-7). History synthesised. Tax sliders (`economics.updateFiscalSystem`) do not feed GDP growth, which comes only from `calculations.ts` inputs. 🟡 |
| `SYSTEM_STATUS.md` "National Issues" | ✅ Live | Generation and resolution are live, but consequences don't reach the bands or GDP (1.2 step 4, 1.3) |
| `SYSTEM_STATUS.md` Concord row "IxTime — Concord v2" | IxTime is versioned under Concord | `VERSIONS.engines.concord` is never read anywhere. It is a doc-only grouping |
| `mycountry.md:4`, `builder.md:6`, `economy.md:6`, `elections.md:6`, `diplomacy.md:6`, `calculations.md:6` | "📀 Gold Master (100% Ready)" | Contradicts SYSTEM_STATUS, which says it replaced the Gold Master matrix. `elections.md` even carries a "Current gap" box under the Gold Master badge |
| `mycountry.md:11` and `:44` | Defense and Map Editor hidden from the sidebar unless the admin teaser is on; "premium gating lives here" (`MyCountrySidebarNav`) | `MyCountrySidebarNav` is imported only as a type (5 files). The component is never rendered (pending-features §2 agrees) |
| `mycountry.md:27` | `StandingBands` = "Approval, Stability, CivCap Bands" | Approval and Stability are hard-coded fallbacks; "CivCap" is directive slots (1.3) |
| `mycountry.md` §CivCap: "Directives and active policies consume CivCap" | Directives consume CivCap | `intent.ts` never stores or consumes `civCapCost`. CivCap sums `policy.civCapCost`, recon and dismissals only (`player.ts:66-69`) |
| `mycountry.md` §Vitality: "Clients cannot forge vitality numbers" | Server-computed vitality | True, but inputs are the stored, non-progressing `current*`. "Diplomatic Standing" reads nonexistent `globalDiplomaticInfluence` / `tradeRelationshipStrength` / etc. via `(country as any)` (`mycountry-helpers.ts:45-53`), so it is always `clamp(50+10+15-5)` = 70. "Governmental Efficiency" is just the economic tier × 0.8 and ignores government entirely |
| `mycountry-design-philosophy-and-prds.md` §2 (~line 45) | "Low efficiency … numeric effects are masked and converted to qualitative bands" | Stated as behaviour; its own status table says it is not built |
| `economy.md` "Core Economic Loops" diagram | Tax → budget → dividend → growth tick loop | There is no growth tick. Tax and budget don't feed growth |
| `buildVersion.ts:57` comment | "10-level undo stack" | `useEditChanges.ts:14` has `MAX_UNDO_STEPS = 50`. SYSTEM_STATUS's 50 is correct |
| `builder.md` Wizard "Preview & Create … assigns the nation to the user" | Implies creation always happens | Silently returns the existing active nation (`create.ts:59-64`) |
| `branding.md:24-26` | MyCountry, Statecraft and Concord are three separate engines | Only `mycountry` and `concord` exist in `VERSIONS.engines`, and neither constant is consumed (see 3) |
| `platform.md:37` | "Nation Builder v4 — Statecraft & Tax Builder Subsystems" | A third meaning of Statecraft. The tax builder UI was removed (SYSTEM_STATUS) |
| `npc-ai.md`, `crisis-events.md` | Already honest ("Partial", "read-only") | OK |

### 2.2 Real things that are undocumented

- The **admin world-events (Storyteller) GM tool** (`admin/worldEvents.ts`, 611 lines). It is the one working crisis
  producer; `crisis-events.md` does not mention it.
- The **foreign-policy consent design** (`COOPERATIVE_FP`, `foreignPolicy.ts:9-11`) and its breakage.
- **`users.createCountry`**: a second, UI-less creation path.
- **The multi-nation ownership model** (`realms.ownership.ts`, `maxNationsPerUser`, `users.setActiveNation`,
  `PlayAsNation.tsx`).
  - Covered in CHANGELOG and the realms spec, but absent from `mycountry.md` and `builder.md`.
  - Neither doc says the builder is default-realm-only and one-per-account.
- **The projection-versus-stored split** for stats. No system doc says which surfaces use which.
- **The issue config file** `data/national-issues-config.json` and the gameplay flags `ISSUES_ENFORCE_DEADLINES` and
  `ISSUES_AWARD_CREDITS` (both default off).
- **`lib/statecraft/stability-formulas.ts`** (535 lines, used by `security/stability.ts`), plus `calendar.ts` and
  `growth-calculations.ts`. Docs list only recon, brokers, whip and diplo-intel.

---

## 3. Concord vs Statecraft

### 3.1 What each is in code

**Statecraft** has five meanings:

1. `src/lib/statecraft/` — 9 files, 1,260 lines. All are pure helpers; the only import is `~/lib/utils`.

   | File | Lines | Importers |
   |---|---|---|
   | `recon.ts` | 141 | `national-issues/player.ts` |
   | `power-brokers.ts` | 116 | 6 importers: policies, brokers, issues, intent, `component-effects`, politics-drift |
   | `whip.ts` | 59 | `legislation.ts` |
   | `legislative-vote.ts` | 102 | `legislation.ts` |
   | `diplo-intel.ts` | 69 | `RelationsRail.tsx`, `DiplomaticRelationsList.tsx` |
   | `foreign-policy.ts` | 108 | `foreignPolicy.ts` |
   | `calendar.ts` | 98 | `ExecutiveAgenda.tsx` |
   | `growth-calculations.ts` | 32 | 3 UI files |
   | `stability-formulas.ts` | 535 | `security/stability.ts` |

2. Docs brand `MYCOUNTRY_ENGINE_VERSION` (= `VERSIONS.engines.mycountry`, 4) as "Statecraft Simulation Engine"
   (`mycountry.md:4`, `economy.md:5`, `elections.md:5`, `defense.md:5`, `intelligence.md:5`, `calculations.md:3`).
3. `branding.md:25`: a separate engine alongside the MyCountry engine. It has no `VERSIONS` key.
4. Admin nav subtitle "Statecraft Engine" (`AdminSidebarNavWidget.tsx:340`): the catalog admin pages (military
   equipment, economic archetypes and components, government components, intelligence templates).
5. Halo category "Statecraft" (`halo-registry.ts:36,80-144`): the user-facing name for all MyCountry routes.

**Concord** has:

- `VERSIONS.engines.concord = 2` (`buildVersion.ts:46`) and the export `CONCORD_ENGINE_VERSION` (`:174`). **Zero
  consumers.** `MYCOUNTRY_ENGINE_VERSION` and `ATLAS_ENGINE_VERSION` are also unconsumed; only `BUILDER_VERSION` is
  rendered.
- Admin nav subtitle "Concord Engine" (`AdminSidebarNavWidget.tsx:295`), covering Storyteller, **National Issues**,
  Diplomatic Options, Diplomatic Scenarios and NPC Personalities.
- Doc headers in `ixtime.md`, `diplomacy.md`, `crisis-events.md` and `npc-ai.md`.
- **No code folder, no module, no orchestrator.** The claimed scope maps to:

  | Claimed scope | Code |
  |---|---|
  | Time | `lib/ixtime` (2,144) |
  | Diplomacy | `lib/diplomacy` (6,623) + `routers/diplomacy` (4,199) |
  | Crises | `crisis-events.ts` (117, read-only) |
  | NPCs | `npc-personality.ts` |

### 3.2 Overlap and contradictions

- **National Issues:** under Concord in the admin nav, under "Statecraft Engine" in `mycountry.md`.
- **Diplomacy:**
  - Concord in `diplomacy.md` and `branding.md`.
  - An arena of the Statecraft loop in `statecraft-game-loops.md §4`.
  - The fog and foreign-policy maths live in `lib/statecraft/` (`diplo-intel.ts`, `foreign-policy.ts`).
- **The loop itself:** IN → SEE → OUT → RIPPLE spans both. Issues ("Concord" per admin) feed directives (Statecraft).
  Hostile foreign policy ("Concord") writes `StorytellerEffect`s consumed by the MyCountry projection. Politics drift
  and elections (Statecraft domain) write narrative through `lib/diplomacy/news-generator.ts` ("Concord").
- **Dependencies:**
  - `lib/activity/event-spine.ts`, `election-simulation.ts` and `politics-drift-cron.ts` all import
    `lib/diplomacy/news-generator`.
  - Diplomacy routers and components import `lib/statecraft`.
  - The crons are flat in `src/server/cron/jobs.ts` with no engine grouping.

### 3.3 Recommendation: merge into one engine, keep "Concord" for the world layer only if it gets real code

The evidence:

- no separate module;
- zero consumers of either version constant;
- mutual imports;
- contradictory doc placement of Issues and Diplomacy;
- the design doc treats domestic, diplomacy and politics as one loop.

All of it supports **one simulation engine**. Concretely:

1. **Retire "Statecraft Engine" as an engine name.** Keep **Statecraft** as the *player-facing brand* for the loop
   (Halo already uses it that way). The engine stays `engines.mycountry`, since "Directives" is already the action
   brand.
   - Alternatively, rename `engines.mycountry` → `engines.statecraft` and drop "MyCountry Engine". Either way: one
     engine, one integer.
2. **Collapse Concord into that engine, or give it a real boundary.** If Concord stays, it should mean only
   **world-scoped, not-player-initiated** simulation: IxTime, NPC agency, crises, world events, drift crons. It should
   then own an actual module (for example `src/lib/world/`, taking `drift-cron`, `npc-personality`, crisis producers,
   `worldEvents`). Today that module would contain almost nothing that works (crises read-only, NPC drift uncalled), so
   **merging now and splitting later if the world layer grows is the lower-cost path.**
3. **Move `lib/diplomacy/news-generator.ts` → `lib/activity/`** (it is the generic narrative sink). Also move
   `lib/statecraft/{diplo-intel,foreign-policy}` into `lib/diplomacy/`, or all of `lib/diplomacy` + `lib/statecraft`
   under one engine tree.
4. **Fix the admin nav:** National Issues belongs with Directives and Policies, not under Concord.
5. **Delete or consume the unused `*_ENGINE_VERSION` constants**, and update `branding.md`, `platform.md` and the doc
   headers in the same pass.

---

## 4. Distance to goal (versus NationStates and a serious political-sim player)

NationStates' core loop:

1. Issues arrive on a clock (1,500+ issues, 3-5 options).
2. The choice shifts roughly 80 census scales immediately and visibly.
3. The nation description text changes.
4. World Census rankings make the stats competitive.
5. Regions and the World Assembly give players a social and political layer: votes, delegates, endorsements.

Gaps, ranked by impact:

| # | Gap | Why it matters | Evidence / size |
|---|---|---|---|
| 1 | **Decisions don't visibly change the nation.** Bands are hard-coded; GDP ignores issue consequences; rankings use stale stored stats | This is the whole NS hook. Without it the loop is a log | 1.2 step 4, 1.3. Fix: bands read `publicApproval` + stability; route issue GDP effects through `StorytellerEffect` (as foreign policy does); a stat-progression job (MC-7). S–M each |
| 2 | **One source of truth for stats** (projection vs stored vs editor) | Every other system (CivCap, rankings, FP maths, vitality, passive income, cards) reads the stale copy | MC-7 plus 1.4. M |
| 3 | **Politics is inert** (no elections, no seated parties, no bills) | Politics is the second arena of the loop and the main differentiator versus NS | MC-2, decision D1. M–L |
| 4 | **No player-to-player consent mechanics** (cooperative FP dead, alliance invite auto-joins, embassy missions deleted) | "Better together" needs handshake interactions; today most diplomacy is unilateral | NEW FP finding plus MC-10. S–M to restore the accept / decline procedure (it existed; see `git show b1749b594`) |
| 5 | **Rankings / census** | NS players compete on scales. Here: 2 categories (GDP per capita, population), and `/leaderboards` is achievements | `mycountry-helpers.ts:82-200`. M: add approval, stability, debt, inequality, infrastructure, etc. from existing fields, with realm and region filters |
| 6 | **Issue depth**: 114 templates, about 3 options each; 5 per week cap | Content runs dry quickly for daily players | `national-issue-templates.ts`. Ongoing content work; the admin template editor exists (`/admin/national-issues`) |
| 7 | **Regional / WA-style layer** | NS's social glue. Realms are worlds, not regions; alliances are the only multilateral body; no region board, delegate or world vote | Alliance actions and votes exist (`alliances.ts:329,394`). Could be extended into realm assemblies. L |
| 8 | **Living world**: no crisis producer, NPCs passive, NPC drift uncalled | Single players need the world to push back | `crisis-events.ts`, `npc-ai.md`. The admin world-events tool could be the seed. L |
| 9 | **Narrative output**: the nation description doesn't change from choices | NS's flavour text is the payoff | `getCanonFeed` exists. Wiki-ready "Chronicle" not built. M |
| 10 | **Defense** (premium) cannot author forces | Premium value is hollow | MC-3, MC-4 |

A serious political-sim player (Democracy 4, Suzerain, Terra Invicta) would also miss:

- a budget that constrains choices: tax rates don't drive growth, and policy costs are debited only by a job that is off;
- coalition formation;
- opinion groups with visible memory (power brokers are close);
- turn or term consequences such as losing an election, whose risk is currently nil.

---

## 5. Taxonomy: does one MyCountry app hold Builder, Statecraft, Issues and wiki import?

**Routing says yes.** `/mycountry/builder` and `/mycountry/editor` both mount `~/app/builder/components/BuilderRouter`.
Issues, directives, politics, diplomacy and defense are sections of `MyCountryRouter`.

**The code tree says no.** It splits along three axes:

- **Builder/Editor lives in `src/app/builder/`** (36,925 lines), not in `components/mycountry`. `/mycountry/builder`
  imports across the app tree (`src/app/mycountry/builder/page.tsx:5`).
- **Government builder UI** is in `src/components/mycountry/domains/government/{atoms,atomic,builder,budget}` (7,335
  lines, the mycountry tree), consumed by `app/builder/.../GovernmentStep.tsx`.
  - Its catalogs are in `src/lib/government/data/`.
  - Synergy logic is in `lib/government/synergy.ts`.
- **Economy builder** is in `src/app/builder/components/enhanced/{EconomyBuilderPage.tsx,tabs/,economy-builder/}`, with
  catalogs in `src/lib/economy/data/` and atomic components in `components/mycountry/domains/economy/`.
- **Tax:**
  - There is no tax builder UI; `useTaxBuilderState` is only a type import in `EconomyBuilderPage.tsx:18`.
  - 42 components live in `lib/government/tax/atomic-tax-components.ts` (1,117 lines), under *government*, not economy.
  - Player tax sliders live in the MyCountry shell (`shell/FiscalPolicyConsole.tsx` + `fiscal/`, via
    `economics.updateFiscalSystem`).
- **Wiki import** is in `src/app/builder/import/` + `builder/components/sections/ImportSection.tsx` +
  `lib/builder/wiki-data-extractor.ts`. It is prefill-only, so it is correctly a Builder sub-feature, not a separate
  app.
- **Issues and directives:**
  - logic in `lib/national-issues`, `lib/intent`, `lib/policies`, `lib/statecraft` and `lib/activity`;
  - UI in `components/mycountry/shell` + `shared/primitives/IntentComposer.tsx`;
  - admin under "Concord".

**Verdict:** the proposed tree works as a *product* tree, and the routes already present it that way. But:

- Builder/Editor should move to `src/components/mycountry/builder/` (or the government builder should move out of
  `components/mycountry/domains/` into the builder), so that one feature lives in one tree.
- "Statecraft engine" and "Issues/Directives" are one thing in code (1.5, section 3). Present them as one "Statecraft"
  feature inside MyCountry rather than two.
- Politics is already a MyCountry section. It only merits being its own feature once it works (MC-2).

---

## 6. Multi-country per account

### 6.1 What the code assumes today

- **Two pointers:**
  - `Country.ownerUserId` (ownership, many per user; `core.prisma:188-189`).
  - `User.countryId` (the *active* "acting as" nation, single; `core.prisma:225,241`). Its relation `"UserCountry"`
    also allows many users per country.
  - `realms.ownership.ts:1-3` is declared the only writer of both.
- **Cap:** `maxNationsPerUser` per realm, in `Realm.settings` (`realms.settings.ts`; default **1**, zod max 20). It is
  enforced in `assignNation` (`realms.ownership.ts:36-41`) and in claims (`realms.claims.ts:282`), and settable by
  admin (`routers/realms/index.ts:188-199`, `RealmsTab.tsx`).
- **Switching:** `users.setActiveNation` (`country-linking.ts:219`) → `activateOwnedNation`. The only UI is
  `src/app/r/[realm]/_components/PlayAsNation.tsx`. The passport realm/nation switcher is unbuilt (pending-features §4).
- **Authorization** is by the active pointer, not ownership: `assertCountryWriteAccess` checks `ctx.user.countryId`
  (`country-authorization.ts:118-127`). To act on a second owned nation, the player must switch first.
- **Builder blocks it:**
  - `createCountry` returns the existing active nation if there is one (`create.ts:59-64`);
  - it always uses `DEFAULT_REALM_ID` (`:84`);
  - the dead `users.createCountry` throws "User already has a linked country".
- **Admin reassignment** releases all of a user's other nations in the same realm (`adminAssignNation`,
  `realms.ownership.ts:83-106`). That hard-codes one per realm.
- **Background jobs are per owned country:** issue generation (`generation-cron.ts`, `ownerUserId: { not: null }`),
  budget rollover and politics drift. N nations mean N issue inboxes.
- **Per-user economy:**
  - Passive income is per user, based on the *active* nation (`passive-income-distribution-cron.ts:61-98`), so a player
    can switch to their richest nation before payout.
  - The onboarding bonus is one-time per user.
  - Directives are capped per country: N nations give 3N per week.
- **Pointer usage count:** 65 `ctx.user.countryId` reads across 36 server files; about 30 client files resolve "my
  country" through `userProfile.countryId` / `useUserCountry` (for example `mycountry/editor/page.tsx:42`,
  `CountryDataProvider.tsx:73`).

### 6.2 What "N per realm" (for example 5) would touch

1. `src/server/modules/realms/realms.settings.ts`: default 1 → N (or per-realm config only).
2. `src/server/api/routers/countries/management/create.ts`: remove the early return; take a `realmId` input; check the
   cap via `assignNation`; make the new nation active (or not) explicitly; realm-aware foundation lookup (`:81-86`).
3. `src/app/builder/**`: realm picker in Foundation (`steps/FoundationStep.tsx`, `lib/builder-theme.ts`), draft keyed by
   realm (`routers/builderDraft.ts`), and a "create another nation" entry point. `mycountry/editor/page.tsx` must
   edit a chosen nation, not only the active one.
4. `src/server/modules/realms/realms.ownership.ts`: `adminAssignNation` must stop releasing same-realm nations.
5. `src/server/modules/realms/realms.claims.ts`: its cap and "never strand first nation" logic.
6. `src/server/shared/country-authorization.ts`: decide whether writes need the active pointer or any owned nation. If
   ownership, check `ownerUserId` (and all 36 server files using `ctx.user.countryId` should be reviewed).
7. `src/hooks/useUserCountry.ts`, `components/mycountry/shared/primitives/CountryDataProvider.tsx`,
   `app/mycountry/editor/page.tsx`: a global nation switcher (nav chip / passport, pending-features §4).
8. `src/server/api/routers/users/country-linking.ts`: delete the dead `createCountry`.
9. Jobs:
   - `lib/economy/passive-income-distribution-cron.ts`: decide per user or per nation, and stop keying it to the active
     nation.
   - `lib/national-issues/generation-cron.ts` and `config.ts`: per-user issue budget.
   - `lib/government/{budget-year-rollover,politics-drift}-cron.ts`: fine as they are, since they are per country.
10. `server/api/routers/intent.ts`: whether the weekly cap is per nation or per account.
11. Premium and ability checks (`lib/auth/ability.ts`, `premiumProcedure`): premium is per user, so all N nations
    inherit it. That is fine, but decide.
12. Rankings and leaderboards (`server/shared/mycountry-helpers.ts`): are they per nation (fine) or per account?
13. Schema: **no change strictly needed.** `User.countryId` is already "active nation" and `ownerUserId` already allows
    many. Optional: a `@@index([ownerUserId, realmId])` on Country for the cap count.

---

## Appendix: key numbers

- Components: `src/components/mycountry` 50,982 lines (domains 23,054; shared 15,531; shell 9,097).
- Builder: `src/app/builder` 36,925 lines.
- Libraries:

  | Folder | Lines |
  |---|---|
  | `lib/economy` | 10,726 |
  | `lib/diplomacy` | 6,623 |
  | `lib/government` | 5,951 |
  | `lib/builder` | 3,151 |
  | `lib/national-issues` | 2,775 |
  | `lib/intelligence` | 2,266 |
  | `lib/ixtime` | 2,144 |
  | `lib/activity` | 1,943 |
  | `lib/policies` | 1,406 |
  | `lib/statecraft` | 1,260 |
  | `lib/intent` | 819 |

- Cron jobs: 17 (`src/server/cron/jobs.ts`), all off unless named in `CRON_ENABLED_JOBS`. None is a stat-progression
  job.
- Issue templates: 114 (social 25, economic 23, diplomatic 19, governance 18, infrastructure 14, security 13, crisis 2).
