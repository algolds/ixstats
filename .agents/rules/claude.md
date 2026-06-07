---
trigger: always_on
---

# IxStats Project Memory

## Product Vision
- [IxStates Product Vision & Platform Philosophy](project_ixstates_vision.md) — The canonical product philosophy for the platform pillars

## Operations
- [Disk Full → PG Recovery Mode](project_disk_full_pg_recovery.md) — "database system is in recovery mode" = root disk 100% full; diagnose + safe cleanup levers
- [Safe DB schema apply](reference_ixstats_db_apply.md) — use `db push` NOT `migrate dev` (drifted history + ~82-nation prod data); source `.env`, preview diff, push

## Key Architecture Patterns

### MyCountry Single-Page Hub (Feb 2026)
- `MyCountryRouter` - Central hub in `src/components/mycountry/MyCountryRouter.tsx`
  - All page.tsx files render `<MyCountryRouter />` (identical)
  - Manages section state via `useState<MyCountrySection>`
  - URL sync via `window.history.pushState()` (no Next.js route transitions)
  - `popstate` listener for back/forward browser navigation
  - Wraps: MobileOptimized > AuthenticationGuard > CountryDataProvider > AtomicStateProvider
  - Defense section bridges context data to props (different auth pattern)
  - Map editor falls through to `router.push("/mycountry/editor")`
- `MyCountrySidebarNav` - Dual-mode nav (controlled + uncontrolled)
  - Controlled: `activeSection` + `onNavigate` props → renders `<button onClick>`
  - Uncontrolled: no props → uses `usePathname()` + renders `<Link href>`
  - Exports: `MyCountrySection` type, `NAV_ITEMS`, `getSectionFromPathname()`
- `MyCountrySidebarLayout` - Shared grid: `lg:grid-cols-4` (1 sidebar + 3 content)
  - Props: `heroSection`, `sidebarContent`, `alerts`, `children`, `activeSection?`, `onNavigate?`
- All Enhanced*Content have `activeSection?` + `onNavigate?` props passed to layout
- 7 sections: overview, executive, diplomacy, intelligence, defense, politics, map-editor

### Sidebar Widgets (Feb 2026)
- `sidebar-widgets/ExecutiveSidebarWidget` - meetings/policies via tRPC (amber theme)
- `sidebar-widgets/DiplomacySidebarWidget` - embassies/relations via tRPC (cyan theme)
- `sidebar-widgets/DefenseSidebarWidget` - security/military via tRPC (red theme)
- Intelligence page already had inline sidebar (VitalityIndex card)

### Metric Detail Modals
- Base: `BaseMetricDetailsModal` with 4-tab system (Overview, Trends, Comparison, Details)
- All modals take: `isOpen`, `onClose`, `countryId`, `countryName?`
- `useMetricDetailsModal` hook manages open/close state
- Modals wired in `MyCountryTabSystem.tsx` via `openMetricModal()` onClick handlers
- Available: GDP, Population, Labor, GovernmentSpending, Debt, DemographicsHealth

### Component Locations
- MyCountry components: `src/components/mycountry/`
- Sidebar widgets: `src/components/mycountry/sidebar-widgets/`
- Metric modals: `src/components/modals/metric-details/`
- Page files: `src/app/mycountry/*/page.tsx` (all render MyCountryRouter)
- Shared layout: `src/app/mycountry/layout.tsx` (only DevCountryViewProvider)

### Codebase Metrics (Feb 2026)
- tRPC routers: 61 (all registered in appRouter)
- Total endpoints: 927 (477 queries, 450 mutations)
- Prisma models: 206
- Components in src/components/: 645+
- Custom hooks in src/hooks/: 80
- App pages (page.tsx): 124
- Admin pages: 20 (54 admin tsx files total)
- Framework: Next.js 16.1.3, React 19.1.3, Prisma 6.19

## Completed Initiatives
- [ThinkShare Unified Messaging](project_thinkshare_refactor.md) — Full refactor from basic DMs to platform-wide messaging at /messages (Phase 1-3, April 2026)
- [IxStates Rename & Modular Monolith](project_ixstates_rename.md) — Renamed ixstats→ixstates, chose modular monolith over mono/polyrepo, routers grouped by domain (April 2026)

## Active Initiatives
- [Maps↔MyCountry Integration](project_maps_mycountry_integration.md) — tier-0 single-source-of-truth (geography drives the sim); on v2, Phase A schema applied, P-B (de-dup read layer) next
- [WikiOS Initiative](project_wikios_initiative.md) — Modern Next.js frontend replacing MediaWiki UI, lives within IxStats, PlateJS editor, Parsoid backend
- [Forum Integration](project_forum_integration.md) — Native XenForo forum in IxStats, orange theme, hybrid routing, IxnayID SSO planned

### Critical Constraints
- NEVER run `tsc --noEmit` globally (crashes server, 7.2GB RAM)
- NEVER run `npm run typecheck:full` or `npm run check`
- Do NOT run the split typecheck scripts during work either — see [feedback_no_typechecks](feedback_no_typechecks.md); user runs those themselves
- Use `npm run dev` for incremental type checking
- Tailwind CSS v4, React 19, Next.js 16.1.3
