# Design Specification — MyCountry V2 Promotion & V1 Cleanup

**Date:** 2026-08-08  
**Status:** Approved  
**Topic:** Promoting MyCountry V2 to the sole production surface, removing legacy V1 components, and renaming V2 files to production standards.

---

## 1. Overview & Goal

MyCountry V2 is now feature-complete, highly optimized with `React.memo` and `useMemo`, and fully aligned with the **Directives (UI) / Statecraft (Backend)** architecture.

This specification details the plan to:
1. Promote V2 as the single source of truth in `MyCountryRouter.tsx` (removing temporary `v2` flags).
2. Relocate and rename all components in `src/components/mycountry/v2/` directly to `src/components/mycountry/` with clean production names (dropping temporary `V2` prefixes).
3. Safely delete all obsolete V1 wrapper components and redundant test routes.
4. Clean up `src/components/mycountry/index.ts` exports and update all import sites across the application.

---

## 2. Router & Surface Architecture (`MyCountryRouter.tsx`)

`MyCountryRouter.tsx` will no longer evaluate a `v2` boolean prop toggle. It will directly render `CommandSurface` for all sections.

### Section Handling Strategy
- `overview`: Renders `ExecutiveHome` inside `CommandSurface`.
- `executive`, `economy`, `diplomacy`, `defense`, `politics`, `intelligence`: Render `DomainSurface` inside `CommandSurface`.
- `map-editor`: Navigates cleanly via `CommandSurface` or falls through to `/mycountry/editor`.

### Provider Chain
Retains the single-source-of-truth provider wrapping:
`MobileOptimized > AuthenticationGuard > CountryDataProvider > AtomicStateProvider > CommandSurface`

---

## 3. Component Relocation & Renaming Matrix

All components currently inside `src/components/mycountry/v2/` will be moved to `src/components/mycountry/` and renamed as follows:

| Legacy V2 Path (`src/components/mycountry/v2/`) | Production Path (`src/components/mycountry/`) | Renamed Component Symbol |
| :--- | :--- | :--- |
| `V2CommandSurface.tsx` | `CommandSurface.tsx` | `CommandSurface` |
| `V2Home.tsx` | `ExecutiveHome.tsx` | `ExecutiveHome` |
| `V2MyAgenda.tsx` | `ExecutiveAgenda.tsx` | `ExecutiveAgenda` |
| `V2OpportunityHero.tsx` | `ExecutiveOpportunityHero.tsx` | `ExecutiveOpportunityHero` |
| `V2DomainSurface.tsx` | `DomainSurface.tsx` | `DomainSurface` |
| `V2DomainContext.tsx` | `DomainContextRail.tsx` | `DomainContextRail` |
| `V2DrillSheets.tsx` | `DrillSheets.tsx` | `DrillSheets` |
| `V2IssueDetail.tsx` | `IssueDetailBrief.tsx` | `IssueDetailBrief` |
| `V2ModeToggle.tsx` | `CommandNavToggle.tsx` | `CommandNavToggle` |
| `V2Console.tsx` | `ExecutiveConsole.tsx` | `ExecutiveConsole` |
| `V2Agenda.tsx` | `CommitmentsAgendaRail.tsx` | `CommitmentsAgendaRail` |
| `V2RealtimePulseWidget.tsx` | `RealtimePulseWidget.tsx` | `RealtimePulseWidget` |
| `StandingBands.tsx` | `StandingBands.tsx` | `StandingBands` |
| `ActionCardGraphics.tsx` | `ActionCardGraphics.tsx` | `ActionCardGraphics` |
| `FiscalPolicyConsole.tsx` | `FiscalPolicyConsole.tsx` | `FiscalPolicyConsole` |
| `TradeCommerceConsole.tsx` | `TradeCommerceConsole.tsx` | `TradeCommerceConsole` |
| `ThinkPagesShareModal.tsx` | `ThinkPagesShareModal.tsx` | `ThinkPagesShareModal` |
| `PoliticsDrillDown.tsx` | `PoliticsDrillDown.tsx` | `PoliticsDrillDown` |
| `EconomyDrillDown.tsx` | `EconomyDrillDown.tsx` | `EconomyDrillDown` |
| `domain-meta.ts` | `domain-meta.ts` | `DOMAIN_META` |

After relocation, the empty directory `src/components/mycountry/v2/` will be removed.

---

## 4. Legacy V1 File Deletion List

The following 13 obsolete V1 files will be deleted:

1. `src/components/mycountry/EnhancedMyCountryContent.tsx`
2. `src/components/mycountry/EnhancedExecutiveContent.tsx`
3. `src/components/mycountry/EnhancedDiplomacyContent.tsx`
4. `src/components/mycountry/EnhancedPoliticsContent.tsx`
5. `src/components/mycountry/EnhancedIntelligenceContent.tsx`
6. `src/components/mycountry/EnhancedDefenseContent.tsx`
7. `src/components/mycountry/EnhancedMapEditorContent.tsx`
8. `src/components/mycountry/OverviewHero.tsx`
9. `src/components/mycountry/PillarCards.tsx`
10. `src/components/mycountry/MyCountryTabSystem.tsx`
11. `src/components/mycountry/MyCountrySidebarLayout.tsx`
12. `src/app/mycountry/v2/page.tsx`
13. `src/app/labs/mycountry-v2/page.tsx`

---

## 5. Index Exports & Route Alignment

- **`src/components/mycountry/index.ts`**: Re-export clean production symbols (`CommandSurface`, `ExecutiveHome`, `ExecutiveAgenda`, `ExecutiveOpportunityHero`, `DomainSurface`, `DrillSheets`, `StandingBands`).
- **Route Pages (`src/app/mycountry/**/page.tsx`)**: Update thin page entry points to render `<MyCountryRouter />`.
- **Documentation Updates**: Update `docs/systems/mycountry.md` and `CHANGELOG.md` to reflect production component names.

---

## 6. Self-Review & Verification Plan

- **Placeholder Scan:** No TBD or TODO items.
- **Consistency Check:** Component names and file paths match across imports and exports.
- **Scope Check:** Dedicated single refactoring task focused strictly on MyCountry V2 promotion and V1 cleanup.
- **Verification Commands:** Run `bun run typecheck:ui` and `bun run format:write` to verify clean compilation and formatting.
