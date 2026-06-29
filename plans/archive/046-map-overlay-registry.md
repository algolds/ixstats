# Plan 046: Declarative Map Overlay Registry

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat b23b953b..HEAD -- src/components/maps/core/MapContainer.tsx src/components/maps/core/IxWorldMap.tsx src/components/maps/core/MapControls.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `b23b953b`, 2026-06-19

## Why this matters

Currently, adding a new map overlay (like diplomatic relations, trade routes, or risk heatmaps) requires manual changes across 4 different files: adding state keys, modifying tRPC hooks, hardcoding controls toggles, and adding rendering branches. 

This plan establishes a pluggable `OVERLAY_REGISTRY` system. Adding an overlay will require only a ~30-line declaration. The controls, tRPC data fetching, and MapLibre GL paint layers will render dynamically based on the active registry definitions, saving developer overhead and standardizing the overlay architecture.

## Current state

- `src/components/maps/overlays/` — Contains existing overlay components (`ChoroplethOverlay.tsx`, `GeopoliticalOverlay.tsx`, `TransportOverlay.tsx`, `RiskHeatmapOverlay.tsx`).
- `src/components/maps/core/MapContainer.tsx` — Manages `overlayVisibility` state using static literal keys and runs hardcoded conditional tRPC query triggers.
- `src/components/maps/core/IxWorldMap.tsx` — Renders the map canvas and toggles overlay layer visibility using hardcoded visual sub-components.
- `src/components/maps/core/MapControls.tsx` — Displays control toggles built from static lists of overlays (`FEATURE_OVERLAYS`, `ANALYTICS_OVERLAYS`).

## Commands you will need

| Purpose   | Command                                                            | Expected on success |
|-----------|--------------------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                                     | exit 0, no errors   |
| Typecheck | `bun run typecheck:file <file-path>`                               | exit 0, no errors   |
| Dev Server| `bun run dev`                                                      | starts successfully |

## Scope

**In scope**:
- `src/lib/overlay-registry.ts` (NEW)
- `src/components/maps/core/MapContainer.tsx`
- `src/components/maps/core/IxWorldMap.tsx`
- `src/components/maps/core/MapControls.tsx`

**Out of scope**:
- Direct modifications to overlay components' internals.
- Changes to the underlying MapLibre GL styles.

## Steps

### Step 1: Create the Overlay Registry
Create a new file `src/lib/overlay-registry.ts`:
1. Define the categories of overlays: `"fill"` (mutually exclusive choropleths), `"feature"` (independent points/lines), and `"analytics"` (heatmaps).
2. Define the `OverlayPluginDefinition` interface:
   ```typescript
   export interface OverlayPluginDefinition {
     id: string;
     label: string;
     category: "fill" | "feature" | "analytics";
     icon?: any;
     defaultVisible?: boolean;
     dataFetcher: (utils: any, variables: any) => Promise<any>;
     paintRules?: Record<string, any>;
     component?: React.ComponentType<any>;
   }
   ```
3. Register all existing overlays (Diplomacy, Transport, Choropleth, Risk) as objects within an exported `REGISTERED_OVERLAYS` array.

**Verify**: `bun run typecheck:file src/lib/overlay-registry.ts` passes.

### Step 2: Refactor Controls UI Toggles
In `MapControls.tsx`:
1. Remove the hardcoded `FEATURE_OVERLAYS` and `ANALYTICS_OVERLAYS` lists.
2. Generate the sidebar toggle lists dynamically by filtering `REGISTERED_OVERLAYS` by category.

**Verify**: Verify that the Map Controls sidebar renders the exact same checklist items and icons.

### Step 3: Dynamic Data Fetching and Paint Expressions
In `MapContainer.tsx` and `IxWorldMap.tsx`:
1. Replace individual hardcoded boolean states with a dynamic `activeOverlayIds: Set<string>` state.
2. In `MapContainer`, loop through active overlays and invoke their `dataFetcher` methods dynamically using a shared React Query/tRPC handler.
3. In `IxWorldMap`, loop through active overlays and apply their `paintRules` directly to MapLibre styles (e.g. updating color scales or opacity transitions dynamically using MapLibre GL expressions) instead of mounting conditional React components.

**Verify**: Test switching overlays in the browser. Confirm that the choropleths, shipping lines, and diplomatic overlays render accurately and switch smoothly.

## Done criteria

- [ ] `bun run lint` returns no errors on modified files.
- [ ] No hardcoded overlay keys remain in `MapContainer.tsx` or `MapControls.tsx`.
- [ ] Adding a new overlay only requires registering a configuration in `overlay-registry.ts`.

## STOP conditions

- If MapLibre GL paint expression changes trigger layer validation crashes or coordinate mismatches, revert to the React component fallback defined in the registry and report back.
