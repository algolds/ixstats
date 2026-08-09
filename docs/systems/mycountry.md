# MyCountry Command Suite

**Last updated:** June 2026
**Architecture:** Single-page router with sidebar layout and clear separation of concerns
**Hierarchy:** MyCountry is the flagship Core System within IxStates (IxStats). Its subsystems are organized into 5 groups: Military & Security, Governance & Politics, Economy & Resources, Intelligence & Diplomacy, National Management.

The MyCountry experience gives nation owners a unified command environment. All sections are managed by `MyCountryRouter` for instant SPA-like navigation.

## Single-Page Router Architecture (February 2026)

All 5 `page.tsx` files render `<MyCountryRouter />` identically. The router manages section state via `useState<MyCountrySection>` with URL sync via `window.history.pushState()`.

**Key Files:**

- `src/components/mycountry/MyCountryRouter.tsx` – Central hub; provider chain: MobileOptimized > AuthenticationGuard > CountryDataProvider > AtomicStateProvider
- `src/components/mycountry/MyCountrySidebarNav.tsx` – Dual-mode nav (controlled + uncontrolled)
- `src/components/mycountry/MyCountrySidebarLayout.tsx` – Grid: `lg:grid-cols-4` (1 sidebar + 3 content)

**Sidebar Widgets:**

- `sidebar-widgets/ExecutiveSidebarWidget` – Meetings/policies (amber theme)
- `sidebar-widgets/DiplomacySidebarWidget` – Embassies/relations (cyan theme)
- `sidebar-widgets/DefenseSidebarWidget` – Security/military (red theme)

**Metric Detail Modals:**

- `BaseMetricDetailsModal` with 4-tab system (Overview, Trends, Comparison, Details)
- Available: GDP, Population, Labor, GovernmentSpending, Debt, DemographicsHealth
- Managed by `useMetricDetailsModal` hook in `src/hooks/useMetricDetailsModal.ts`

## Architecture Overview

MyCountry follows a **clear separation of concerns** principle:

- **Monitoring** (Overview) - Real-time snapshot
- **Decision-Making** (Executive) - Command & control
- **Social Interaction** (Diplomacy) - Player-to-player relations
- **Data Analysis** (Intelligence) - Analytics & insights
- **Security Operations** (Defense) - Military readiness

## Subsystem Groups

MyCountry subsystems are organized into 5 groups per the IxStates hierarchy:

| Group                        | Subsystems                                                  | Pages/Routes                                      |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| **Military & Security**      | Defense, Security, Small Arms & Manufacturers               | `/mycountry/defense`                              |
| **Governance & Politics**    | Government, Elections, Policies                             | `/mycountry/executive`, `/mycountry/politics`     |
| **Economy & Resources**      | Economy, Tax System, Resources & Transport                  | (planned: `/mycountry/economy`)                   |
| **Intelligence & Diplomacy** | Intelligence, Diplomacy, Diplomatic WebSocket               | `/mycountry/intelligence`, `/mycountry/diplomacy` |
| **National Management**      | National Issues, Crisis Events, National Identity, Meetings | Executive command suite                           |

## Key Pages & Their Purposes

### 1. National Overview (`/mycountry`)

**Purpose:** Real-time dashboard with current state snapshot

**Components:**

- `src/app/mycountry/page.tsx` – Renders `<MyCountryRouter />`
- `EnhancedMyCountryContent.tsx` – Main dashboard
- `MyCountryTabSystem.tsx` – Tab navigation

**Data Sources:**

- `api.countries.getByIdWithEconomicData` – Current economic data
- `api.countries.getActivityRingsData` – Vitality rings
- `api.government.getComponents` – Atomic government status
- `api.security.getDefenseOverview` – Defense metrics

**UI Elements:**

- Current economic vitals (GDP, population, growth)
- Real-time atomic government component status
- Quick metrics dashboard
- Country header with flag
- Navigation cards (auto-collapse on scroll)
- NO analytics or historical data

### 2. Executive Command (`/mycountry/executive`)

**Purpose:** Executive decision-making, directive drafting, and national leadership functions

**Architecture & Nomenclature Standards:**

- **Frontend (UI)**: **Directives** is the universal user-facing brand across all UI components, buttons, and dialogs (`"Declare Directive"`, `"Tune Custom Directive"`, `"Executive Directives Agenda"`).
- **Backend (Engine)**: **Statecraft Engine** (`src/lib/statecraft-*.ts`, `assemble.ts`, `intent.ts` router) powers intent parsing, power broker alignments, civil capacity throughput, and recon research.

**Key Components & Surface Architecture:**

- `src/app/mycountry/executive/page.tsx` – Executive entry page
- `src/components/mycountry/v2/V2MyAgenda.tsx` – Primary agenda & StandBy Hero (renders 7-day horizon strip, Directives Capacity Pill, and Priority Issues sorted at the very top of the feed)
- `src/components/mycountry/v2/StandingBands.tsx` – Right-rail executive telemetry strip (Approval, Stability, Capacity) with Vitality rings and composite score breakdown modal
- `src/components/mycountry/v2/V2Home.tsx` – Streamlined V2 Executive Home layout housing `<StandingBands />` and `<TerritoryMapWidget />` (interactive MapLibre GL map with hover-activated glass badges) in the right sidebar
- `src/components/mycountry/primitives/IntentComposer.tsx` – Directive drafting widget (64 presets across 8 domain categories + telemetry-reactive "Surprise Me" targeting live deficits)
- `src/components/mycountry/v2/V2IssueDetail.tsx` – Unified 4-branch resolution lifecycle (`1a` Delegate, `1b` Resolve Brief, `1c` Set Cabinet Meeting (+7 days), `1d` Make Directive)
- `src/components/mycountry/v2/V2OpportunityHero.tsx` – Executive Command Spotlight hero prioritizing critical crisis issues

**Performance & Optimization Architecture:**

- All V2 core surfaces (`StandingBands`, `V2MyAgenda`, `V2OpportunityHero`, `DomainActionTiles`, `TerritoryMapWidget`) are wrapped in `React.memo` to prevent unnecessary re-render cascades.
- Internal telemetry calculations, population/GDP formatting, rating labels, and action tile arrays are memoized via `useMemo`.
- Pure helpers (`getRatingLabel`, `getSeverityRank`, `formatCompact`) are extracted outside component scopes with strict return types and explicit prop interface typing.

**Core Features:**

- Priority Issues top-of-list sorting (`statusLabel === "PRIORITY ISSUE"`)
- Translucent Apple-style Civil Capacity (`CivCap`) material capsule bar with `tabular-nums`
- Power Broker & Government Component unlocked package tiers (`broker_unlocked`, `structural_unlocked`)
- Cabinet Meeting scheduling (+7 IxTime days) to bypass weekly slot cooldowns
- Strategic planning and cross-pillar policy tuning

### 3. Diplomacy (`/mycountry/diplomacy`)

**Purpose:** Social interaction hub - all player-to-player relations

**Components:**

- `src/app/mycountry/diplomacy/page.tsx`
- `EnhancedDiplomacyContent.tsx`
- `DiplomacyTabSystem.tsx`

**Tabs:**

1. **Network** - DiplomaticOperationsHub
   - Establish & manage embassies
   - View embassy cards
   - Upgrade embassies
   - Allocate budgets
2. **Missions** - Mission management
   - Start new missions
   - Track active missions
   - Filter by status
3. **Communications** - SecureCommunications
   - Direct messaging with countries
   - Communication history
4. **Events** - DiplomaticEventsHub
   - Active event cards with countdown timers
   - Response system (Accept/Reject/Negotiate)
   - Impact preview visualization
   - Event history log
5. **NPC Intel** - (Placeholder for personality viewer)

**Data Sources:**

- `api.diplomatic.getEmbassies`
- `api.diplomatic.getRelationships`
- `api.diplomatic.getActiveMissions`
- `api.diplomaticScenarios.getAllScenarios` ⭐ NEW
- `api.diplomaticScenarios.recordPlayerChoice` ⭐ NEW

**Key Feature:** 100% social interaction, ZERO analytics

### 4. Intelligence Analytics (`/mycountry/intelligence`)

**Purpose:** Comprehensive data analysis and strategic insights

**Components:**

- `src/app/mycountry/intelligence/page.tsx`
- `EnhancedIntelligenceContent.tsx`
- Intelligence tab system

**Tabs:**

1. **Dashboard** - IntelligenceOverview
   - Key insights and executive summary
2. **Economic** - AnalyticsDashboard
   - GDP charts and projections
   - Sector performance
   - Economic forecasts
3. **Diplomatic** - DiplomaticAnalytics
   - Relationship strength trends (LineChart)
   - Network power growth (AreaChart)
   - Embassy network visualization
   - Influence distribution (PieChart)
   - Diplomatic events timeline
4. **Policy** - PolicyAnalytics
   - Policy effectiveness metrics
   - Atomic component synergy
   - Scenario planning tools
5. **Forecasting** - (Placeholder)
   - Predictive models
6. **Settings** - AlertThresholdSettings
   - Notification configuration

**Data Sources:**

- `api.analytics.*` - Analytics queries
- `api.diplomatic.getRelationships` - For diplomatic analytics
- `api.diplomatic.getRecentChanges` - Timeline data
- `api.diplomatic.getEmbassies` - Network visualization
- `api.government.getComponents` - Policy analysis

**Key Feature:** 100% analytics and data visualization, ZERO social interaction

### 5. Defense Readiness (`/mycountry/defense`)

**Purpose:** Military and security operations

**Components:**

- `src/app/mycountry/defense/page.tsx`
- Defense system components

**Features:**

- Military readiness dashboard
- Defense budget allocation
- Equipment management
- Threat assessment

## Architecture Evolution

### Tectonic Shift (November 2025)

**BEFORE the shift:**

- Intelligence page contained diplomatic operations (mixing analytics with actions)
- Diplomacy embedded analytics charts (DiplomaticIntelligenceHub)
- Confusing overlap between pages

**AFTER the shift:**

- **Intelligence** = 100% analytics and data visualization
- **Diplomacy** = 100% social interaction and relationship management
- Perfect separation of concerns achieved

**Files Modified:**

- Removed `DiplomaticIntelligenceHub` from `DiplomaticOperationsHub.tsx`
- Created `DiplomaticAnalytics.tsx` component (570 lines)
- Created `DiplomaticEventsHub.tsx` component (680 lines)

### Benefits

1. **Clear Mental Model**: Users know exactly where to go
   - Analyze data? → Intelligence
   - Take action? → Diplomacy
2. **No Redundancy**: Eliminated duplicate analytics
3. **Better Performance**: Lighter pages without embedded charts
4. **Easier Maintenance**: Single responsibility per page

## Hooks & Utilities

- `useMyCountryCompliance.ts` – Fetches compliance checks, outstanding actions
- `useUnifiedFlags.ts` – Media and identity assets for display
- `src/app/mycountry/utils` – Data transformers for executive summaries

## Executive Actions

The Executive Command panel exposes **9 actions** with real economic effects, cooldowns, and costs:

| Action                       | Category   | Cooldown | Cost           | Effect                                     |
| ---------------------------- | ---------- | -------- | -------------- | ------------------------------------------ |
| Economic Stimulus Package    | economic   | 48h      | $5,000 budget  | GDP +2-4% (2 IxTime years)                 |
| Population Growth Incentives | social     | 72h      | $3,000 budget  | Population +1-2% (4 IxTime years)          |
| Tax Policy Reform            | economic   | 96h      | $2,000 budget  | GDP growth +1-3% (4 IxTime years)          |
| Diplomatic Mission           | diplomatic | 48h      | $4,000 budget  | Improves global influence (2 IxTime years) |
| Emergency Response Protocol  | emergency  | 24h      | $10,000 budget | Stabilizes crisis, pop & economy           |
| Budget Reallocation          | economic   | 72h      | $1,000 budget  | GDP growth +0.5-1.5% (4 IxTime years)      |
| Infrastructure Project       | economic   | 120h     | $15,000 budget | GDP growth +1-2% (4 IxTime years)          |
| Education Reform             | social     | 168h     | $8,000 budget  | GDP growth +0.5-1% (8 IxTime years)        |
| Healthcare Investment        | social     | 96h      | $10,000 budget | Population +0.5-1% (4 IxTime years)        |

Each action:

- Creates a `StorytellerEffect` record with a computed value (±35% variance on base) that the IxStatsCalculator applies on the next tick.
- Enforces cooldowns tracked via execution history in storytellerEffect records.
- Posts narrative output to ThinkPages via `generateDiplomaticNews` (template varies by category).
- Invalidates relevant MyCountry caches (intelligence, achievements, rankings, dashboard, summary).
- Parameters are sanitized (allowed: `amount`, `duration`, `target`, `scope`, `priority`).

**Router:** `src/server/api/routers/mycountry/actions.ts` — `getExecutiveActions` (query) and `executeAction` (mutation, executiveProcedure).

## Narrative Feed

The **NewsFeedWidget** (`src/components/mycountry/NewsFeedWidget.tsx`) displays player-visible narrative output on the MyCountry dashboard. It queries `api.mycountry.getNewsFeed`, which surfaces `storytellerEffect` records (active or <7 days old) with category-coded icons:

- **diplomatic** (Globe, cyan) — embassy activity, treaties
- **economic** (Landmark, emerald) — GDP/trade effects
- **military** (Swords, red) — defense/security
- **social** (Heart, pink) — population/demographic
- **emergency** (AlertTriangle, amber) — crisis/emergency

The widget shows the 8 most recent items with relative timestamps. Category is resolved by inspecting `inputType` and `description` fields.

## Government Component Effects

**`src/lib/government-component-effects.ts`** wires 56 atomic government components to game state via two outputs:

1. **StorytellerEffect records** — per-category economic modifiers keyed by `CATEGORY_EFFECTS` (10 government categories). Previous `[GovComponent]` effects are deactivated before new ones are created to prevent stacking. The effectiveness multiplier (based on overall component synergy) scales base values between -0.1 and +0.1.

2. **GovernmentStructure political metrics** — `politicalStability`, `democracyIndex`, `governmentEffectiveness`, and `ruleOfLaw` are updated based on which component types are active (e.g. democratic processes boost democracyIndex; autocratic processes reduce it).

Called by `applyGovernmentComponentEffects(db, countryId)` which returns `{ effectsCreated, politicalMetricsUpdated, overallEffectiveness }`.

## Shared Helpers

**`src/server/shared/mycountry-helpers.ts`** (496 lines) was extracted from `dashboard.ts`, `intelligence.ts`, and `actions.ts` on 2026-06-14, eliminating ~900 lines of duplicated code. Lives in `src/server/shared/` following the `layer-cache.ts` pattern so routers can import without cross-router dependencies.

Shared exports:

- `getMyCountryCache<T>(key)` / `setMyCountryCache(key, data, ttl)` — cache helpers wrapping `globalCache`
- `calculateVitalityScores(country)` — computes Economic Vitality, Population Wellbeing, Diplomatic Standing, Governmental Efficiency, and overall score from country data
- `generateIntelligenceFeed(countryId)` — aggregates economic/population intel + db `IntelligenceItem` records (2-min cache)
- `calculateAchievements(countryId)` — milestone-based achievements (5-min cache)
- `generateRankings(countryId)` — GDP per capita and Population rankings (global/regional/tier) (10-min cache)
- `generateMilestones(countryId)` — historical population and economic milestones from `HistoricalDataPoint` (15-min cache)

## Vitality Tracking

Vitality scores are **computed server-side** from authoritative country data — the client never submits scores, preventing fabricated values. `updateVitalityTracking` (`myCountryIntelligenceRouter`) fetches the country, computes `calculateVitalityScores`, and:

- Persists a `VitalitySnapshot` record for each of the 4 vitality areas (ECONOMIC, SOCIAL, DIPLOMATIC, GOVERNANCE).
- Compares against the previous snapshot batch (the 4 records prior to the current insert) to detect significant changes.
- Sends notifications via `notificationHooks` when the overall vitality score shifts by more than 5 points.

The snapshots serve as an auditable time-series of national vitality.

## Actions & Mutations

- Quick actions orchestrated through `src/components/mycountry/QuickActionIntegration.tsx`
- Compliance tasks leverage `api.notifications.acknowledge`

## UI Guidelines

- Follow glass hierarchy (parent shell, section cards, interactive controls)
- Keep metrics grouped: vitality rings, economic indicators, diplomatic status
- Each tab links to help articles (`/help/mycountry/*`)
- Use auto-collapse for navigation cards on scroll

## Future Enhancements

- Government page (`/mycountry/government`) - Atomic component builder
- Economy page (`/mycountry/economy`) - Economic policy tools
- Infrastructure page - Development projects
- Society page - Social policy management

---

**Architecture Version:** Current (IxStates 1.1.1 "Ogma" platform — legacy v2/v2.1 retired)
**Last Major Update:** June 2026
**Status:** Production-ready with single-page router and clear separation of concerns

## Cabinet Meetings & Decisions Subsystem

The Cabinet Meetings & Decisions subsystem coordinates executive-level deliberations, schedules agendas, and implements concrete policy/metric adjustments with audited storyteller consequences.

### Overview

| Feature                     | Description                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Meeting Scheduling          | Players schedule or request cabinet meetings with specific agendas and categories.                                                           |
| Meeting Completion          | Scheduled meetings are finalized by adding notes, moving them from upcoming schedules to past records.                                       |
| Agenda & Calendar Sync      | Finalizing a meeting automatically marks the related `ActivitySchedule` as `"completed"`, clearing it from the user's upcoming daily agenda. |
| Decision Recording          | Completed meetings allow recording specific decisions (Strategic, Budget, Policy, Personnel) with estimated metric effects.                  |
| Decision Implementation     | Pending decisions are executed, applying their modifier rules directly to the nation's stats.                                                |
| Audited Consequence Logging | Implementation applies changes via the unified `CountryEventSpine` to log transactions to the ledger timeline and post news.                 |

### Key Files

**Routers & Engines:**

- `src/server/api/routers/quickactions/meetings.ts` — Core quickactions sub-router managing meeting lifecycles (`completeMeeting`, `createDecision`, `implementDecision`).
- `src/server/api/routers/meetings/proceedings.ts` — Proceedings sub-router managing recorded decisions and outcomes.
- `src/lib/country-event-spine.ts` — Bounded dispatcher applying stats changes, logging to the ledger, and posting news.

**Components:**

- `src/components/executive/MeetingsAndDecisionsPanel.tsx` — Command panel display of scheduled, pending, and past meetings.
- `src/components/executive/MeetingDetailModal.tsx` — Dialog displaying agendas, attendees, and decisions; hosts meeting finalization, custom decision recording forms with metric selectors, and implementation triggers.

### Policy Upkeep, Recalculation, & Reactive Advantages

Active policies consume Civil Service Capacity (CivCap) and accrue ongoing maintenance costs:

- **Dynamic Attribute Derivation**: Custom policies dynamically derive their attributes from their selected **Priority**:
  - Low Priority: Stable risk, consumes `5` CivCap.
  - Medium Priority: Stable risk, consumes `10` CivCap.
  - High Priority: Volatile risk, consumes `15` CivCap.
  - Critical Priority: High-Risk, consumes `25` CivCap.
- **Reactive Policy Advantages**: Policies created in response to an Issue (`crisis_response` or `broker_request` origins) receive a **25% CivCap upkeep discount** and a **15% maintenance cost discount** compared to whole-cloth personal initiatives.
- **Department Verification**: Launching or activating a custom policy requires an active matching department in Politics (e.g. Department of Finance for a fiscal policy).
- **Policy Information Fog**: If Civil Service capacity is over-extended or Government Efficiency is low (<45%), the UI renders warning alerts, and exact numeric effects on custom policies are masked and displayed as qualitative bands (e.g. "Mild Positive", "Strong Negative").
- **Policy Maintenance & Risk Cron**: Running every 6 hours, it debits active policy maintenance costs from the treasury and rolls risk checks for active volatile (8% chance) and high-risk (15% chance) policies to spawn matching domain issues.

## National Issues & Delegation Engine

> **Merged from:** docs/systems/national-issues.md

The National Issues system generates dynamic decisions and events for country owners. Issues appear in a player's inbox based on their country's conditions.

### Key Integration Mechanics

- **Issue Delegation (Don't Intervene)**: Players can delegate non-urgent issues to the civil service. This consumes **15 CivCap** as a temporary reservation cost for **5 game days** (`respondedIxTime` tracking; `DELEGATION_WINDOW_MS` in `player.ts`). Urgent/Crisis/High-severity issues cannot be delegated.
- **Risky Response Gambles**: Response options marked as "Red/Risky" carry a **40% failure chance**. Failing the gamble triggers severe Stability and Public Approval penalties, logged directly in the outcome summary.
- **Party Platform Alignment**: Selecting choices aligned with a political party's ideology increments their polling support by **+3.0%**.
- **Intent ↔ Issues Resistance Rhythm**: Committing a moderate/extreme executive directive (`Intent`) can spawn linked "resistance" issues via `src/lib/intent/resistance.ts`. Two spawn modes, toggled at runtime via `spawnMode` in `data/national-issues-config.json`:
  - `"deterministic"` — linked issue spawns immediately at commit (deduped, respecting cooldown/maxActive).
  - `"probability"` (default) — no direct spawn; the maintenance cron's risk roll boosts mapped-category templates (`INTENT_CATEGORY_TO_TEMPLATE` fixes the category vocabulary so `economy`/`fiscal`/`defense` intents actually match templates).
  - `"off"` — intents never spawn issues.
    Resolving or dismissing linked issues recomputes cached `Intent.progress` (`recomputeIntentProgress`), and a directive cannot be marked `completed` while open linked issues exist.
- **Grounded Issue Generator (focused-first)**: `buildCountrySnapshot` now includes real-data geo (`CountryGeoProfile`), names (capital/largest city, languages, religion, top party, ministers), fiscal/labor, economic profile, diplomatic partners/embassies/events, and live PostGIS `ST_Touches` neighbors (gated by `ISSUES_NEIGHBORS`, 60s memo cache). Template variables resolve to real names (`{{neighborName}}`, `{{allyName}}`, `{{ministerName}}`, `{{capitalCity}}`, `{{dominantClimate}}`, `{{activeIntentGoal}}`, …), and the evaluator adds `count`/`any` ops to the safe JSON tree. Grounded templates (landlocked-port, border incident, ally-trade, legislative gridlock, union strike, drought) use the existing `triggerConditions` JSON — no new template column.

### Overview

| Feature                | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| Template-driven issues | Admin-authored templates with trigger conditions and response options         |
| Lazy evaluation        | Issues are generated on-demand when a player queries their inbox              |
| Consequence engine     | Responses modify country metrics (GDP, stability, approval) via typed effects |
| Follow-up chains       | Issues can trigger follow-up issues based on player choices                   |
| Variable substitution  | Template text dynamically inserts country-specific data                       |
| Severity & urgency     | Issues prioritised by severity (critical/high/medium/low) and urgency score   |

### Key Files

**Engine:**

- `src/lib/national-issues-engine.ts` — Core engine: evaluation, condition matching, country snapshots, variable substitution, force generation
- `src/lib/national-issues-consequences.ts` — Consequence resolver: applies effects to country models
- `src/lib/national-issues/snapshot.ts` — Grounded `buildCountrySnapshot` (geo/names/fiscal/econ/diplomacy data)
- `src/lib/national-issues/neighbors.ts` — Live PostGIS `ST_Touches` neighbor resolution (gated, memoized)
- `src/lib/national-issues-config.ts` — Runtime config incl. `spawnMode` toggle
- `src/lib/intent/resistance.ts` — `spawnIntentResistance` deterministic spawn engine

**Router:**

- `src/server/api/routers/national-issues/` — Split router (`index.ts` merges `engine.ts` + `player.ts` + `templates.ts`; 17+ procedures)

**Components:**

- `src/components/national-issues/IssuesInbox.tsx` — Player inbox for pending issues (legacy surfaces)
- `src/components/national-issues/IssueCard.tsx` — Individual issue card
- `src/components/national-issues/IssueDetailModal.tsx` — Detailed view with response options (legacy surfaces)
- `src/components/national-issues/IssueCountBadge.tsx` — Badge showing pending issue count
- `src/components/mycountry/v2/V2IssueDetail.tsx` — **v2 Issue Brief** surface (recon / respond / dismiss / post-resolve directive CTA)

### API Procedures

**Player Endpoints:** `getMyIssues`, `getIssue`, `markViewed`, `respond` (core player action), `dismiss` (non-urgent, no deadline only), `getPendingCount` (badge count), `getHistory` (paginated), `getConsequences`, `getRecentWorldIssues` (public splash/discovery).

**Admin Endpoints:** `getTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `toggleTemplateActive`, `previewTemplate`, `forceGenerate`, `batchCreateTemplates`, `getGenerationStats`, `triggerEvaluation`.

**Intent linkage:** `intent.getLinkedIssues` (in `src/server/api/routers/intent.ts`) returns issues linked to a directive plus `resolvedCount`/`totalCount`/`progress` — drives the v2 progress bars.

### Issue Lifecycle

```
Template → Evaluation → [pending] → [viewed] → [responded] → Consequences
                                  ↘ [expired]  (deadline passed)
                                  ↘ [dismissed] (player dismissed)
                                  ↘ [auto_resolved] (system)
```

1. **Template authoring**: Admins create `NationalIssueTemplate` records with trigger conditions (JSON expression tree), response options, and consequence definitions
2. **Lazy evaluation**: When `getMyIssues` is called, engine checks if evaluation is due and runs `NationalIssuesEngine.evaluateCountry()` in the background
3. **Country snapshot**: Engine builds snapshot of country's current state (GDP, population, unemployment, inflation, approval, stability)
4. **Trigger matching**: Each active template's trigger conditions evaluated against snapshot
5. **Issue generation**: Matching templates create `NationalIssue` records with substituted text
6. **Player response**: Player picks a response option, triggering `NationalIssuesConsequences.resolveIssue()`
7. **Consequence application**: Effects applied to country models (add/subtract/multiply/set operations)

### Template Schema

**Domains:** `economic`, `political`, `social`, `military`, `diplomatic`, `infrastructure`, `environmental`
**Categories:** `economic`, `diplomatic`, `social`, `governance`, `security`, `infrastructure`
**Severity Levels:** `critical`, `high`, `medium`, `low`

**Consequence Definition:**

```typescript
{
  targetModel: string;     // e.g. "country"
  targetField: string;     // e.g. "adjustedGdpGrowth"
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  effectType?: "immediate" | "gradual";
  durationDays?: number;
}
```

**Response Option:**

```typescript
{
  id: string;
  label: string;
  description: string;
  consequences: ConsequenceDefinition[];
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  triggersFollowUp?: string[];
}
```

### Database Models

| Model                      | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `NationalIssueTemplate`    | Admin-authored templates with trigger conditions and response options |
| `NationalIssue`            | Generated issue instances linked to countries                         |
| `NationalIssueConsequence` | Applied consequences with before/after values                         |
| `IssueGenerationLog`       | Evaluation logs with execution time and issue counts                  |

### Splash Showcase

`getRecentWorldIssues` seeds up to 18 showcase issues across different nations for the guest splash page. Runs idempotently — once seeded, the same showcase issues persist.
