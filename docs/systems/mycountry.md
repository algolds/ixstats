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
│ 1. Header & Actions Strip         │ Compact StateSeal, Name, Leader,   │
│    headers/UnifiedGlassCommandBar │ Primary "Declare Directive" CTA    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 2. Telemetry Standing Bands       │ Approval, Stability, CivCap,       │
│    StandingBands.tsx              │ Vitality Rings; WorldCensusCard    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Main Action Feed               │ Realtime Agenda, Horizon Strip,    │
│    ExecutiveHome.tsx              │ Crisis Priority Hero, Issue Briefs │
├───────────────────────────────────┼────────────────────────────────────┤
│ 4. Domain Command Surfaces        │ Full-page modes for Diplomacy,     │
│    DomainSurface.tsx              │ Defense, Politics, and Economy     │
├───────────────────────────────────┼────────────────────────────────────┤
│ 5. Slide-Over Drill Sheets        │ Deep policy tuning, legislature    │
│    DrillSheets.tsx                │ config, and relations inspection   │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Key Component Architecture
All under `src/components/mycountry/shell/` unless noted.
- `CommandSurface.tsx` – Master viewport wrapper and shell orchestration
- `ExecutiveHome.tsx` – Action-first dashboard housing telemetry and priority issues
- `ExecutiveAgenda.tsx` – 7-day IxTime horizon calendar and commitment tree
- `ExecutiveOpportunityHero.tsx` – Spotlight hero prioritizing critical national crises
- `DomainSurface.tsx` – Specialized domain view for Diplomacy, Defense, Politics, Economy
- `DomainContextRail.tsx` – Contextual KPI trends and event activity logs
- `DrillSheets.tsx` – Slide-over sheets for deep parameter adjustment
- `shared/headers/IssueDetailBrief.tsx` – 4-branch issue resolution brief modal
- `ExecutiveConsole.tsx` – Directive package composer and diff preview console (wraps `shared/primitives/IntentComposer.tsx`)
- `rails/` – Per-domain context rails (`EconomyRail`, `PoliticsRail`, `RelationsRail`, `DefenseRail`)
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

### Civil Service Capacity (CivCap)
- One function computes CivCap: `loadCivCapState` in `src/lib/government/civcap.ts`. The National Issues recon context (`national-issues/player.ts`), the policy recon context (`policies/crud.ts`, served as `policies.getPolicyReconContext`) and the Standing Band all use it.
  - Capacity is `calculateCivilServiceCapacity(currentPopulation, governmentEffectiveness)`. `currentPopulation` is the stored value, which does not progress on its own.
  - Used CivCap is the sum of five things. Government component staff, with 15% relief when the Technocrats broker is satisfied. 20 per in-progress recon. Active **policies** (`Policy.civCapCost`). Executing **directives**. Delegated (dismissed) issues, 15 each for 5 IxTime days.
  - Directives consume CivCap. `intent.commit` stores the package's cost on `Intent.civCapCost`: measured 5, moderate 12, extreme 25, broker 8, structural 10. The cost is held while the directive is `active` and was committed within the last IxTime week (`DIRECTIVE_CIVCAP_WINDOW_MS`). Completing or abandoning it releases the cost early. Directives are still also limited to 3 per IxTime week, with a cooldown. Committing is not blocked when CivCap is short, but over-capacity clouds recon and policy previews.
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
  - It is shown in the MyCountry rail (`WorldCensusCard.tsx`) and in the country profile's prototype layouts (`GlobalPositionRankings.tsx`), which used to show fixed sample ranks. `/leaderboards` is still achievements, not nation stats.
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
