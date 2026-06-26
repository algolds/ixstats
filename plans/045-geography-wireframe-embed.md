# Plan 045: Replace the Geography map embed with a wireframe outline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/mycountry/GeographyContent.tsx src/components/mycountry/GeographyMap.tsx src/lib/country-geo-service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (feature / visual polish)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

The MyCountry → Geography section currently embeds the *exact same* full-color
MapLibre map that powers `/maps` (via `GeographyMap` → `MapContainer`). It loads
MapLibre + the full geometry pipeline just to show a static country preview, and
it looks visually identical to the main map. The product owner wants this embed
to be visually **distinct** — a true wireframe: just the country's border drawn
as a glowing outline on a dark background, no fills. This both differentiates the
inset and drops a heavy WebGL dependency from the Geography tab.

Crucially, the data is **already in hand**: the Geography tab's existing query
(`api.countryGeo.getCountryGeoBundle`) already returns the country's GeoJSON
`geometry` — `GeographyContent` just doesn't read it yet. So this is a pure
client-side render with **no server changes, no new tRPC endpoint, no new
dependency, and no extra network request.**

## Current state

Files involved:

- `src/components/mycountry/GeographyContent.tsx` — renders the Geography
  section. Fetches the bundle and currently embeds `GeographyMap`. Will be
  edited to read `geometry` from the bundle and render the new wireframe.
- `src/components/mycountry/GeographyMap.tsx` — the heavy MapLibre embed. It is
  used **only** by `GeographyContent.tsx` (verified: `grep -rn GeographyMap src`
  shows the import + one usage, both in `GeographyContent.tsx`). After this plan
  it is no longer referenced; leave the file in place (do not delete) but remove
  its import/use from `GeographyContent.tsx`.
- `src/components/mycountry/CountryWireframe.tsx` — **new** component (create).

The bundle already returns `geometry` — confirmed in
`src/lib/country-geo-service.ts` (the `getCountryGeoBundle` return object includes
`geometry`, `centroid`, `boundingBox`, `cities`, …). Do **not** change that file;
it is listed only so the drift check covers it.

Relevant excerpt — `GeographyContent.tsx`, the destructure (~line 53) and the map
embed block (~lines 65–74) as they exist today:

```tsx
  const {
    cities,
    subdivisions,
    pois,
    rollups,
    country: countryData,
    centroid,
    boundingBox,
  } = bundle;

  return (
    <div className="space-y-4">
      {/* Flat-projection, country-locked preview map */}
      <div className="border-border bg-card/40 relative h-72 overflow-hidden rounded-xl border sm:h-96">
        <GeographyMap
          countryId={countryId}
          centroid={centroid ?? null}
          boundingBox={(boundingBox as [number, number, number, number] | null) ?? null}
        />
      </div>
```

And its import (~line 7):

```tsx
import { GeographyMap } from "./GeographyMap";
```

Each `city` in `bundle.cities` has a `coordinates` field shaped `[lng, lat]`
(may be `null`) and an `isNationalCapital` boolean — used to plot dots.

### Conventions to follow

- New component is a `"use client"` component, `React.memo`-wrapped, props-only
  (matches `GeographyMap.tsx`, the file it replaces — read it for the house
  style, including the small top-right corner label badge).
- GeoJSON types come from the `geojson` package (already a dependency, imported
  elsewhere as `import type { Geometry } from "geojson"`).
- Emerald (`#10b981`) is the Geography section's accent (the top tab used emerald
  classes) — use it as the default wireframe color.
- The embed sits inside the existing `h-72 sm:h-96` bordered container in
  `GeographyContent.tsx`; the new component fills its parent (`h-full w-full`).

## Commands you will need

| Purpose            | Command                                                              | Expected on success        |
|--------------------|----------------------------------------------------------------------|----------------------------|
| Typecheck new file | `bun run typecheck:file src/components/mycountry/CountryWireframe.tsx` | exit 0, no errors          |
| Typecheck UI       | `bun run typecheck:ui`                                                | exit 0, no errors          |
| Unit test          | `bun run test -- src/components/mycountry/CountryWireframe.test.ts`   | all pass                   |
| Lint               | `bun run lint`                                                        | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`.

> If `bun run typecheck:ui` errors because `tsconfig.ui.json` is missing (it is
> untracked, so it won't exist in a fresh git worktree), fall back to
> `bun run typecheck:file <path>` on each of the in-scope `.tsx`/`.ts` files
> instead.

## Scope

**In scope** (the only files you may modify or create):
- `src/components/mycountry/CountryWireframe.tsx` (create)
- `src/components/mycountry/CountryWireframe.test.ts` (create — see Test plan)
- `src/components/mycountry/GeographyContent.tsx` (swap the embed)

**Out of scope** (do NOT touch):
- `src/components/mycountry/GeographyMap.tsx` — leave as-is (now unused; do not
  delete — a later cleanup plan can remove it once confirmed dead).
- `src/components/maps/**`, `src/lib/map-config.ts`, `MapContainer`,
  `IxWorldMap` — the shared `/maps` rendering surface. The whole point of the
  wireframe is to NOT touch it.
- `src/lib/country-geo-service.ts` and any tRPC router — no server changes.

## Git workflow

- Branch: `advisor/002-geography-wireframe-embed` off the current branch (`v2`).
- Commit style — conventional commits. Suggested:
  `feat(mycountry): render Geography preview as a wireframe outline`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Create the CountryWireframe component

Create `src/components/mycountry/CountryWireframe.tsx`. It flattens the country's
GeoJSON Polygon/MultiPolygon into rings, projects lng/lat into an SVG viewBox
(equirectangular with a cosine-of-mid-latitude correction so the shape isn't
horizontally stretched), and draws outline-only `<polygon>`s with a glow, plus
city dots (capital highlighted). `extractRings` is exported so it can be unit
tested in Step 3.

> **Edge-case note (do not "simplify" away)**: compute min/max with a `for`
> loop, NOT `Math.min(...array)` — country polygons can have thousands of
> vertices and the spread form overflows the call stack. The code below already
> does this in a single pass; keep it.

```tsx
"use client";

import React from "react";
import { MapPin } from "lucide-react";
import type { Geometry } from "geojson";

type LngLat = [number, number];

interface CityPoint {
  coordinates?: LngLat | number[] | null;
  isNationalCapital?: boolean | null;
  name?: string;
}

interface CountryWireframeProps {
  geometry: Geometry | null;
  cities?: CityPoint[];
  className?: string;
  /** Stroke/glow color. Defaults to emerald to match the Geography section. */
  color?: string;
  label?: string;
}

const VIEW_W = 1000;
const PAD = 40;

/**
 * Flatten a GeoJSON Polygon/MultiPolygon into an array of rings ([lng,lat][]).
 * Returns [] for unsupported geometry types or null.
 */
export function extractRings(geometry: Geometry | null): LngLat[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ring.map((p) => [p[0], p[1]] as LngLat));
  }
  if (geometry.type === "MultiPolygon") {
    const rings: LngLat[][] = [];
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        rings.push(ring.map((p) => [p[0], p[1]] as LngLat));
      }
    }
    return rings;
  }
  return [];
}

export const CountryWireframe = React.memo(function CountryWireframe({
  geometry,
  cities = [],
  className = "",
  color = "#10b981",
  label,
}: CountryWireframeProps) {
  const model = React.useMemo(() => {
    const rings = extractRings(geometry);
    if (rings.length === 0) return null;

    // Single-pass latitude extents (avoid Math.min(...) spread on huge arrays).
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const r of rings) {
      for (const p of r) {
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      }
    }
    const kx = Math.max(0.1, Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180));

    // Project (lng*kx, lat) and capture extents in the same pass.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const projRings = rings.map((r) =>
      r.map((p) => {
        const x = p[0] * kx;
        const y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        return [x, y] as LngLat;
      })
    );

    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const scale = (VIEW_W - 2 * PAD) / spanX;
    const viewH = spanY * scale + 2 * PAD;

    const toScreen = (px: number, py: number): LngLat => [
      PAD + (px - minX) * scale,
      PAD + (maxY - py) * scale, // flip Y: latitude up -> screen down
    ];

    const ringPaths = projRings.map((r) =>
      r.map(([x, y]) => toScreen(x, y).map((n) => n.toFixed(1)).join(",")).join(" ")
    );

    const cityDots = cities
      .filter(
        (c): c is CityPoint & { coordinates: number[] } =>
          Array.isArray(c.coordinates) && c.coordinates.length >= 2
      )
      .map((c) => {
        const [x, y] = toScreen(c.coordinates[0] * kx, c.coordinates[1]);
        return { x, y, capital: !!c.isNationalCapital };
      })
      .filter((d) => d.x >= 0 && d.x <= VIEW_W && d.y >= 0 && d.y <= viewH);

    return { ringPaths, viewH, cityDots };
  }, [geometry, cities]);

  if (!model) {
    return (
      <div className={`bg-card/40 flex h-full w-full items-center justify-center ${className}`}>
        <p className="text-muted-foreground text-xs">No map geometry linked to this country.</p>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#0a1628] ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${model.viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <defs>
          <pattern id="cw-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke={color} strokeOpacity="0.08" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VIEW_W} height={model.viewH} fill="url(#cw-grid)" />
        {model.ringPaths.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill={color}
            fillOpacity="0.06"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        ))}
        {model.cityDots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.capital ? 7 : 4}
            fill={d.capital ? "#fbbf24" : color}
            stroke="#0a1628"
            strokeWidth="1.5"
            style={{ filter: `drop-shadow(0 0 4px ${d.capital ? "#fbbf24" : color})` }}
          />
        ))}
      </svg>
      <div className="border-border bg-card/85 text-muted-foreground pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] backdrop-blur-sm">
        <MapPin className="h-2.5 w-2.5" />
        {label ?? "Wireframe"}
      </div>
    </div>
  );
});
```

**Verify**: `bun run typecheck:file src/components/mycountry/CountryWireframe.tsx` → exit 0, no errors.

### Step 2: Swap the embed in GeographyContent

In `src/components/mycountry/GeographyContent.tsx`:

1. Replace the import (line ~7):
   ```tsx
   import { CountryWireframe } from "./CountryWireframe";
   ```
   (remove the `import { GeographyMap } from "./GeographyMap";` line)
2. In the bundle destructure (~line 53), **add** `geometry` and **remove**
   `centroid` and `boundingBox` (they were only used by the old map):
   ```tsx
   const {
     cities,
     subdivisions,
     pois,
     rollups,
     country: countryData,
     geometry,
   } = bundle;
   ```
3. Replace the map embed block:
   ```tsx
   {/* Wireframe outline preview */}
   <div className="border-border bg-card/40 relative h-72 overflow-hidden rounded-xl border sm:h-96">
     <CountryWireframe
       geometry={(geometry as import("geojson").Geometry | null) ?? null}
       cities={cities}
     />
   </div>
   ```

**Verify**:
- `grep -c "CountryWireframe" src/components/mycountry/GeographyContent.tsx` → `2` (import + usage)
- `grep -c "GeographyMap" src/components/mycountry/GeographyContent.tsx` → `0`
- `bun run typecheck:ui` → exit 0, no errors.

### Step 3: Add a unit test for the geometry flattening

The projection is visual; the riskiest pure logic is `extractRings` (Polygon vs
MultiPolygon handling). Add one small test. There is an existing Jest setup
(`bun run test`, Jest 30). Create
`src/components/mycountry/CountryWireframe.test.ts`:

```ts
import { extractRings } from "./CountryWireframe";
import type { Geometry } from "geojson";

describe("extractRings", () => {
  it("returns [] for null / unsupported geometry", () => {
    expect(extractRings(null)).toEqual([]);
    expect(extractRings({ type: "Point", coordinates: [0, 0] } as Geometry)).toEqual([]);
  });

  it("flattens a Polygon into its rings", () => {
    const geo: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const rings = extractRings(geo);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(rings[0][1]).toEqual([1, 0]);
  });

  it("flattens a MultiPolygon into all rings of all polygons", () => {
    const geo: Geometry = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [1, 0], [0, 0]]],
        [[[5, 5], [6, 5], [5, 5]], [[5.2, 5.2], [5.3, 5.2], [5.2, 5.2]]],
      ],
    };
    expect(extractRings(geo)).toHaveLength(3); // 1 + 2 rings
  });
});
```

**Verify**: `bun run test -- src/components/mycountry/CountryWireframe.test.ts` → all 3 tests pass.

### Step 4: Full UI typecheck + lint

**Verify**:
- `bun run typecheck:ui` → exit 0.
- `bun run lint` → exit 0 (pre-existing warnings elsewhere OK; **no new** errors
  for the in-scope files; in particular no "unused variable" for `centroid` /
  `boundingBox` / `GeographyMap`).

## Test plan

- New file `src/components/mycountry/CountryWireframe.test.ts` (Step 3) covers:
  null/unsupported geometry → `[]`, Polygon flattening, MultiPolygon flattening
  (multiple polygons + holes). It is a pure-function test; no React renderer
  needed (model after any existing `src/lib/*.test.ts` if one exists for
  structure, otherwise the block above is self-sufficient).
- Verification: `bun run test -- src/components/mycountry/CountryWireframe.test.ts`
  → 3 tests pass.
- Manual (non-blocking, if a dev server is available): `bun run dev`, open
  `/mycountry`, go to the Geography section. Confirm the preview now shows a
  glowing outline of the country (no full-color basemap), a faint grid, a gold
  capital dot, and emerald city dots. A country with no linked geometry shows the
  "No map geometry linked" message instead of a broken map.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:file src/components/mycountry/CountryWireframe.tsx` exits 0
- [ ] `bun run typecheck:ui` exits 0
- [ ] `bun run test -- src/components/mycountry/CountryWireframe.test.ts` → 3 tests pass
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "CountryWireframe" src/components/mycountry/GeographyContent.tsx` → `2`
- [ ] `grep -c "GeographyMap" src/components/mycountry/GeographyContent.tsx` → `0`
- [ ] `git status --porcelain` shows only the three in-scope paths created/modified
- [ ] `plans/README.md` status row for 045 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code — especially if
  `getCountryGeoBundle` no longer returns `geometry`, or `GeographyContent` no
  longer destructures from `bundle`.
- `bundle.geometry` is not a GeoJSON Geometry object at runtime (e.g. it's a
  stringified blob or a `{ geometry: ... }` wrapper) — inspect the shape and
  report rather than guessing a parser.
- The `cities[].coordinates` field is not a `[lng, lat]` array (verify against
  one real country before assuming).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

For whoever owns this next:

- `GeographyMap.tsx` is now unreferenced. A follow-up cleanup can delete it (and
  re-check `MapContainer` lazy-load usage) — intentionally deferred here to keep
  this change reversible.
- No geometry simplification is applied; a country with an enormous polygon will
  render every vertex. If a specific country's outline is janky or slow, add
  `topojson-simplify` (already a dependency) in `extractRings` — that's the
  upgrade path, not needed until measured.
- Subdivision internal borders are not drawn (only the national outline + city
  dots). If desired later, `bundle.subdivisions` carry their own `geometry`;
  feed them through `extractRings` and draw with a thinner/dimmer stroke.
- A reviewer should scrutinize: the single-pass min/max (no `Math.min(...)`
  spread), the Y-flip in `toScreen`, and that the swap removed `centroid`/
  `boundingBox`/`GeographyMap` cleanly (no unused-var lint).
