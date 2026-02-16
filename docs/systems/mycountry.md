# MyCountry Command Suite

**Last updated:** February 2026 (v2)
**Architecture:** Single-page router with sidebar layout and clear separation of concerns

The MyCountry experience gives nation owners a unified command environment. As of v2, all sections are managed by `MyCountryRouter` for instant SPA-like navigation.

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

### 3. Diplomacy (`/mycountry/diplomacy`) ⭐ v1.4.1
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
4. **Events** - DiplomaticEventsHub ⭐ v1.4.4
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

### 4. Intelligence Analytics (`/mycountry/intelligence`) ⭐ v1.4.2-1.4.3
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
3. **Diplomatic** - DiplomaticAnalytics ⭐ v1.4.3
   - Relationship strength trends (LineChart)
   - Network power growth (AreaChart)
   - Embassy network visualization
   - Influence distribution (PieChart)
   - Diplomatic events timeline
4. **Policy** - PolicyAnalytics ⭐ v1.4.5 (PENDING)
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

## v1.4.x Architecture Changes

### What Changed in v1.4.2 (November 2025)

**BEFORE v1.4.2:**
- Intelligence page contained diplomatic operations (mixing analytics with actions)
- Diplomacy embedded analytics charts (DiplomaticIntelligenceHub)
- Confusing overlap between pages

**AFTER v1.4.2:**
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

## Future Enhancements (v1.5+)

- Government page (`/mycountry/government`) - Atomic component builder
- Economy page (`/mycountry/economy`) - Economic policy tools
- Infrastructure page - Development projects
- Society page - Social policy management

---

**Architecture Version:** v2
**Last Major Update:** February 2026
**Status:** Production-ready with single-page router and clear separation of concerns
