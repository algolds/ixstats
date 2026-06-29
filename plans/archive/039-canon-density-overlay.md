# Plan 039: New worldbuilding overlay — "Canon Density" story heatmap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/server/api/routers/geo/core/overlays.ts src/lib/overlay-registry.ts src/components/maps/core/hooks/useMapDataQueries.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 038 recommended first (establishes the fetch-wiring pattern), not required
- **Category**: direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The map has rich data overlays (wealth, crises, diplomacy…) but none surface the
thing this platform is *about*: **lore**. Story pins are geo-located narrative
events (battles, foundings, treaties) and already exist as data. A "Canon Density"
overlay colors the world by where history has happened — a glance shows which
nations are story-rich and which are blank canvas. This is the most on-theme new
overlay ("data = lore = world") and it reuses the existing heatmap renderer, so
it's a contained addition that also proves the "new overlay = one procedure + one
registry entry + two fetch lines" path for future overlays (conflict, alliance
blocs — see maintenance notes).

## Current state

- **The heatmap renderer already exists and is reusable.**
  `RiskHeatmapOverlay` (RiskHeatmapOverlay.tsx:53-58) takes:
  ```ts
  interface RiskHeatmapOverlayProps {
    map: MapLibreMap | null;
    riskData: FeatureCollection;     // country polygons, properties.riskScore in 0–1
    crisisEvents: FeatureCollection; // point features rendered as circle markers
    visible: boolean;
  }
  ```
  It colors `fill-political` green→red by `properties.riskScore` and renders
  `crisisEvents` points as markers.

- **The structural exemplar procedure** is `getCrisisRiskMap`
  (geo/core/overlays.ts:158-...): it returns `{ riskMap: FeatureCollection,
  crisisEvents: FeatureCollection, ... }`. Copy its shape.

- **The `crises` registry entry** (overlay-registry.ts:280-302) is the exemplar
  registry wiring — it maps the fetched `{ riskMap, crisisEvents }` to the
  renderer props:
  ```ts
  crises: {
    id: "crises", label: "Crisis Hotspots", category: "fill",
    icon: AlertTriangle, defaultVisible: false,
    dataFetcher: (utils) => utils.geoCore.getCrisisRiskMap.fetch({}),
    component: RiskHeatmapOverlay,
    renderProps: ({ map, data, visible }) => {
      if (!data) return null;
      const d = data as { riskMap: FeatureCollection; crisisEvents: FeatureCollection };
      return { map, riskData: d.riskMap, crisisEvents: d.crisisEvents, visible };
    },
    legend: CRISES_LEGEND,
  },
  ```

- **The render path reads `overlayData[def.id]`** (IxWorldMap.tsx:352), and
  `overlayData` is built in `useMapDataQueries.ts` (the imperative hook). The
  `crises` fetch there is:
  ```ts
  const { data: crisisData } = api.geoCore.getCrisisRiskMap.useQuery(
    {}, { enabled: overlayVisibility.crises, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  // ... overlayData: { crises: crisisData ?? undefined, ... }
  ```

- **`StoryPin` model** (table `story_pins`): `countryId` (String),
  `importance` (Int, 0=normal/1=major/2=legendary), `status` (String, filter to
  `"approved"`), `coordinates` (Json `[lng, lat]`), `title`, `category`. Indexed
  on `[countryId, status, category]`.

- **`Country`** has `geometry` and `centroid` (used by the other geo procedures).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/server/api/routers/geo/core/overlays.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/lib/overlay-registry.ts` | exit 0 |
| Typecheck (file) | `bun run typecheck:file src/components/maps/core/hooks/useMapDataQueries.ts` | exit 0 |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/server/api/routers/geo/core/overlays.ts` (add `getCanonDensityMap` procedure)
- `src/lib/overlay-registry.ts` (add `CANON_DENSITY_LEGEND` + `canonDensity` registry entry)
- `src/components/maps/core/hooks/useMapDataQueries.ts` (fetch + `overlayData` key)

**Out of scope** (do NOT touch):
- `RiskHeatmapOverlay.tsx` — reused unchanged.
- The conflict / alliance-blocs overlays — documented as follow-ups, not built here.
- Story-pin creation / moderation — read-only aggregation only.

## Git workflow

- Branch: `advisor/039-canon-density-overlay`
- Conventional commits, e.g. `feat(maps): add Canon Density (story heatmap) overlay`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `getCanonDensityMap` procedure

In `src/server/api/routers/geo/core/overlays.ts`, add a procedure to the
`overlayProcedures` object, modeled on `getCrisisRiskMap`. Aggregate approved
story pins per country (weighted by importance), normalize to a 0–1 percentile
rank (matching how `getRegionalChoropleth` ranks — overlays.ts:56-64), and return
high-importance pins as point markers.

```ts
getCanonDensityMap: cachedPublicProcedure
  .input(z.object({}).optional())
  .query(async ({ ctx }) => {
    // 1) Approved story pins (weighted by importance)
    const pins = await ctx.db.storyPin.findMany({
      where: { status: "approved" },
      select: { countryId: true, importance: true, coordinates: true, title: true, category: true },
    });

    const weightOf = (imp: number) => (imp >= 2 ? 6 : imp === 1 ? 3 : 1);
    const scoreByCountry = new Map<string, number>();
    for (const p of pins) {
      scoreByCountry.set(p.countryId, (scoreByCountry.get(p.countryId) ?? 0) + weightOf(p.importance));
    }

    // 2) Country polygons
    const countries = await ctx.db.country.findMany({
      where: { geometry: { not: null } as any },
      select: { id: true, name: true, slug: true, geometry: true },
    });

    // 3) Percentile-rank the density so colors distribute evenly (mirror getRegionalChoropleth)
    const ranked = countries
      .map((c) => ({ id: c.id, raw: scoreByCountry.get(c.id) ?? 0 }))
      .sort((a, b) => a.raw - b.raw);
    const rankMap = new Map<string, number>();
    for (let i = 0; i < ranked.length; i++) {
      rankMap.set(ranked[i]!.id, ranked.length > 1 ? i / (ranked.length - 1) : 0.5);
    }

    const riskMap = {
      type: "FeatureCollection" as const,
      features: countries.map((c) => ({
        type: "Feature" as const,
        geometry: c.geometry as unknown as import("geojson").Geometry,
        properties: {
          id: c.id,
          name: c.name,
          slug: c.slug,
          riskScore: rankMap.get(c.id) ?? 0,   // RiskHeatmapOverlay reads `riskScore`
          rawValue: scoreByCountry.get(c.id) ?? 0,
        },
      })),
    };

    // 4) Major/legendary pins as point markers (cap to keep payload small)
    const points = pins
      .filter((p) => p.importance >= 1 && Array.isArray(p.coordinates))
      .slice(0, 200)
      .map((p, i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
        properties: { id: `pin_${i}`, title: p.title, category: p.category, importance: p.importance },
      }));

    return {
      riskMap,
      crisisEvents: { type: "FeatureCollection" as const, features: points },
      metadata: { count: countries.length, pins: pins.length },
    };
  }),
```

Notes:
- `RiskHeatmapOverlay` reads `properties.riskScore` for the fill color — keep that
  exact key. Confirm by reading the part of `RiskHeatmapOverlay.tsx` after line 60
  (the match-expression builder) before relying on it; if it reads a different
  property name, use that name. **If it reads neither `riskScore` nor a clearly
  density-shaped property, STOP and report.**
- `cachedPublicProcedure` and `z` are already imported in this file.

**Verify**: `bun run typecheck:file src/server/api/routers/geo/core/overlays.ts` → exit 0.

### Step 2: Register the overlay

In `src/lib/overlay-registry.ts`, add a legend constant near the others
(after `CRISES_LEGEND`):

```ts
const CANON_DENSITY_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Canon Density — Story Activity",
  stops: [
    { color: "#22c55e", label: "Quiet" },
    { color: "#facc15", label: "Active" },
    { color: "#f97316", label: "Storied" },
    { color: "#dc2626", label: "Legendary" },
  ],
};
```

Then add a registry entry (after the `crises` entry, ~line 302), mirroring it:

```ts
canonDensity: {
  id: "canonDensity",
  label: "Canon Density",
  category: "fill",
  icon: BookOpen,
  defaultVisible: false,
  dataFetcher: (utils: TRPCUtils) => utils.geoCore.getCanonDensityMap.fetch({}),
  component: RiskHeatmapOverlay,
  renderProps: ({ map, data, visible }: OverlayRenderCtx) => {
    if (!data) return null;
    const d = data as { riskMap: FeatureCollection; crisisEvents: FeatureCollection };
    return { map, riskData: d.riskMap, crisisEvents: d.crisisEvents, visible };
  },
  legend: CANON_DENSITY_LEGEND,
},
```

`BookOpen` and `RiskHeatmapOverlay` are already imported in this file
(overlay-registry.ts:23, :49).

**Verify**: `bun run typecheck:file src/lib/overlay-registry.ts` → exit 0.

### Step 3: Wire the fetch into `useMapDataQueries`

In `src/components/maps/core/hooks/useMapDataQueries.ts`, add a query next to the
`crisisData` one, and add the key to `overlayData` (object + dependency array):

```ts
const { data: canonDensityData } = api.geoCore.getCanonDensityMap.useQuery(
  {}, { enabled: overlayVisibility.canonDensity, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
);
// in overlayData object:
canonDensity: canonDensityData ?? undefined,
// in the dependency array: canonDensityData
```

**Verify**: `bun run typecheck:file src/components/maps/core/hooks/useMapDataQueries.ts` → exit 0.

## Test plan

- No new automated test for the React wiring (consistent with the repo).
- Recommended (only if a tRPC caller harness exists in
  `src/server/api/routers/__tests__/`): a test that `getCanonDensityMap` returns a
  `riskMap` FeatureCollection whose `properties.riskScore` values are in `[0,1]`
  and a country with more high-importance pins ranks higher than one with none.
  If no harness exists, skip (YAGNI) and rely on the manual check.
- Manual/browser (reviewer note): on `/maps`, toggle "Canon Density" → countries
  with more/important story pins fill warmer; major pins show as markers.

## Done criteria

ALL must hold:

- [ ] `getCanonDensityMap` exists in `overlays.ts`, returns `{ riskMap, crisisEvents }` with `riskScore` in `[0,1]`, weighting importance (legendary > major > normal)
- [ ] `canonDensity` registry entry + `CANON_DENSITY_LEGEND` added, reusing `RiskHeatmapOverlay`
- [ ] `useMapDataQueries` fetches it and exposes `overlayData.canonDensity`
- [ ] All three `bun run typecheck:file` commands exit 0
- [ ] `bun run lint` exits 0
- [ ] Only the three in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `RiskHeatmapOverlay` reads a fill property other than `riskScore` and it's not
  obvious how to map density onto it.
- The `StoryPin` model lacks `countryId`/`importance`/`status`/`coordinates` (drift).
- `getCrisisRiskMap` / the `crises` registry entry no longer match the excerpts
  (the overlay framework changed) — re-derive the pattern before proceeding.
- The render path no longer reads `overlayData?.[def.id]` (IxWorldMap changed).

## Maintenance notes

- **This is the reference implementation for "a new overlay."** Two more
  worldbuilding overlays follow the same shape, deferred here:
  - **Conflict / tension**: a `getConflictMap` procedure ranking countries by
    active `MilitaryConflict` + hostile foreign-policy actions → reuse
    `RiskHeatmapOverlay` exactly like this plan.
  - **Alliance blocs**: a `getAllianceBlocsMap` procedure coloring countries by
    alliance membership — this one needs a *categorical* color (not a gradient),
    so it requires either a small categorical variant of `ChoroplethOverlay` or a
    new renderer; scope it separately.
- Canon density is meaningful immediately (story pins exist), unlike the
  health/trade overlays that await populated columns.
- Reviewer: confirm the percentile-rank normalization (so a few story-heavy
  nations don't wash everyone else to zero) and the 200-pin marker cap.
