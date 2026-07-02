# MyCountry v2 — IA, Layout & Component Migration Plan

**Status:** draft for sign-off · **Branch:** v2 · **Target:** ship live gated behind `/mycountry/v2` · **Grounds:** design-bible v2, the labs preview (`/labs/mycountry-v2`), and the 2026-07 Discord feedback (Urcea/Kuhl/Heku on the Intent flow).

> **The one-line thesis (Heku): "Super Abstraction."** Let the backend engines do their thing; make the front end very simple and straightforward. v2 is **not new engines** — it's a thin, opinionated shell over the engines that already exist. Almost everything heavy in today's MyCountry becomes a *drill-down* ("if you really want it"), not a primary surface.

---

## 1. The Intent flow (the core new mechanic)

The feedback converged on a concrete new loop. It is the player-initiated twin of Issues, and it *is* the "Intent as a view over existing engines" resolution from bible v2 §3 — now with a UI.

**Player-facing loop (one screen, one button):**
```
1. State a goal, in plain language.     "Prepare for war with Burgundie"
2. The government returns 3 packages + 2 escapes:
      ◦ Measured   — low impact, easiest for stakeholders/brokers to accept
      ◦ Moderate   — 50/50 impact & acceptance
      ◦ Extreme    — big changes, unlikely to be adopted
      ◦ No action
      ◦ Draft your own package  (unpredictable stat results)
3. Each package SHOWS exactly what it will do — the concrete budget lines
   and policy/government levers it moves. Nothing hidden.
4. Pick one → applied through existing engines → bounded ledger + ThinkPages.
```
Example: *"Prepare for war with Burgundie"* → Measured = raise defense budget one notch + issue a strong statement; Moderate = that + partial mobilization policy; Extreme = sever ties + full mobilization + war-economy policy.

**Hard guardrails (all from the feedback — these are non-negotiable):**
- **≤ 3–4 changes per package**, split across **Budget** and **Government/Policy** — never a wall of effects.
- **Locked levers = all core stats (DECIDED).** Core country statistics (population, GDP, GDP-per-capita, tiers, baseline) can **never** be moved by an intent package — they change **only** by hand via the **Editor**. Packages touch policies and budget lines, never the core stat baseline. Regime type / constitution / monarchy / legislature-dissolution are likewise Editor-only. *"I don't want players absent-mindedly picking option 2 and accidentally abolishing the monarchy."*
- **Weekly cooldown + a cap (DECIDED).** Intents resolve on a **per-IxTime-week** cooldown, plus a hard cap on how many can be in flight — not a daily treadmill (Urcea: "cooldown"; Kuhl: "some cap"). Exact cap number is a tuning value, not a design question.
- **Foreign policy is gated** — FP intents need a *specific* stated target/goal, not vague ones (Urcea).
- **Show-before-commit.** The package renders its diff *before* you sign; measured/moderate/extreme also show projected **stakeholder/broker acceptance** so choice is informed (bible: no surprise penalties).

**Two deeper mechanics the feedback added:**
- **Tree-like dependency.** A resolved intent can unlock/block follow-up intents — decisions branch like a good RPG ("obvious and non-obvious results"). Model: `Intent.parentId` + `unlocks[]`; a resolved intent seeds the next set of suggestions. (Reuses bible v2's optional `parentId` — no full DAG.)
- **Auto-summation → ThinkPages draft.** When an intent chain completes, the spine generates a prose **summation** and drops it into ThinkPages **as a draft** (not auto-published — the player edits/posts). This is the "one intent → narrative out, zero table editing" payoff, made a first-class output.

**How it maps to existing code (reuse, not rebuild):**
- Package assembly = filtered **Policy registry** ([policies/registry.ts](../src/lib/policies/registry.ts)) + **budget deltas** ([government budget models]) — bounded set, so packages can't touch locked levers.
- Apply = existing `createPolicy` / budget mutations, routed through **`recordCountryEvent`** ([country-event-spine.ts](../src/lib/country-event-spine.ts)) → bounded change + ledger + news (already works).
- Acceptance projection = **power-broker** primitives ([statecraft-power-brokers.ts](../src/lib/statecraft-power-brokers.ts)) + whip ([statecraft-whip.ts](../src/lib/statecraft-whip.ts)).
- Summation draft = `generateDiplomaticNews` spine + a small `generateWikiParagraph` (net-new, bible v2 backlog) → ThinkPages draft API.

**New/changed backend:** one `intent` router (`suggest`, `preview`, `commit`, `getTree`), a `Intent` model (goal, tier, changesJson, status, parentId, cooldownUntil), and the summation generator. Everything else is wiring to engines that exist.

---

## 2. v2 Information Architecture (the whole map)

Today: **7 sidebar sections** (overview, executive, diplomacy, intelligence, defense, politics, map-editor), each a `WarRoom` + panels + a deep tab stack. That is the "dashboard-manager / 3-screens" surface the feedback wants gone.

**v2: one home surface, two modes, thin drill-downs.**

```
/mycountry/v2                         (gated route)
│
├── HOME  — "The Command Surface"     ← the labs blend (Briefing × Ticker)
│    ├─ Hero: map/identity (live flag; real IxWorld map can mount later)
│    ├─ Executive morning brief (AI, from bands — no raw numbers)
│    ├─ THE FEED (main column): canon events as Government/World/Press posts
│    │     └─ inline "respond" on reactive items (Issues surface here)
│    └─ Rail: national standing (bands), Declare an intent, the Record (ledger)
│
├── MODE TOGGLE → "Executive"         ← the Console (AI-chatbox Intent flow §1)
│    └─ same live feed as "the record"; measured/moderate/extreme packages
│
└── DRILL-DOWNS (sheets/modals, reached from feed/rail — not top-level nav):
     ├─ Intent detail + dependency tree
     ├─ Policy detail / custom package  (reuse PolicyCreatorSheet/PolicyDetailSheet)
     ├─ Diplomacy: relations + foreign-policy intents  (folds INTO Executive per Urcea)
     ├─ Politics: fiat-friendly config  (parties/elections/legislature — bible §6: player fiat)
     └─ Country Profile = the existing /countries/[slug] page (overview/at-a-glance + deep tabs fold in here)
```

**Nav decisions:**
- **Diplomacy is no longer a top-level section** — it becomes foreign-policy Intents in the feed + a Relations drill-down (Urcea: *"eliminate diplomacy as a separate thing, add it as a sub under executive"*).
- **Intelligence / Defense stop being sections** — Intelligence = the brief + fog; Defense = an intent category + a drill-down. Their analytics move to Profile.
- **Politics stays reachable** but as a **fiat-friendly config surface**, not a WarRoom (bible §6 — Politics is player-defined, sim informs but never overrides).
- **The deep stat tabs move to Country Profile.** MyCountry = *actions*; Profile = *at-a-glance stats* (Heku floated exactly this; Urcea agreed the profile was de-emphasized). This is where Economy/Government/Labor/Overview tabs live.
- **No sidebar section model, no per-section WarRoom, no tab-system.** One navigator (bible Commandment 12), everything ≤1 click.

---

## 3. Component migration table

Legend: **KEEP** (reuse as-is) · **MIGRATE** (adapt into v2 shell) · **DRILL** (demote to a drill-down sheet/modal) · **PROFILE** (move to Country Profile) · **DISCARD** (replaced by v2 home/console) · **DEFER** (out of v2 scope for now)

### Shell & navigation — mostly DISCARD (this is the point)
| Component | Verdict | Note |
|---|---|---|
| `MyCountryRouter` | **MIGRATE** | keep the single-page-router pattern; new content = Home + Executive modes + drill-downs |
| `MyCountrySidebarNav` (533), `MyCountrySidebarLayout`, `MyCountryTabSystem`, `tabs/MyCountryTabsList` | **DISCARD** | v2 has no sidebar-section model or tab shell |
| `Enhanced{Executive,Diplomacy,Intelligence,Defense,Politics,MapEditor,MyCountry}Content` (7) | **DISCARD** | sections collapse into Home/Console/drill-downs |
| `sidebar-widgets/*` (6: Overview/Diplomacy/Defense/Intelligence/Politics/Geography) | **DISCARD** | no sidebar in v2 |
| `executive/ExecutiveWarRoom`, `diplomacy/DiplomacyWarRoom`, `politics/PoliticsWarRoom` | **DISCARD** | replaced by Home feed + Console; salvage their child panels |

### Executive — the Intent/Console core
| Component | Verdict | Note |
|---|---|---|
| `executive/CommandPanel` / `CommandPanelItem` / `ExecutiveItemCard` | **DISCARD** | feed posts replace the command-panel grid |
| `executive/PoliciesAndStrategyPanel`, `MeetingsAndDecisionsPanel` | **DISCARD** as primary | logic folds into Intent packages |
| `executive/PolicyCreatorSheet` (905), `PolicyDetailSheet` (694) | **DRILL** | reused for "draft your own package" + policy inspection |
| `executive/MeetingDetailModal` (660) | **DRILL** | opt-in deliberation (bible §4: meetings are opt-in depth) |
| `executive/CountryChangeLogTimeline` (426) | **KEEP** | the Record/ledger — already in the v2 home rail |
| `national-issues/IssuesInbox`, `IssueCard`, `IssueDetailModal` | **MIGRATE** | Issues now surface *inside the feed*; re-skin cards, keep engine + detail modal |

### Diplomacy — folds into Executive + a Relations drill-down
| Component | Verdict |
|---|---|
| `diplomacy/DiplomacyOverview`, `DiplomaticRelationsList`, `EmbassiesAndRelationsPanel` | **DRILL** (Relations sheet; bands not %) |
| `diplomacy/ForeignPolicy{Panel,CreatorSheet,ProposalsInbox}`, `foreign-policy/*` | **MIGRATE** → FP **Intents** (gated, per Urcea) |
| `diplomacy/Embassy{CreatorSheet,DetailSheet}`, `Alliance*`, `alliances/*` | **DRILL / DEFER** | keep as sheets; alliances deferrable |

### Politics — fiat-friendly config surface (kept, not a WarRoom)
| Component | Verdict |
|---|---|
| `politics/{PartyManager,LegislatureConfig,ElectionSimulator,LegislaturePanel,CabinetPanel,BillsPanel,ApprovalPanel,ParliamentHemicycle}` | **MIGRATE** → one "Politics config" drill-down (player fiat) |
| `politics/PowerBrokersPanel` | **KEEP** | brokers power the Intent acceptance projection |
| `politics/GovernmentMetricsEditor` | **DISCARD** | bible §6: stability is *derived/legible*, not hand-typed |
| `politics/{LegislativeIssues,LegislativePolicies}` | **DEFER** |

### Deep stats — move to Country Profile
| Component | Verdict |
|---|---|
| `tabs/{EconomyTab (725),GovernmentTab (730),LaborTab (644),EconomyLaborTab,OverviewTab}` | **PROFILE** | de-emphasized at-a-glance stats, off the action surface |
| `tabs/{GeographyTab,WikiSectionRow}`, `primitives/tabs/*` (StatGauge, MetricCardGrid, SectorBreakdownCard, InteractiveMetric, PolicyBadgeGrid, VitalityRingsDisplay…) | **KEEP** as Profile building blocks |

### Geography / Map
| Component | Verdict |
|---|---|
| `GeographyContent (514)`, `GeographyMap`, `GeoCompliancePanel`, `GeographyReportModal`, `EnhancedMapEditorContent (723)` | **KEEP** under Map (already its own surface) |

### Primitives & data — KEEP (the building blocks v2 is made of)
| Component | Verdict |
|---|---|
| `primitives/CountryDataProvider`, `useMyCountryUnifiedData (518)`, `AuthenticationGuard` | **KEEP** | v2 home wraps in these |
| `primitives/hero/*`, `OverviewHero`, `CompactSectionHero`, `SectionHero/Shell` | **MIGRATE** | source the v2 hero from these |
| `primitives/VitalityRings`, `EnhancedMetricTooltip`, `InlineWiki`, `LoreScoreBadge`, `CrossPillarBanner`, `ChangedSinceChip` | **KEEP** | rail/feed/profile primitives |
| `primitives/CardImageUpload*`, `CardBackgroundImage`, `cards/*` | **KEEP** | cosmetic layer |
| `VaultWidget` | **KEEP** | rail card |
| `NewsFeedWidget (101)` | **DISCARD** | superseded by the feed |
| `SetupChecklist`, `PopulateFromWikiButton`, `SetupChecklist` | **KEEP** (onboarding) |
| `RollupSettingsModal`, `MyCountryComplianceModal`, `GeoCompliancePanel`, `premium/UpgradeTeaser`, `CountryWireframe`, `SmartStack` | **DEFER / evaluate** | not v2-critical |

**Rough tally:** ~15 DISCARD (shells/nav/warrooms/widgets), ~20 DRILL/MIGRATE (sheets + intent logic), ~12 PROFILE (deep tabs), ~30 KEEP (primitives/engines/data). The engines and routers underneath are untouched.

---

## 4. Build phases (behind `/mycountry/v2`)

1. **Productionize the labs home** — port `/labs/mycountry-v2` to `/mycountry/v2`, wrap in `CountryDataProvider` + `AuthenticationGuard`, source hero from `primitives/hero/*`.
2. **Intent backend** — `Intent` model + router (`suggest`/`preview`/`commit`/`getTree`), package assembly from policy-registry + budget deltas, locked-lever list, cooldown/cap. Apply through the spine.
3. **Console → Intent UI** — replace the demo's static plans with live measured/moderate/extreme packages that render their diff + acceptance bands; wire "draft your own" to `PolicyCreatorSheet`.
4. **Issues into the feed** — re-skin `IssueCard`, surface reactive items inline with respond.
5. **Drill-downs** — Relations sheet (bands), Politics config, Intent dependency tree, Country Profile (deep tabs).
6. **Summation → ThinkPages draft** — chain-complete generator.
7. **Cut over** — when parity is felt, make `/mycountry/v2` the default; keep old routes until confident.

## 5. Decisions (locked 2026-07)
- **Cooldown:** weekly (per IxTime-week) + a hard in-flight cap; FP gated tighter. ✅
- **Locked levers:** all core stats — Editor-only, never touched by intents. ✅
- **Country Profile = reuse the `/countries/[slug]` route.** MyCountry stays action-only; the existing MyCountry **overview / at-a-glance / deep tabs** fold **into the country profile page** (plus anything else that fits there). No separate profile route, no profile tab inside `/mycountry/v2`. ✅
- **Naming/grammar:** use the **design-bible grammar** — the mechanic is an **Intent**, the verb is **Declare** (reactive counterpart stays **Issue**). ✅

### Still open (tuning, not blocking)
- Exact weekly cap number + FP-specific cap.
- Politics fiat boundary: how far a player can override before it affects other players' trust in the shared world.
- Which "anything else that fits" moves from MyCountry into the profile beyond overview/at-a-glance (e.g. rankings, achievements, milestones).
