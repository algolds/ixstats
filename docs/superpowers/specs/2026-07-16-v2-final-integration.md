# Spec: Situation Room V2 Final Integration

This specification details the final visual polish and functionality additions to complete the Situation Room V2 interface:
1. **Ledger Integration**: Merging raw governmental ledger entries (`CountryChangeLog`) directly into the unified News Feed query.
2. **Compact Vitality Rings**: Displaying compact Apple Watch-style health rings representing Economy, Wellbeing, Standing, and Capacity below the main action center widgets.
3. **Connected Layout Toggle**: Lifting the `agendaViewMode` toggle state from the Hero banner to control the grid layout of the action center.

---

## User Review Required

> [!IMPORTANT]
> The layout toggle inside the Hero banner will now switch the dashboard layout dynamically:
> - **Widgets Mode (`"widgets"`)**: Renders `NeedsYou`, `AgendaTree`, and the `CompactVitalityRingsCard` stacked vertically.
> - **Stack Mode (`"stack"`)**: Renders `NeedsYou` and `AgendaTree` side-by-side in a responsive `grid lg:grid-cols-2 gap-4` layout, with the `CompactVitalityRingsCard` spanning the full width underneath.

---

## Proposed Changes

### 1. Database & Router Layer (Ledger Feed Integration)
Modify [dashboard.ts](file:///home/jxsig/projects/ixstats/src/server/api/routers/mycountry/dashboard.ts):
- Update `getCanonFeed` query:
  - Query the `CountryChangeLog` table using Prisma:
    ```typescript
    db.countryChangeLog.findMany({
      where: { countryId: input.countryId },
      orderBy: { createdAt: "desc" },
      take: input.limit,
    })
    ```
  - Map change logs to feed items with `kind: "ledger"`, passing `deltaValue`, `targetField`, and `sourceType` metadata.
  - Sort the combined feed array chronologically.

---

### 2. News Feed UI (Ledger Rendering)
Modify [OverviewSidebarWidget.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/sidebar-widgets/OverviewSidebarWidget.tsx):
- Update the `sourceMeta` helper to handle items of type `"ledger"`.
- Style ledger items as emerald (positive delta) or red (negative delta) cards featuring a `▤` glyph, action details, and dynamic delta badges.

---

### 3. State Management (Layout Toggle Lift)
Modify [SectionShell.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/SectionShell.tsx):
- Add optional `agendaViewMode` and `onAgendaViewModeChange` props.
- Pass these down to the standard `OverviewHero` component.

Modify [OverviewHero.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/OverviewHero.tsx):
- Receive `agendaViewMode` and `onAgendaViewModeChange` as props.
- Remove internal `agendaViewMode` useState.
- Update toggle handlers to invoke the parent callbacks.

Modify [EnhancedMyCountryContent.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/EnhancedMyCountryContent.tsx):
- Declare a state hook `[agendaViewMode, setAgendaViewMode] = useState<"widgets" | "stack">("widgets")`.
- Pass this down to `SectionShell`.
- Conditionally adjust layout:
  - If `"widgets"`: vertical stack.
  - If `"stack"`: side-by-side grid (`grid grid-cols-1 lg:grid-cols-2 gap-4`).

---

### 4. Compact Vitality Rings Card
Modify [EnhancedMyCountryContent.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/EnhancedMyCountryContent.tsx):
- Build a new Client Component `CompactVitalityRingsCard` that imports `createVitalityRingsFromCountry` and renders the 4 circular health rings side-by-side inside a `FacetCard` container.
- Render it directly below the action widgets.

---

## Verification Plan

### Automated Checks
- Verify typescript check on routers and component files:
  ```bash
  bun run typecheck:server
  bun run typecheck:ui
  ```

### Manual Verification
1. Navigate to `/mycountry/v2`.
2. Inspect the **News Feed** in the sidebar: verify both stories and change ledger items (e.g. `▤ Policy enacted`) appear chronologically.
3. Toggle the **Agenda layout switcher** in the hero banner: verify the main action panels transition between vertical list stacking and side-by-side grids.
4. Verify the **National Vitality rings** card renders cleanly under the action center.
