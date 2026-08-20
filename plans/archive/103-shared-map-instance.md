# Plan 103: Shared Map Instance Across IxStates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45463d52..HEAD -- src/components/maps/core/IxWorldMap.tsx src/components/maps/editor/EditorMap.tsx src/components/maps/widgets/CountryMapEmbed.tsx src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts src/app/layout.tsx`
> If any in-scope file changed since this plan was written (commit 45463d52), compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `45463d52`, 2026-06-30

## Why this matters

Currently, new MapLibre `Map` instances are initialized and destroyed on navigating between pages (`/maps`, `/mycountry/map-editor`) or loading/unloading embeds (widgets on dashboard, wiki infoboxes, etc.). This leads to:
1. **WebGL Context Crashes**: Browsers limit active WebGL contexts per page (usually 8–16). Recreating maps frequently leads to context loss.
2. **Re-loading Performance Penalty**: Reloading map styles and raw GeoJSON sources over the wire on every mount is slow and consumes bandwidth.
3. **Flicker**: Visual loading screens and blank canvases appear during transitions.

By refactoring the maps to use a single globally persistent MapLibre instance that reparents its DOM element dynamically, we preserve WebGL memory, achieve instantaneous page/widget transitions, and avoid downloading separate GeoJSON files for widgets.

## Current state

The three main places instantiating `maplibre-gl` are:

1. **`IxWorldMap.tsx`** — core full world map renderer:
   - File: [IxWorldMap.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/core/IxWorldMap.tsx#L244-L281)
   - Code snippet:
     ```typescript
     // Initialize MapLibre Map instance
     useEffect(() => {
       if (!containerRef.current || mapRef.current) return;
       let cancelled = false;
       async function initMap() {
         try {
           const mod = await import("maplibre-gl");
           // ...
           const map = new maplibregl.Map({
             container: containerRef.current,
             style: buildBaseStyle(theme, projectionMode) as maplibregl.StyleSpecification,
             // ...
           });
           mapRef.current = map;
     ```

2. **`useCountryMapEmbedLayers.ts`** — country widgets layer builder:
   - File: [useCountryMapEmbedLayers.ts](file:///home/jxsig/projects/ixstats/src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts#L32-L60)
   - Code snippet:
     ```typescript
     const initMap = useCallback(async () => {
       if (!state.containerRef.current || !state.geometry) return;
       const maplibregl = (await import("maplibre-gl")).default;
       // ...
       const map = new maplibregl.Map({
         container: state.containerRef.current,
         style: baseStyle,
         center: initialCenter,
         zoom: 3,
         attributionControl: false,
         interactive,
       });
       state.mapRef.current = map;
     ```

3. **`EditorMap.tsx`** — border/feature drawing editor map:
   - File: [EditorMap.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/editor/EditorMap.tsx#L527-L560)
   - Code snippet:
     ```typescript
     // ── Initialize map ──
     useEffect(() => {
       if (!containerRef.current || mapRef.current) return;
       let cancelled = false;
       async function initMap() {
         const mod = await import("maplibre-gl");
         // ...
         const map = new maplibregl.Map({
           container: containerRef.current,
           style: buildBaseStyle(theme) as maplibregl.StyleSpecification,
           center,
           zoom: 4,
           // ...
         });
         mapRef.current = map;
     ```

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Run Dev   | `bun run dev`                   | Dev server runs     |
| Typecheck | `bun run typecheck`             | exit 0, no errors   |
| Lint      | `bun run lint`                  | exit 0, cache note  |
| Format    | `bun run format:write`          | files formatted     |
| Tests     | `bun run test -- <pattern>`     | tests pass          |

## Scope

**In scope** (only files you should modify):
- `src/components/maps/core/SharedMapContext.tsx` [NEW]
- `src/app/layout.tsx`
- `src/components/maps/core/IxWorldMap.tsx`
- `src/components/maps/editor/EditorMap.tsx`
- `src/components/maps/widgets/CountryMapEmbed.tsx`
- `src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts`

**Out of scope** (do NOT touch):
- `src/proxy.ts` (Clerk middleware and auth)
- `src/lib/map-config.ts` (base layer configs and specifications)
- Database schema and migrations (`prisma/schema/**`)

## Git workflow

- Branch: `advisor/103-shared-map-instance`
- Commit per step; message style: conventional commits (e.g. `feat(maps): add shared map context and provider`)

## Steps

### Step 1: Create SharedMapContext
Create [SharedMapContext.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/core/SharedMapContext.tsx). It must:
- Establish a global context to hold the `map` instance reference and a persistent HTML `div` element (`shared-map-canvas-container`).
- Lazy-load MapLibre on the client.
- Provide `acquireMap(slotId: string, options: AcquireOptions): () => void` where `options` provides:
  - `container`: The slot element to append the persistent map container to.
  - `center`, `zoom`, `bounds`, `boundsPadding` configuration.
  - Layer visibility toggles and filters.
  - Click/hover event proxies.
- Return a cleanup function `releaseMap` that detaches the map container and restores event listeners when the slot unmounts.

**Verify**: `bun run typecheck` exits 0.

### Step 2: Register SharedMapProvider in Root Layout
Mount `SharedMapProvider` in [layout.tsx](file:///home/jxsig/projects/ixstats/src/app/layout.tsx) around the main `AppContent` rendering tree.

**Verify**: `bun run typecheck` exits 0.

### Step 3: Refactor IxWorldMap to use Shared Map
In [IxWorldMap.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/core/IxWorldMap.tsx):
- Hook into `useSharedMap`.
- Replace the local `new maplibregl.Map(...)` instantiation inside `useEffect` with `acquireMap(id, options)`.
- Replace `map.remove()` with detaching the canvas and calling `releaseMap` inside the cleanup return.

**Verify**: `bun run typecheck` exits 0.

### Step 4: Refactor useCountryMapEmbedLayers to use Shared Map
In [useCountryMapEmbedLayers.ts](file:///home/jxsig/projects/ixstats/src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts):
- Hook into `useSharedMap` and acquire the shared map.
- Instead of setting up a separate style and downloading a single-country GeoJSON:
  - Adjust visibilities of the world map's default layers (e.g. hide altitudes/climate/grid).
  - Use paint properties and layer filters to highlight the target country on the global political layer. For example:
    `map.setFilter('fill-political', ['==', ['get', '_countryId'], countryId])`
  - flyTo/fitBounds to the target country bounding box.

**Verify**: `bun run typecheck` exits 0.

### Step 5: Refactor EditorMap to use Shared Map
In [EditorMap.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/editor/EditorMap.tsx):
- Hook into `useSharedMap` to acquire the shared MapLibre canvas on mount.
- Add editor-specific layers (vertices, draw handlers) and remove/teardown them on release.

**Verify**: `bun run typecheck` exits 0.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` has no new issues
- [ ] No multiple MapLibre instances are created in the browser profile (only 1 WebGL context exists).
- [ ] Navigating between `/dashboard`, `/mycountry`, and `/maps` occurs without visual flicker.

## STOP conditions

- If files differ from the excerpts in "Current state" (drift detected).
- If MapLibre events do not fire after re-parenting.
- If multiple widgets are visible on screen and they fight over the single instance (ensure active claim displays placeholder properly).
