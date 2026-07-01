---
name: project_map_standalone_architecture
description: Map instance strategy — per-role persistent Map Engine for world+editor (P1 done); embeds still standalone; the OLD single-canvas SharedMapContext stays dead
metadata: 
  node_type: memory
  type: project
  originSessionId: 45c4a18a-9ed9-4ef9-a137-1f87d2e9457a
---

**UPDATE 2026-07-01 (P0+P1 Map Engine done, supersedes "everything standalone"):**
`src/lib/maps/map-engine.ts` — module singleton keeping ONE persistent MapLibre instance PER ROLE
(`world`, `editor`), parked in a hidden holder on unmount (not destroyed) → nav away+back re-attaches a
warm instance ("loads once"). `IxWorldMap`→`acquireSurface("world")`, `EditorMap`→`acquireSurface("editor")`.
Differs from the dead SharedMapContext: separate instance per role (no single-canvas contention),
awaited `ready` promise (no poller), unique-id acquires (StrictMode-safe), style-reset-on-reacquire,
dev HUD `window.__mapEngine.getStats()`. Embeds + wiki maps STILL standalone (P2 = bounded embed pool,
not built). Plan: `plans/shared-map-engine-plan.md`. The single-canvas re-parent model stays dead. Below
is the original rip-out context.

On v2 (2026-07-01) the user said "undo all shared map stuff completely, start from scratch."
We removed BOTH the shared-map singleton AND the snapshot-preview layer. **Current model: every map
component creates and owns its own MapLibre instance** (like `CoordinatesMapEmbed` always did).

**Deleted:** `src/components/maps/core/SharedMapContext.tsx` (`SharedMapProvider`/`useSharedMap`/
`acquireMap`), removed `<SharedMapProvider>` from `src/app/layout.tsx`. Snapshot layer deleted:
`src/lib/map-snapshot/*`, `CountryMapPreview.tsx`, `CoordinatesMapPreview.tsx`,
`src/stores/map-data-version.ts`.

**Standalone init pattern** (each does `new maplibregl.Map({ container, style: buildBaseStyle(theme,
proj), center, zoom, ... })` in a `useEffect([])`, work in `map.on("load")`, cleanup `map.remove()`):
- `src/components/maps/core/IxWorldMap.tsx` — main map. Separate effect at ~238 handles theme/projection
  via `map.setStyle` on `[theme, isLoaded, projectionMode]`.
- `src/components/maps/editor/EditorMap.tsx` — editor. Separate theme effect ~498; forces mercator.
- `src/components/maps/widgets/hooks/useCountryMapEmbedLayers.ts` — the CountryMapEmbed instance.

**History / why the flip-flop (so it isn't re-litigated):** the singleton (`ba95448a`) re-parented ONE
canvas between slots → only one map visible at a time; multiple simultaneous embeds (wiki articles,
lists) looped/stuck. The snapshot approach (`a75e1c4e`, my session) fixed that but the user still hit
issues and chose a clean rip-out. Tradeoff accepted: standalone means the browser WebGL-context limit
(~8-16) can bite on pages with many maps — if that resurfaces, prefer a lightweight fix over rebuilding
a global singleton. `establishEmbassy` duplicate guard (`124d7c7e`) is unrelated and was KEPT.

Related: [[project_maps_mycountry_integration]], [[project_map_editor_improvements]].
