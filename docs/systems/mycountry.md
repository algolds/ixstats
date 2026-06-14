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

| Group | Subsystems | Pages/Routes |
|-------|-----------|-------------|
| **Military & Security** | Defense, Security, Small Arms & Manufacturers | `/mycountry/defense` |
| **Governance & Politics** | Government, Elections, Policies | `/mycountry/executive` (planned: `/mycountry/government`) |
| **Economy & Resources** | Economy, Tax System, Resources & Transport | (planned: `/mycountry/economy`) |
| **Intelligence & Diplomacy** | Intelligence, Diplomacy, Diplomatic WebSocket | `/mycountry/intelligence`, `/mycountry/diplomacy` |
| **National Management** | National Issues, Crisis Events, National Identity, Meetings | Executive command suite |

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
**Purpose:** Executive decision-making and leadership functions

**Components:**
- `src/app/mycountry/executive/page.tsx`
- `EnhancedExecutiveContent.tsx`
- Executive panels (Decisions, Meetings, Policies, Plans)

**Features:**
- Executive decisions queue
- Policy approval/rejection
- Meeting scheduling
- Strategic planning
- Crisis response

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

**Architecture Version:** Current (IxStates 1.0.6 "Ogma" platform — legacy v2/v2.1 retired)
**Last Major Update:** June 2026
**Status:** Production-ready with single-page router and clear separation of concerns

## National Issues Engine

> **Merged from:** docs/systems/national-issues.md

The National Issues system generates dynamic decisions and events for country owners. Issues appear in a player's inbox based on their country's economic, political, and social conditions. Responding to issues triggers consequences that modify country metrics.

### Overview

| Feature | Description |
|---|---|
| Template-driven issues | Admin-authored templates with trigger conditions and response options |
| Lazy evaluation | Issues are generated on-demand when a player queries their inbox |
| Consequence engine | Responses modify country metrics (GDP, stability, approval) via typed effects |
| Follow-up chains | Issues can trigger follow-up issues based on player choices |
| Variable substitution | Template text dynamically inserts country-specific data |
| Severity & urgency | Issues prioritised by severity (critical/high/medium/low) and urgency score |

### Key Files

**Engine:**
- `src/lib/national-issues-engine.ts` — Core engine: evaluation, condition matching, country snapshots, variable substitution, force generation
- `src/lib/national-issues-consequences.ts` — Consequence resolver: applies effects to country models

**Router:**
- `src/server/api/routers/national-issues.ts` — 937-line tRPC router with 17 procedures

**Components:**
- `src/components/national-issues/IssuesInbox.tsx` — Player inbox for pending issues
- `src/components/national-issues/IssueCard.tsx` — Individual issue card
- `src/components/national-issues/IssueDetailModal.tsx` — Detailed view with response options
- `src/components/national-issues/IssueCountBadge.tsx` — Badge showing pending issue count

### API Procedures

**Player Endpoints:** `getMyIssues`, `getIssue`, `markViewed`, `respond` (core player action), `dismiss` (non-urgent, no deadline only), `getPendingCount` (badge count), `getHistory` (paginated), `getConsequences`, `getRecentWorldIssues` (public splash/discovery).

**Admin Endpoints:** `getTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `toggleTemplateActive`, `previewTemplate`, `forceGenerate`, `batchCreateTemplates`, `getGenerationStats`, `triggerEvaluation`.

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

| Model | Purpose |
|---|---|
| `NationalIssueTemplate` | Admin-authored templates with trigger conditions and response options |
| `NationalIssue` | Generated issue instances linked to countries |
| `NationalIssueConsequence` | Applied consequences with before/after values |
| `IssueGenerationLog` | Evaluation logs with execution time and issue counts |

### Splash Showcase

`getRecentWorldIssues` seeds up to 18 showcase issues across different nations for the guest splash page. Runs idempotently — once seeded, the same showcase issues persist.
