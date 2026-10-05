# 🏛️ MyCountry Suite — Executive Simulation & Governance

**Parent App Suite:** MyCountry Suite (`MYCOUNTRY_VERSION = 6`)  
**Engine:** Statecraft Simulation Engine (`MYCOUNTRY_ENGINE_VERSION = 4`)  
**Primary Action:** `GOVERN` | **Domain Accent:** Amber Gold (`#F59E0B` / `--color-amber-500`)  
**Route:** `/mycountry` | **Status:** see [SYSTEM_STATUS.md](SYSTEM_STATUS.md); the command surface is live, but Politics, Diplomacy, Economy and National Issues are 🟡 Partial (loops below)  

The MyCountry Suite provides sovereign leaders with an executive command environment. Built around the single-page **Command Surface** architecture, it unifies decision-making, foreign relations, macroeconomic planning, and legislative governance into an action-first workflow.

> **Open to every player:** **Overview/Executive**, **Economy**, **Politics**, and **Diplomacy** (`src/lib/auth/ability.ts`).  
> *(**Defense** — which also serves `/mycountry/intelligence` — and the **Map Editor** are premium-gated: locked behind `PremiumPreviewFrame`. The sidebar-hiding rule (hidden for non-premium users unless an admin enables the teaser via `api.admin.getNavigationSettings`) lives in `MyCountrySidebarNav`, which is imported only as a type and never rendered, so that gating is not active.)*

---

## Single Production Command Surface Architecture

MyCountry has fully unified around the single production **Command Surface** (`CommandSurface.tsx`), removing all legacy multi-page tab switches and fragmented war rooms.

```
┌────────────────────────────────────────────────────────────────────────┐
│            COMMAND SURFACE (src/components/mycountry/shell/)           │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. Header (large title)           │ Flag + country name, leader/gov't  │
│    headers/UnifiedGlassCommandBar │ footnote, Profile/Edit, primary    │
│                                   │ "Declare Directive" + slot status  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 2. National Standing (vitals)     │ Population, GDP, Approval,         │
│    StandingBands.tsx              │ Stability, CivCap + 4 vitality     │
│                                   │ rings (full width)                 │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Overview body                  │ Priority hero, agenda inbox,       │
│    ExecutiveHome.tsx              │ recent activity; rail: World       │
│                                   │ Census, Territory map              │
├───────────────────────────────────┼────────────────────────────────────┤
│ 4. Domain Command Surfaces        │ Full-page modes for Diplomacy,     │
│    DomainSurface.tsx              │ Defense, Politics, and Economy     │
├───────────────────────────────────┼────────────────────────────────────┤
│ 5. Slide-Over Drill Sheets        │ Deep policy tuning, legislature    │
│    DrillSheets.tsx                │ config, and relations inspection   │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Overview layout & design (Facet / Apple HIG)
The overview reads top to bottom as one hierarchy, on an 8pt spacing rhythm (24px between cards):
The overview follows the v2 composition (c5c6b382) on the Facet 3.1 identity (spec §16):

1. **Command bar** (`headers/UnifiedGlassCommandBar.tsx`) — the glass hero (`Card variant="hero"`): the MyCountry logo and a quiet toolbar (Profile, Editor with its green glyph; icon-only on phones, 44px targets) with the one gold **Declare Directive** `<Button>`, one line of directive status under it ("N of 3 directives left this week" / "Next directive in …", `intent.getStatus`), then the large title (flag + country name, leader · government type · economic tier · realm). On the overview it lists the four domain tiles (Diplomacy, Defense, Politics, Economy & Budget); on a domain page or in the directive console it becomes a section switcher (`SegmentedControl` or `Tabs`).
2. **Priority** (`ExecutiveOpportunityHero.tsx`) — the one thing most worth the leader's attention, dismissible for the session: a glass hero whose wash, border, glow and badge take the priority's v2 hue (issue/defense red, civil service indigo, directive gold, diplomacy cyan, economy green), with the country's flag watermark and the priority's glyph as a fine watermark, a mono metric pill, and the gold primary.
3. **Agenda** (`ExecutiveAgenda.tsx`) and **Recent activity** (`ExecutiveRecordFeed.tsx`) in the main column.
4. The rail: **National standing** (`StandingBands.tsx` — a gold-rimmed glass card with the flag watermark at v2 strength, the country chip and vitality pill, one opaque telemetry panel: Population (tap for the exact figure), GDP, Approval, Stability, CivCap with its gold meter; then the 2×2 vitality rings that open the breakdown), **World Census**, the **Declare a new Directive** card (gold Command badge; on cooldown a disabled card whose tooltip counts down) and **Territory**.

**Agenda inbox.** The agenda is an inbox, not a calendar. Items are derived from live state (`agenda/deriveAgendaItems.ts`): open national issues (an issue's deadline is folded into its row), active directives and upcoming elections. Each row shows an unread dot and the source glyph, the title (bold while unread), a one-line preview after the source label, and a relative time ("2h ago", from when the item arrived) or deadline pressure ("Overdue", "Due soon", "Upcoming") — never a calendar date, weekday or "today". Urgent items (critical/high issues, urgency over 70, a deadline within two IxDays or past, an election within seven IxDays) carry a flag and form the **Needs action** mailbox. Mailboxes are a `SegmentedControl` — All · Needs action · Issues · Directives · Elections, with counts — showing only mailboxes that have items. Order: overdue, due soon, flagged, then newest. Opening an item (the `AgendaEventActionDialog`: suggested directive, issue brief or details) marks it read; the dialog also offers **Mark as unread**, **Snooze a day**, **Snooze a week** and **Done**, and on touch rows swipe (read/unread right; snooze or done left, full swipe = done). **Mark all as read** sits in the header next to the unread count. Snoozed and done items collapse into a "Show N snoozed and M done" disclosure where they can be moved back to the inbox. Read/done/snooze flags live in this browser per country (`localStorage` key `ixstats:agenda-inbox:<countryId>`, `agenda/inboxState.ts`, synced across tabs); each flag is tied to a version of the item (issue severity + deadline, directive tier, election status + scheduled time), so an item that escalates or moves comes back unread, snoozes expire in real time and come back unread, and flags for items that no longer exist are pruned. A directive you declared starts read; an issue you have viewed on the server starts read. With nothing waiting the card shows **Inbox zero** with Declare Directive.

**World Census.** The rail card shows the five ranks where the nation stands out most (`sortCensusByRelevance`: best rank percentile first, then the better absolute position, then the headline order Total GDP → GDP per capita → Population → Approval → Stability → GDP growth → Diplomatic standing → Infrastructure → Debt → Income equality), as compact plain `FacetRow`s, with the rest behind a **See N more / See less** disclosure (`aria-expanded`, `aria-controls`).

Rules the overview follows:
- **Real data only.** Domain tiles show a real figure when one exists (Politics: stability; Economy: GDP growth from `calculatedStats.gdpGrowth`; Diplomacy: items awaiting an answer) and otherwise a plain description, never a placeholder number. The priority hero skips a card whose figure is missing (defense readiness, embassy counts). The agenda lists only open national issues, active directives and upcoming elections; the fixed sample events it used to show are gone, and an empty inbox says what lands there and offers Declare Directive.
- **Facet primitives, not a local kit.** The command bar and the priority hero are the glass hero (`Card variant="hero"`); everything else (Agenda, Recent activity, World Census, Territory, domain pages, tiles, rows) is an opaque `Card` with `CardHeader`/`CardContent`, and tiles inside a hero use `variant="inset"`. Glass never nests. Actions are `<Button>`; the agenda's mailboxes are a `SegmentedControl`, its rows and the census rows are plain `FacetList`/`FacetRow`s; census ranks, the unread count and ledger deltas are `<Badge>`s; a wiki-parse result is an `<Alert>`. See [facet-design-system.md](../reference/facet-design-system.md).
- **Gold.** Inside `data-app="mycountry"` the plain `<Button>` is the flat gold primary; never hand-roll a `bg-yellow` class. Non-button gold uses `facet-gold` (count pills, meters). Domain hues (`domain-hue.ts`: Diplomacy cyan, Defense red, Politics indigo, Economy green, Directives gold) colour icon badges and glyphs only, next to the domain's glyph and label; there are no glows or per-domain hero washes. Status keeps `STATUS_TEXT` (`status-tone.ts`): critical `text-destructive`, warnings orange. Theme tokens throughout, no `dark:` overrides. Loading states use `<Skeleton>` shaped like the final rows.
- **Identity is the header banner.** The country's flag is the cover art behind the command bar (`PageHeader`'s `backdrop` slot, `headers/FlagBanner.tsx`), under the `shell-banner-scrim` readability scrim (90% page background across the text column, 85% across the action band; opaque under Reduce Transparency and Increase Contrast). It collapses with the header and never reaches the compact bar. There is no watermark or glow elsewhere on MyCountry. Figures use `tabular-nums`; `font-data` is for IDs and codes only. Any decoration is `aria-hidden`, `pointer-events-none`, `print:hidden` and drops its movement under Reduce Motion.
- MyCountry has no private button/card kit: surfaces use the Facet primitives (`Card`, `Button`, `Badge`, `Toggle`, `SegmentedControl`, `Eyebrow`). The old `surface-kit.tsx` was removed.
- **Domain pages and drill sheets follow the same rules.** `DomainSurface.tsx` opens with a `PageHeader`-style title and the gold **Declare a Directive** `<Button>` with a suggested goal; the rails (`rails/shared.tsx`: `RailCard`, `RailRow`, `DomainKpiGrid`, `DomainActivityCard`) are opaque `Card`s with `<Badge>` counts and status colours from `status-tone.ts` (plus `success`). The Economy drill-down, Fiscal Policy and Trade & Commerce consoles render inside `DrillSheets.tsx`; the sheet is the only blurred surface. Sub-tabs use the shared `SectionTabBar`. Tax and tariff sliders keep a small channel colour dot only where it keys the revenue-composition chart.

### Key Component Architecture
All under `src/components/mycountry/shell/` unless noted.
- `CommandSurface.tsx` – Master viewport wrapper and shell orchestration
- `ExecutiveHome.tsx` – Overview body: priority hero, agenda, recent activity, and the rail (national standing, census, directive trigger, territory)
- `ExecutiveAgenda.tsx` – Agenda inbox of open issues, active directives and upcoming elections, with read/done/snooze (`agenda/`: `deriveAgendaItems`, `inboxState`, `AgendaEventActionDialog`)
- `WorldCensusCard.tsx` – World Census rail card: top five ranks by relevance, the rest behind "See more"
- `ActionCardGraphics.tsx` – domain tile watermarks
- `ExecutiveOpportunityHero.tsx` – Spotlight hero prioritizing critical national crises
- `DomainSurface.tsx` – Specialized domain view for Diplomacy, Defense, Politics, Economy
- `DomainContextRail.tsx` – Contextual KPI trends and event activity logs
- `DrillSheets.tsx` – Slide-over sheets for deep parameter adjustment
- `shared/headers/IssueDetailBrief.tsx` – 4-branch issue resolution brief modal
- `ExecutiveConsole.tsx` – The Directives page (`/mycountry/executive`); renders `directives/DirectivesWorkspace.tsx` (see [Directives page](#directives-page-mycountryexecutive))
- `rails/` – Per-domain context rails (`EconomyRail`, `PoliticsRail`, `RelationsRail`, `DefenseRail`)
- `status-tone.ts` – `STATUS_TEXT` (critical / warning / accent / neutral); `domain-hue.ts` – the v2 domain hues as Facet accents (`DOMAIN_HUE`, `HUE_ACCENT`, `hueAccentStyle`, `HUE_BADGE`)
- `MyCountryRouter.tsx` / `MyCountrySidebarNav.tsx` – Single-page section router and nav (the component is not rendered today; only its `MyCountrySection` type is used)

---

## Statecraft Engine & Directives Architecture

A foundational rule of the platform:
- **Frontend (UI)**: **Directives** is the universal user-facing brand across all UI components, buttons, and dialogs (`"Declare Directive"`, `"Tune Custom Directive"`, `"Executive Directives Agenda"`).
- **Backend (Engine)**: The **Statecraft Simulation Engine** (`src/lib/statecraft/*.ts`, `src/lib/intent/*.ts`, `src/server/api/routers/intent.ts`) powers intent parsing, power broker alignments, civil capacity throughput, and recon research.

```mermaid
sequenceDiagram
    participant Player as Leader (Client)
    participant UI as IntentComposer
    participant Router as intentRouter
    participant Engine as Statecraft Engine
    participant Ledger as CountryEventSpine
    participant Feed as Canon Feed / ThinkPages

    Player->>UI: Select Goal & Tune Package (Measured/Moderate/Extreme)
    UI->>Router: intent.commit(goal, package)
    Router->>Engine: Check weekly cap (3 per IxTime week) & cooldown
    Engine->>Ledger: Apply Clamped Stats Modifiers (+ bounded budget deltas)
    Engine->>Engine: Spawn Intent Resistance Issues (deterministic)
    Ledger->>Feed: Change-log rows surface in mycountry.getCanonFeed
    Router-->>Player: Return Committed Intent & Updated Agenda
    Note over Router,Feed: On completion, a ThinkPages summation draft is generated (generateSummationDraft)
```

### Directives page (`/mycountry/executive`)
`CommandSurface` renders `ExecutiveConsole` → `src/components/mycountry/directives/DirectivesWorkspace.tsx`. Top to bottom:
1. **Header** — "Directives", one line on what a directive costs, and **Draft a custom policy** (`PolicyCreatorSheet`).
2. **Status strip** (`DirectiveStatusStrip.tsx`) — weekly slots left (or the IxTime countdown to the next slot, `intent.getStatus`), CivCap available with used/capacity and the directives' share (`policies.getPolicyReconContext`), and how many directives are in force (tap to open that view).
3. **Views** (`Tabs`, with arrow-key roving focus): **New directive**, **In force**, **History**.
   - **New directive** — the composer (`shared/primitives/IntentComposer.tsx`, parts in `shared/primitives/composer/`) as four steps (a "Step n of 4" eyebrow over each card):
     1. *Goal*: search or type a goal, or browse the presets (`composer/directive-presets.ts`, 8 domains) with domain filter toggles (`Toggle`). "Suggest one" picks a preset for the nation's weakest signal (crime → Security, low readiness → Defense, low approval → Social). A custom goal is used as typed; foreign-policy goals are refused by `classifyGoal` and the error is shown with "Change goal".
     2. *Approach*: Measured / Moderate / Extreme, plus Broker deal when the aligned broker is unlocked (`intent.suggest`). Each shows its CivCap cost, acceptance and whether it can raise resistance. The structural tier is not offered (it has no unlock check yet).
     3. *Projected impact*: the levers (budget notches, policy, statement), the stat effects in English with favourable/unfavourable colouring (`lib/intent/consequence-labels.ts`), the GDP level shift phased in over `GROWTH_EFFECT_YEARS` (`suggest` returns `gdpLevelShift` / `gdpEffectYears` per package), stakeholder acceptance, the aligned broker, and a resistance warning for moderate/extreme.
     4. *Review and declare*: goal, approach, CivCap held, available CivCap before → after (warns, but does not block, when it goes over capacity), weekly slots, and the follow-up link (`parentId`). Declare is disabled with the reason when slots are used up or the viewer is looking at another nation.
     After declaring, a confirmation card offers **View active directives**, **Build a follow-up** and **Declare another**. On `/mycountry/executive` the page stays put; when declared from the overview, the surface returns home with a toast.
   - **In force** — every `active` directive, newest first (`intent.getTree`). Each card shows its phase: *Executing* while inside the CivCap window (with the CivCap held and time left) or *In force* after it; a resistance meter (`intent.getLinkedIssues`); and actions: **Follow up**, **Abandon** (confirmation; releases CivCap, not the weekly slot), **Complete** (disabled until linked resistance issues are resolved, as `intent.updateStatus` enforces) and **Record** (the intent drill sheet). "Effects & resistance" expands the recorded effects, the levers pulled, and each resistance issue with a **Respond** button (the issue drill sheet).
   - **History** — completed, abandoned (and any draft) directives, filterable with `Toggle`s, 20 at a time, with the same expandable record and **Declare again**.
- **Visibility.** `intent.getTree` returns every directive (drafts and abandoned included) only to the nation's owner and privileged roles; other players and signed-out visitors get enacted directives only, with the package line items, CivCap and cooldown redacted. `intent.getOutcome` serves an enacted directive's ledger to anyone and any other directive's to the owner only (NOT_FOUND otherwise). Owner/privileged only (FORBIDDEN otherwise, via `assertCountryWriteAccess` / `assertCountryResourceWriteAccess` in `src/server/shared/country-authorization.ts`): every `nationalIssues` player procedure (`getMyIssues`, `getIssue`, `markViewed`, `respond`, `dismiss`, `commissionRecon`, `getReconReveal`, `getPendingCount`, `getHistory`), `intent.suggest`, `intent.getStatus`, `intent.getLinkedIssues` and `policies.getPolicyReconContext` (CivCap). `policies.getPolicies` leaves out `draft` policies for anyone but the owner. "The owner" is the user acting as the nation or its `ownerUserId`; privileged roles (admin, owner, staff, system owner) pass too, which covers the dev "view as" toolbar, and staff "play as" acts as the target user. The public country profile reads `countries.getPublicRecord` (enacted directives and resolved issue outcomes); see `src/app/countries/README.md`. Tested in `src/tests/server/api/routers/country-private-record.test.ts`.
- **Budgets are private.** The budget never reaches anyone but the owner and privileged roles; the rules live in `src/lib/country/public-record.ts` (`redactGovernmentBudget`, `redactEconomicBudget`, `redactMilitaryBranchBudget`, `isBudgetLedgerRow`). Readers that also serve visitors strip it: `government.getByCountryId` / `getFullByCountryId` omit `totalBudget` and return empty allocation, sub-budget and revenue-source lists (offices, leaders, branches, departments and political metrics stay public); `countries.getByIdWithEconomicData` and `mycountry.getCountryDashboard` null `governmentBudget` and `fiscalSystem.spendingByCategory` (the dashboard caches the full record and redacts per caller); `security.getMilitaryBranches` and `getSecurityAssessment` drop branch `annualBudget`/`budgetPercent` (and threats' `resourcesAllocated`); `transport.getNationalMobilityProfile` keeps the network condition but drops `degradation.fundingRatio`/`budgetedMaintenance` (cached per viewer); `diplomaticEmbassies.getEmbassies` / `getEmbassyDetails` show an embassy's `budget`/`maintenanceCost` only to the nation that runs it (the guest). `mycountry.getCanonFeed` leaves out, for visitors, effects and ledger rows tied to a directive that is not public (drafts, abandoned) and ledger rows that move a budget (policy maintenance debits). Owner/privileged only (FORBIDDEN otherwise): `elections.getPowerBrokers` (spend shares by department category), `security.getDefenseBudget`, `government.getCivilServiceStatus`, `government.checkConflicts`, `vault.getBudgetMultiplier` and `vault.calculatePassiveIncome`. Macro factbook figures on the country row (total spending, revenue and balance as a share of GDP, debt, tax rates) and the tax system stay public. Tested in `src/tests/server/api/routers/country-budget-privacy.test.ts`.
- **Recorded effects** come from `intent.getOutcome`: the directive's `CountryChangeLog` rows (`sourceId` = the intent id, with before → after values) and its GDP `StorytellerEffect` (`createdBy: intent:<id>`). The page shows what was recorded, never a re-projection.
- Pure helpers (phases, labels, effect rows) live in `directives/directive-model.ts`; `DIRECTIVE_EXECUTION_WINDOW_MS` there mirrors `DIRECTIVE_CIVCAP_WINDOW_MS` (a test pins them together). The page is built from Facet primitives, not the shell kit: the workspace, status strip, composer steps and empty states are opaque `Card`s and the directive rows, approach options and effect/issue lists are `variant="inset"` cards. Actions are `<Button>` (the MyCountry amber only on the one primary action per surface: **Declare directive**, **View active directives**, **Declare a directive**), statuses `<Badge>`, captions `<Eyebrow>`, meters `<Progress>`, notes `<Alert>`, and Abandon confirms in an `AlertDialog`.

### Civil Service Capacity (CivCap)
- One function computes CivCap: `loadCivCapState` in `src/lib/government/civcap.ts`. The National Issues recon context (`national-issues/player.ts`), the policy recon context (`policies/crud.ts`, served as `policies.getPolicyReconContext`) and the Standing Band all use it.
  - Capacity is `calculateCivilServiceCapacity(currentPopulation, governmentEffectiveness)`. `currentPopulation` is the stored value, which does not progress on its own.
  - Used CivCap is the sum of five things. Government component staff, with 15% relief when the Technocrats broker is satisfied. 20 per in-progress recon. Active **policies** (`Policy.civCapCost`). Executing **directives**. Delegated (dismissed) issues, 15 each for 5 IxTime days.
  - Directives consume CivCap. `intent.commit` stores the package's cost on `Intent.civCapCost`: measured 5, moderate 12, extreme 25, broker 8, structural 10. The cost is held while the directive is `active` and was committed within the last IxTime week (`DIRECTIVE_CIVCAP_WINDOW_MS`). Completing or abandoning it releases the cost early. Directives are still also limited to 3 per IxTime week, with a cooldown: every directive committed in the last IxTime week uses a slot whatever its status now (drafts, `tier: "proposed"`, don't), so abandoning frees CivCap but not the slot. `intent.getStatus` is the one count the header line, status strip, composer and CivCap tooltip read. Committing is not blocked when CivCap is short, but over-capacity clouds recon and policy previews.
- The Standing Bands are Approval (`Country.publicApproval`), Stability (`InternalStabilityMetrics.stabilityScore`) and CivCap. Each shows "—" when its data is missing.
  - The CivCap band shows `used/capacity` and turns red when over capacity.
  - Its tooltip shows what is available, the breakdown, and the directive slots used this week (`intent.getStatus`).
- Reactive policies (created in response to issues or broker requests) receive a **25% CivCap upkeep discount** and **15% maintenance discount**.
- Over-extended CivCap (or government effectiveness below 45%) raises **Information Fog** warnings in the policy creator (`PolicyReconBanner.tsx`: *"Preview estimates may be inaccurate"*, *"Detail Tracking Obscured"*). Numeric effects are not yet masked into qualitative bands.

---

## Grounded Issue Generator & Delegation Engine

The National Issues engine (`src/lib/national-issues/`, `src/server/api/routers/national-issues/`) generates real-time decisions:

1. **Focused Grounding**: `buildCountrySnapshot` (`country-snapshot.ts`, `neighbors.ts`) resolves live PostGIS `ST_Touches` neighbors, active cabinet ministers, capital city, and trade partners to dynamically inject real names (`{{neighborName}}`, `{{ministerName}}`, `{{capitalCity}}`) into issue templates.
2. **4-Branch Issue Brief Resolution**:
   - `1a. Delegate`: `nationalIssues.dismiss` — consumes 15 CivCap to hand off non-urgent issues to the civil service for 5 IxTime days.
   - `1b. Resolve Brief`: Direct action picking one of the evaluated response options.
   - `1c. Set Cabinet Meeting`: `quickActions.createMeeting` schedules a cabinet meeting on next week's agenda.
   - `1d. Make Directive`: Promotes the issue directly into the `IntentComposer` to draft a formal national directive.
3. **Intent ↔ Issues Resistance Rhythm**: Committing extreme directives can spawn linked resistance issues, requiring leaders to manage political pushback before completing national goals.
4. **Consequences** (`src/lib/national-issues/consequences.ts`): approval, stability and the other `Country` / `GovernmentStructure` / `InternalStabilityMetrics` fields are written through `CountryEventSpine` (bounded, logged to `CountryChangeLog`); `publicApproval` and `stabilityScore` land in the columns the Standing bands read. When the country has no `InternalStabilityMetrics` row yet, a stability consequence first creates it from the stability formula (`ensureInternalStabilityMetrics`, `src/lib/statecraft/stability-store.ts`), and the Defense panel's recalculation carries event deltas forward instead of overwriting them (see [defense](./defense.md)). GDP, GDP-growth and population consequences become StorytellerEffects the economy projection applies (see [calculations](./calculations.md#level-effects-national-issue-consequences-and-directives)) and so move the headline GDP; consequences with no faithful mapping are dropped from the log and the recon preview.

### Issue visibility

A nation's issues are its private inbox. Every `nationalIssues` player procedure (`getMyIssues`, `getIssue`, `markViewed`, `getPendingCount`, `getHistory`, `commissionRecon`, `getReconReveal`, `respond`, `dismiss`) and `intent.getLinkedIssues` answers only the nation's owner (the user acting as the nation, or `Country.ownerUserId`) and privileged roles (admin, owner, staff, system owner). Another player gets FORBIDDEN, a signed-out caller UNAUTHORIZED, and a missing issue or intent NOT_FOUND. `countryId` inputs go through `assertCountryWriteAccess`; `id` inputs load the row's `countryId` and go through `assertCountryResourceWriteAccess` (`src/server/shared/country-authorization.ts`). Every consumer is an owner surface (the MyCountry shell, drill sheets, executive panels, `useNationalIssues`, the dashboard widget, and the profile's owner-only count strip). Visitors read resolved outcomes (decision and outcome text, no consequences, response options or open issues) through `countries.getPublicRecord`. Tested in `src/tests/server/api/routers/national-issues-visibility.test.ts`.

---

## Cabinet Meetings Subsystem

- Scheduling via `src/server/api/routers/quickactions/meetings.ts` (`createMeeting`, which also writes an `ActivitySchedule` row) and `src/server/api/routers/meetings/` (`createMeeting`, `getMeetings`, `addAgendaItem`, `recordAttendance`, officials). UI: `src/components/executive/actions/MeetingScheduler.tsx`.
- Meetings are **schedule-only today**: the complete/decide/implement mutations were deleted as zero-caller procedures (plans 312/332), so meeting outcomes are not yet recorded or routed through the `CountryEventSpine`.

---

## Vitality Tracking & Governance Ledger

- **Server-Side Computation**: `src/server/shared/mycountry-helpers.ts` computes the four vitality scores. Clients cannot forge them. `calculateVitalityScores` (used by `mycountry.getCountryDashboard` and `getNationalSummary`) and `countries.getActivityRingsData` (used by the Standing Band rings) share the Diplomatic Standing and Governmental Efficiency helpers.
  - **Economic Vitality** and **Population Wellbeing** come from GDP per capita, growth, population growth and density. `getActivityRingsData` uses projected stats; the dashboard endpoints use the stored `current*` values, which do not progress on their own.
  - **Diplomatic Standing** (`scoreDiplomaticStanding`, tunables in `DIPLOMATIC_STANDING_WEIGHTS`) comes from the diplomatic record.
    - The base is the mean `DiplomaticRelation.strength`, or 50 when the country has no relations.
    - Bonuses: +2 per active embassy hosted or held abroad (capped at 20), +5 per active alliance membership (capped at 15), +3 per active or ratified `Treaty` naming the country's id (capped at 15).
    - Penalty: −8 per active embargo, sanction or blockade received (capped at 40). Alliance collective sanctions count through the per-member actions they create.
    - The result is clamped to 0–100. It is null (shown as "—") when the country has no relations, embassies, alliances, treaties or hostile actions.
    - The stored `Country.diplomaticStanding` column is no longer read; no gameplay writes it.
  - **Governmental Efficiency** is `GovernmentStructure.governmentEffectiveness`, which national issues and the government builder move. It is null without a government structure. The stored `Country.governmentalEfficiency` is no longer shown.
  - The overall score averages only the known scores. Rings with no data show "—", never 0.
- **World Census (rankings)**: `generateRankings` (`mycountry.getRankings`, cached for 10 minutes) ranks the country among nations in its **own realm** that have population and GDP.
  - There are ten categories: GDP per capita, total GDP, GDP growth, population, public approval, stability, diplomatic standing, infrastructure, debt-to-GDP and income equality (Gini). Lower is better for debt and Gini.
  - Each category gives realm, region and tier positions, a percentile and the country's value. A country with no value for a category is left out of that ranking. A trend is given only for the GDP and population categories.
  - The census uses stored values, so it moves when decisions change stored stats (approval, debt, infrastructure, stability) or diplomacy.
  - It is shown in the MyCountry rail (`WorldCensusCard.tsx`) and on the public country profile as its Country DNA (percentile radar and rank rows, via `useCountryProfileLayer`; see `src/app/countries/README.md`). `/leaderboards` is still achievements, not nation stats.
- **Trend History**: Trend charts read `HistoricalDataPoint` rows (`api.historical.getCountryHistory`). The `VitalitySnapshot` model exists but nothing writes it yet.
- **Country Change Log**: Stat changes routed through `CountryEventSpine.recordCountryEvent` (`src/lib/activity/event-spine.ts` — issues, intents, policy maintenance) are written to `CountryChangeLog` and surfaced on the overview via `mycountry.getCanonFeed` ("Burg's Guardrail"). Not every mutating action goes through the spine yet.

---

## Multi-nation ownership and other notes

- Ownership is realm-scoped (`src/server/modules/realms/realms.ownership.ts`). An account may own several nations. Per realm the limit is `min(realm cap, tier cap)`: the realm's `maxNationsPerUser` (default 1), and 1 for free accounts or 5 for MyCountry Premium (`realms.nation-cap.ts`). The builder, claims and admin assignment all enforce it. The builder founds nations in a chosen realm (see [builder](./builder.md#realm-and-nation-cap)). An admin assignment no longer releases the player's other nations in that realm.
- `User.countryId` is the nation the player acts as. It is switched with `users.setActiveNation`: "Play as" on `/r/[realm]`, the nation switcher in the nav user menu, or the owner's passport Realms tab (`NationSwitcher`, fed by `realms.myNations`). Country writes checked by `assertCountryWriteAccess` accept any nation the player owns, not only the active one. `countryOwnerProcedure` routes still act on the active nation, and some routers still compare `ctx.user.countryId` directly.
- The daily dividend is paid once per account from its primary nation (the earliest-created nation it owns), never from the active one (`src/lib/vault/dividend-nation.ts`).
- `users.createCountry` (`users/country-linking.ts`, marked legacy) is a second creation path with no UI.
- Two gameplay flags default off: `ISSUES_ENFORCE_DEADLINES` and `ISSUES_AWARD_CREDITS`. Issue content comes from `data/national-issues-config.json`.
- Stat surfaces mix projections and stored values: MyCountry shows the projection, while rankings, vitality and passive income read the stored `current*` columns. The `stat-progression` cron job persists the projection into those columns (see [economy](./economy.md)); until it is enabled in `CRON_ENABLED_JOBS` they move only on the admin recalculation.
- Other statecraft code: `src/lib/statecraft/stability-formulas.ts` (used by `security/stability.ts`), `calendar.ts` and `growth-calculations.ts`.

---

## Related Documentation

- [Design Philosophy & Statecraft PRDs](./mycountry-design-philosophy-and-prds.md)
- [Community Feedback Audit](./community-feedback-audit.md)
- [Economic Calculations Guide](./calculations.md)
- [Diplomacy System Guide](./diplomacy.md)
- [API Reference: MyCountry & Intent Routers](../reference/api-complete.md#operations)
