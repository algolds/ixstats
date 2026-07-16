# Spec: Gameplay Action Center Integration (Situation Room V2 Dashboard)

Refine the visual styling, interaction patterns, and layout hierarchy of the V2 Situation Room gameplay elements (Needs You, Your Agenda, Intent Composer) to fully adopt the **Facet Design System**. Integrate in-world **IxTime** dates and relative countdowns to issues to prioritize executive gameplay decisions.

## User Review Required

> [!IMPORTANT]
> The Gameplay Action Center is exclusively active under V2 mode (`/mycountry/v2`). The standard statistics tabs are merged into the public country profile, leaving `/mycountry` focused purely on proactive/reactive leadership tasks.

## Proposed Changes

### 1. Facet Dashboard Layout
Modify the layout structure in [EnhancedMyCountryContent.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/EnhancedMyCountryContent.tsx):
- Wrap `NeedsYou` and `AgendaTree` inside `<FacetCard depth={1} interactive="hover">` to inherit volumetric glass reflection, micro-sheen gradients, and interactive hover scales.
- Nested cards (individual issues and agenda items) will use `depth={2}` or clear border borders to establish high contrast depth layers.

### 2. "Needs You" Alerts with IxTime Deadlines
Modify the `NeedsYou` component inside [EnhancedMyCountryContent.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/EnhancedMyCountryContent.tsx):
- Style each issue as an iOS-style glass notification box with a `border-l-4 border-l-red-500` left accent.
- Incorporate a soft, pulsing ambient warning shadow around critical status badges.
- **Relative & In-World Timers**: For issues with a `deadlineIxTime`, calculate the days remaining (`deadlineReal - Date.now()`) and display a relative countdown (e.g. `"due in 3 days"`) paired with the formatted in-world date (e.g. `"Y1 D142"` via `IxTime.formatIxTime`).
- Ensure hover actions scale the component (`active:scale-[0.99]`) and trigger the Directive Composer pre-filled with the target issue.

### 3. "Your Agenda" Tree Connectors
Modify the `AgendaTree` component inside [EnhancedMyCountryContent.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/EnhancedMyCountryContent.tsx):
- Render root intents as high-level directive rows showing the category and active tier badge (Measured / Moderate / Extreme).
- Create a vertical connection line matching the active tier accent color (e.g., emerald for measured, amber for moderate, red for extreme) originating from the parent card's left margin.
- Render indented child tasks connected by horizontal sub-tracks, complete with state indicator chips (Active, Queued, Completed).

### 4. Intent Composer Refinements
Modify [IntentComposer.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/primitives/IntentComposer.tsx):
- Refine the plain-text goal suggestions and package cards to use Facet container materials, glass borders, and smooth transition animations.
- Suppress or style the duplicate mini-agenda in the composer to avoid layout clutter since the primary AgendaTree resides on the main dashboard.

---

## Verification Plan

### Automated Checks
- Run ESLint to ensure no syntax, formatting, or unused import errors:
  ```bash
  npx eslint src/components/mycountry/EnhancedMyCountryContent.tsx src/components/mycountry/primitives/IntentComposer.tsx
  ```

### Manual Verification
1. Navigate to `/mycountry/v2`.
2. Inspect the **Needs You** container: verify the red accent borders, the presence of the pulsing status indicator, and the dual relative time ("due in X days") + IxTime date tags.
3. Hover over issues and verify the interactive scale effect. Click an issue and confirm the composer bottom-sheet launches pre-populated.
4. Verify the **Your Agenda** tree connectors render with color-coordinated tracks mapping to measured (emerald), moderate (amber), and extreme (red) tiers.
