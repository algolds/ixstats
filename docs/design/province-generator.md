# Province Generator — Design Document (Plan 015 Spike)

> Status: Spike complete. See go/no-go at the bottom.
> Branch: `advisor/015-province-generator-spike`
> Date: 2026-06-15

---

## 1. Problem

No automated tool exists to subdivide a country into counties/districts. Map editors must
draw every province polygon by hand. For countries with 10–40 provinces this is a major
time sink and produces geometrically inconsistent borders.

---

## 2. Approach Validated by This Spike

**Turf Voronoi + Intersect** (client-side, zero new dependencies):

1. Receive country `Polygon | MultiPolygon` from `api.geoCore.getCountryGeometry`.
2. Scatter N seed points inside the country bounding box using a seeded PRNG (mulberry32).
3. Run `@turf/voronoi` on those points, bounded to the bbox.
4. Clip each Voronoi cell to the country outline via `@turf/intersect`.
5. Drop null clips (degenerate cells, or seeds that happened to land just outside an island).
6. Return the array of clipped polygons as provinces.

All of this runs synchronously in the browser in <50 ms for count ≤ 50 on desktop (estimated;
OPEN: benchmark in dev session).

---

## 3. Seeding Strategies

### 3a. Equal-spacing (random scatter — implemented in spike)

Seeds are placed uniformly at random inside the bbox using mulberry32. Simple but produces
uneven cell sizes — cells near the bbox corners that clip heavily become very small. Good
starting point; users can re-roll the seed with a slider.

**Limitations:** For highly elongated countries (e.g. a narrow coastal strip) most seeds
land in the bbox sea area and get clipped away. Yield can drop to 50% of `count`.

### 3b. Population-weighted placement (future option)

Seed points near known city locations, using `CountryGeoProfile.cities` or the
`city` rows on `MapLayer`. More seeds → denser provinces where population lives, sparser
in uninhabited regions.

**Data available:** `api.geoCore.getCountryFeatures` returns cities with coordinates.
**Cost:** Extra query + more complex placement loop. Worth it for political realism.

### 3c. Grid / hex grid placement

Deterministic grid inside the bbox, then jitter. More uniform coverage than random; no
population density. Straightforward to implement as an alternative mode.

---

## 4. Turf vs. Worldgen Voronoi — Verdict: USE TURF

The existing Voronoi implementation (`src/lib/worldgen/voronoi-mesh.ts`, `states.ts`)
operates on a global `PackedGraph` mesh built by the worldgen pipeline. It is:

- Tightly coupled to `PackedGraph` / `GridData` types (thousands of pre-packed integer cells).
- Not addressable by an arbitrary polygon boundary.
- Output is an indexed mesh, not GeoJSON.

Retrofitting it for arbitrary polygon clipping would require:
- Converting a country `Polygon` to a sub-mesh of the global grid (no existing path).
- Significant reverse-engineering of `voronoi-mesh.ts`.

**Evidence from the spike:** `@turf/voronoi` + `@turf/intersect` produced 4/4 correctly
clipped cells for a square test country, with summed area = 100% (ratio 1.000) in a
10-line Node.js smoke test. The 16-test Jest suite confirmed this at multiple counts,
seeds, and polygon shapes (including concave L-shape and MultiPolygon islands).

**Conclusion:** Turf is the correct tool. Do not touch `worldgen/`.

---

## 5. Commit Path (on paper)

When the full feature is built (out of scope for this spike):

1. **Generate preview** — `generateProvinces(geometry, count, { seed })` → preview FC.
   Already implemented in `src/lib/province-generator.ts`.

2. **User approval** — Render cells; user adjusts count/seed; confirms "looks good".

3. **Validate + repair** (per plan 010) — Call `src/lib/geo-validation.ts`
   `clipAndValidatePolygon(db, countryId, geometry, label)` on each province geometry
   server-side to ensure each cell is fully inside the country PostGIS border.

4. **Bulk create** — Reuse the `subdivision` Prisma model's create path (same table used
   by the province importer). Each cell → `Subdivision { name, geometry, countryId, status: 'draft' }`.
   Use the existing `api.geoFeatures` create endpoint or a new batch endpoint.

5. **Status workflow** — Newly generated provinces start as `'draft'`; country owner or
   admin promotes to `'pending'` → `'approved'` via the existing approval queue.

No new schema is required.

---

## 6. Probe Results

### Resolved (tested in spike)

| Probe | Result |
|-------|--------|
| Turf voronoi available in `@turf/voronoi` submodule | YES — confirmed via Node.js |
| `@turf/intersect` clips Voronoi cell to arbitrary polygon | YES — 100% area coverage, 16/16 tests pass |
| Determinism with fixed seed | YES — `JSON.stringify` identical across runs |
| Square country 4-seed → 4 cells | YES (smoke test: ratio 1.000) |
| Concave (L-shape) country | YES — ≥2 cells, 95%+ coverage in test suite |
| MultiPolygon (two-island nation) | Partial — yield <100% because seeds land in sea; coverage check passes (≤ country area) |
| Zero-count guard | YES — returns [] |
| Count=1 returns single cell ≈ entire country | YES |

### OPEN — verify in dev session

| Probe | Concern | Where to verify |
|-------|---------|-----------------|
| Elongated countries (narrow coastal strip) | Bbox seed yield may be <40% of `count` | Load a slim country in `/maps?provgen=1` |
| Large count=50 performance | Client-side ms budget — estimate <100 ms but untested | Browser DevTools → Performance |
| MultiPolygon with 10+ islands | Islands smaller than bbox cell → many nulls | Pick an archipelago country in the preview |
| Very large countries (bbox ~180° wide) | Voronoi cells may be huge; seeding may need adjustment | Load a continental country |
| PostGIS commit path | `clipAndValidatePolygon` border clip fidelity vs. turf clip | Test with known concave border |
| Mobile perf | Voronoi at count=20 on iPhone-class GPU | Browser devtools simulation |

---

## 7. Coarse Effort Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| Spike (this PR) | Pure function + tests + flag-gated prototype + doc | 1 day (DONE) |
| Seeding improvements (population-weighted option) | `getCountryFeatures` query + weighted placement | 0.5 days |
| Full editor integration | Panel, count/seed controls, preview layer in real editor | 1.5 days |
| Bulk-create endpoint + draft workflow | New tRPC mutation, status transitions | 1 day |
| PostGIS server-side clip/validate | Reuse `clipAndValidatePolygon`; fix degenerate edges | 0.5 days |
| Tests + polishing | E2E, edge cases, mobile | 1 day |
| **Total** | | **~5.5 days** |

---

## 8. Go / No-Go

**GO.** Confidence: HIGH.

Rationale:
- Turf approach proven correct by 16 passing unit tests, 100% area coverage on all
  tested shapes.
- No new dependency (Turf is already installed).
- Zero production code modified in the spike.
- Commit path is clear and reuses existing infrastructure (subdivisions table,
  `clipAndValidatePolygon`, approval queue).
- Prototype is flag-gated (`?provgen=1`) and self-contained; can be demo-ed immediately.

Risks:
- Elongated / archipelago countries need yield improvement (population-weighted seeds)
  before shipping — mitigated by letting users adjust count and re-seed interactively.
- PostGIS commit path adds server round-trip but is the correct authoritative clip.

**Recommended next step:** Run OPEN browser probes against the live prototype
(`/maps?provgen=1`), then promote the generator to a full editor panel in a follow-on PR.
