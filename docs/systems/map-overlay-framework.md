# Map Overlay Framework — Design (P7)

> **Status: design-only.** This documents a pluggable overlay architecture for rendering
> IxStats data on the IxWorld map. No implementation ships with this doc; it defines the
> interface, integration seams, and a migration path so new data-driven overlays become a
> ~30-line registry entry instead of edits across four files.

## 1. Why

IxWorld (`src/components/maps/`) already renders five production overlays, but each one is
**hardcoded in four places** (a component, a fetch call, a visibility key, and two UI lists).
Adding a new overlay that surfaces IxStats data (economic tier, vitality, alliances, crises…)
means touching all of them, and there's no single place that describes "what overlays exist."

Goal: a **declarative registry** — one entry per overlay — that the map container, controls,
and renderer all read from. Adding an overlay = add a registry entry + (optionally) a small
imperative component. Everything else (toggle UI, data fetch, mutual-exclusivity, legend)
derives from the entry.

## 2. Current state (what exists today)

**Overlay components** — `src/components/maps/overlays/`:
- `ChoroplethOverlay` — recolors the `fill-political` layer by a per-country value (wealth / population).
- `RiskHeatmapOverlay` — recolors `fill-political` by risk + adds crisis point markers.
- `GeopoliticalOverlay` — diplomatic relation lines + conflict markers (line + circle sources).
- `TradeRouteOverlay` / `TransportOverlay` — bilateral line layers.

**Wiring (the hardcoded parts):**
- `src/components/maps/core/MapContainer.tsx` — local `overlayVisibility` state with literal keys (~216-227), conditional tRPC fetches per overlay (~230-250), and a `toggleOverlay` with a hardcoded `FILL_OVERLAY_KEYS` mutual-exclusivity list (~47-49, 273-284).
- `src/components/maps/core/IxWorldMap.tsx` — `OverlayVisibility` type with literal keys (~192-204), an effect toggling layer visibility (~1672-1710), and a `<Suspense>` block conditionally rendering each overlay (~2130-2179).
- `src/components/maps/core/MapControls.tsx` — hardcoded `FEATURE_OVERLAYS` / `ANALYTICS_OVERLAYS` lists driving the toggle panel (~40-54).

**Data sources** — `src/server/api/routers/geo/core.ts` (no changes needed; already rich):
`getRegionalChoropleth` (metric ∈ gdpPerCapita | population | vitality | health | tradeBalance),
`getGeopoliticalOverlay`, `getCrisisRiskMap`, `getTradeRouteGeoJSON`, `getCountryGeometry`,
`getNeighbors`, `getCountryFeatures`.

**Pain points:** four-file edits per overlay; no central catalog; mutual-exclusivity is a
literal array; legends are bespoke; MyCountry widgets each hand-roll their own MapLibre instance.

## 3. Proposed architecture

A single registry, `src/lib/overlay-registry.ts`:

```ts
export type OverlayCategory =
  | "fill"      // recolors the political layer; mutually exclusive with other fills
  | "feature"   // independent point/line features; default-on; freely combinable
  | "analytics"; // independent data layer; combinable; usually default-off

export interface OverlayPluginDefinition {
  id: string;                         // unique; replaces the literal OverlayVisibility keys
  label: string;                      // control-panel label
  category: OverlayCategory;
  icon?: LucideIcon;
  defaultVisible?: boolean;
  /** Fetch the GeoJSON/metadata this overlay needs. utils = api.useUtils(). */
  dataFetcher: (utils: TRPCUtils, ctx: OverlayFetchCtx) => Promise<unknown>;
  /** Imperative MapLibre renderer (add/remove sources+layers). Lazy-loaded. */
  component: React.LazyExoticComponent<React.ComponentType<OverlayComponentProps>>;
  /** Optional declarative legend (or a component). */
  legend?: OverlayLegend;
  /** Gate availability (e.g. premium, or "only when a country is focused"). */
  isAvailable?: (ctx: OverlayFetchCtx) => boolean;
}

export interface OverlayFetchCtx { focusedCountryId?: string; zoom: number; }
export interface OverlayComponentProps {
  map: MapLibreMap | null;
  data: unknown;          // shape owned by the overlay
  visible: boolean;
  legend?: OverlayLegend;
}

export const OVERLAY_REGISTRY: Record<string, OverlayPluginDefinition> = { /* … */ };
```

The five existing overlays become registry entries (no rewrite of their render logic — they
already take `map` + `data` + `visible`). Example entries: `wealth`/`population` →
`ChoroplethOverlay` (`category: "fill"`), `diplomacy` → `GeopoliticalOverlay` (`"analytics"`),
`crises` → `RiskHeatmapOverlay` (`"fill"`), `transport` → `TransportOverlay` (`"analytics"`).

## 4. Integration seams (before → after)

**MapContainer** — replace literal state + per-overlay queries with registry-driven loops:
```ts
const [visible, setVisible] = useState(() =>
  Object.fromEntries(Object.values(OVERLAY_REGISTRY)
    .filter(o => o.defaultVisible).map(o => [o.id, true])));

const toggle = (id) => setVisible(prev => {
  const def = OVERLAY_REGISTRY[id]; const next = { ...prev, [id]: !prev[id] };
  if (next[id] && def.category === "fill")               // category-based exclusivity
    for (const o of Object.values(OVERLAY_REGISTRY))
      if (o.id !== id && o.category === "fill") next[o.id] = false;
  return next;
});
// fetch on demand for active overlays via def.dataFetcher(utils, ctx) (React Query dedupes)
```

**MapControls** — generate the panel from the registry instead of `FEATURE_OVERLAYS`/`ANALYTICS_OVERLAYS`:
```ts
const groups = groupBy(Object.values(OVERLAY_REGISTRY).filter(o => o.isAvailable?.(ctx) ?? true), "category");
```

**IxWorldMap** — one render loop instead of the hardcoded `<Suspense>` block:
```tsx
{isLoaded && <Suspense fallback={null}>{Object.values(OVERLAY_REGISTRY).map(def => {
  const C = def.component;
  return <C key={def.id} map={mapRef.current} data={overlayData[def.id]} visible={!!visible[def.id]} legend={def.legend} />;
})}</Suspense>}
```

**Legend** — `AnalyticsLegend` iterates registry entries whose overlay is visible and has a `legend`.

## 5. Worked example — a new "Economic Tier" overlay (IxStats data)

The whole change is one registry entry; `getRegionalChoropleth` already returns the data and
`ChoroplethOverlay` already renders a value→color fill:
```ts
economicTier: {
  id: "economicTier",
  label: "Economic Tier",
  category: "fill",
  icon: TrendingUp,
  dataFetcher: (utils) => utils.geoCore.getRegionalChoropleth.fetch({ metric: "gdpPerCapita", groupBy: "country" }),
  component: lazy(() => import("~/components/maps/overlays/ChoroplethOverlay")),
  legend: { type: "scale", scale: "wealth", title: "GDP per capita (percentile)" },
}
```
A genuinely new visual (e.g. **alliance blocs** coloring members by bloc) is: add a
`getAllianceBlocsGeoJSON` geo endpoint (or reuse alliance data), write a small
`AllianceBlocOverlay` (mirror `GeopoliticalOverlay`), and register it.

## 6. MyCountry embed integration (future)

Today `CountryMapWidget` / `DiplomacyMapWidget` / `DefenseMapWidget` each spin up a bespoke
MapLibre instance. Once the registry exists, a `useCountryOverlay(id, countryId)` hook can fetch
a country-scoped overlay's data so widgets reuse the same plugin data contract (e.g. Defense =
subdivisions colored by readiness), instead of hand-rolled styling. The widgets can stay
standalone but share the registry's data fetchers + legends.

## 7. Migration plan (incremental, zero breaking changes)

1. Add `src/lib/overlay-registry.ts` + `overlay-types.ts`; register the 5 existing overlays. No call sites change yet.
2. Refactor `MapControls` to read the registry (UI only — lowest risk).
3. Refactor `MapContainer` visibility/fetch/toggle to the registry; keep the same overlay components.
4. Refactor `IxWorldMap` render block to the loop. Delete the literal `OverlayVisibility` type.
5. Add 1–2 new IxStats overlays (economic tier, vitality) to prove the ~30-line path.
6. (Later) `useCountryOverlay` for MyCountry widgets.

Each step is independently shippable and lint-checkable; steps 2–4 are pure equivalence
refactors (no visual change) before any new overlay is added in step 5.

## 8. Open questions
- **Combination limits** — should the panel cap simultaneous analytics overlays for legibility?
- **Premium overlays** — `isAvailable` can gate (consistent with the MyCountry read-only-preview pattern).
- **Performance** — large choropleths use `match` paint expressions; confirm acceptable feature counts before enabling by default.
- **Legend system** — declarative `legend` covers scales/categories; bespoke legends fall back to a component.
