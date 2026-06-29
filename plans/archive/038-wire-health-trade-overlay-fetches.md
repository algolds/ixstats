# Plan 038: Wire the Health + Trade-Balance overlay data fetches

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3a52c4a..HEAD -- src/components/maps/core/hooks/useMapDataQueries.ts src/lib/overlay-registry.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / direction
- **Planned at**: commit `f3a52c4a`, 2026-06-15

## Why this matters

The map has a registry of overlays (`overlay-registry.ts`). The **Health Map** and
**Trade Balance** overlays are fully registered (icons, legends, render components,
even per-overlay `dataFetcher` declarations at overlay-registry.ts:382-411) and
appear as toggles in the map controls. But toggling them does **nothing** — the
fill never recolors.

Root cause: the render path reads overlay data from a `overlayData` record keyed
by overlay id (`IxWorldMap.tsx:352` — `const data = overlayData?.[def.id]`), and
that record is built by the imperative hook `useMapDataQueries.ts`, which fetches
seven overlays (wealth, population, crises, diplomacy, transport, economicTier,
vitality) but **omits health and tradeBalance**. So `overlayData["health"]` and
`overlayData["tradeBalance"]` are always `undefined`, and `ChoroplethOverlay`
renders null. (The registry's own `dataFetcher` for these two is not what feeds
this render path — it's effectively dead here.)

The backend already supports both metrics — `getRegionalChoropleth`'s metric enum
includes `"health"` and `"tradeBalance"` (overlays.ts:11) — so this is purely a
two-fetch wiring gap. After this plan, toggling those overlays recolors the map.

## Current state

- **`useMapDataQueries.ts:188-242`** — the fetch block + `overlayData` memo:

  ```ts
  // 10. Fetch Optional Data-Visualizations (Choropleths and Routes)
  const { data: wealthData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "gdpPerCapita", groupBy: "country" },
    { enabled: overlayVisibility.wealth, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
  // ... population, crises, diplomacy, transport, economicTier ...
  const { data: vitalityData } = api.geoCore.getRegionalChoropleth.useQuery(
    { metric: "vitality", groupBy: "country" },
    { enabled: overlayVisibility.vitality, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );

  const overlayData = useMemo(
    () => ({
      wealth: wealthData ?? undefined,
      population: populationData ?? undefined,
      crises: crisisData ?? undefined,
      diplomacy: diplomacyData ? { relations: diplomacyData.relations, conflicts: diplomacyData.conflicts } : undefined,
      transport: transportData ?? undefined,
      economicTier: economicTierData ?? undefined,
      vitality: vitalityData ?? undefined,
    }),
    [wealthData, populationData, crisisData, diplomacyData, transportData, economicTierData, vitalityData]
  );
  ```

- **`overlay-registry.ts:382-411`** — `health` and `tradeBalance` overlays are
  registered with `id: "health"` / `id: "tradeBalance"` and use `ChoroplethOverlay`
  with the `"neutral"` color scale. Their ids are the keys `overlayData` must provide.

- **`geo/core/overlays.ts:8-15`** — `getRegionalChoropleth` accepts
  `metric: z.enum(["gdpPerCapita", "population", "vitality", "health", "tradeBalance"])`.
  It returns `properties.value` as a **percentile rank (0–1)** (overlays.ts:75), so
  the overlays will recolor by rank even before the underlying columns are richly
  populated (the colors are only *meaningful* once `overallNationalHealth` /
  `tradeBalance` are populated — that is a separate data concern, same as the
  existing vitality overlay).

**Convention to follow**: copy the exact `useQuery` shape of the `vitality` fetch
(same `staleTime`/`gcTime`, `enabled: overlayVisibility.<id>`), and add the keys to
`overlayData` + its dependency array.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (file) | `bun run typecheck:file src/components/maps/core/hooks/useMapDataQueries.ts` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings tolerated) |

(Never run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` — they OOM the server.)

## Scope

**In scope**:
- `src/components/maps/core/hooks/useMapDataQueries.ts` (add two fetches + two `overlayData` keys)

**Out of scope** (do NOT touch):
- The diverging color scale for trade balance — this is a documented follow-up.
  Doing it correctly requires server-side symmetric-around-zero normalization
  (the procedure currently returns a percentile rank, so a zero balance is not at
  rank 0.5). Do NOT attempt it here.
- `overlay-registry.ts` — the health/tradeBalance entries are already correct.
- Populating `country.overallNationalHealth` / `country.tradeBalance` — separate
  data/product task.
- The registry's per-overlay `dataFetcher` — not the render path; leave it.

## Git workflow

- Branch: `advisor/038-overlay-fetches`
- Conventional commits, e.g. `fix(maps): wire health + tradeBalance overlay data fetches`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the two fetches

In `src/components/maps/core/hooks/useMapDataQueries.ts`, after the `vitalityData`
query (around line 216), add:

```ts
const { data: healthData } = api.geoCore.getRegionalChoropleth.useQuery(
  { metric: "health", groupBy: "country" },
  { enabled: overlayVisibility.health, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
);
const { data: tradeBalanceData } = api.geoCore.getRegionalChoropleth.useQuery(
  { metric: "tradeBalance", groupBy: "country" },
  { enabled: overlayVisibility.tradeBalance, staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
);
```

### Step 2: Add them to `overlayData` + the dependency array

In the `overlayData` `useMemo`, add the two keys (matching the registry ids
`health` / `tradeBalance`) and append both to the dependency array:

```ts
const overlayData = useMemo(
  () => ({
    wealth: wealthData ?? undefined,
    population: populationData ?? undefined,
    crises: crisisData ?? undefined,
    diplomacy: diplomacyData
      ? { relations: diplomacyData.relations, conflicts: diplomacyData.conflicts }
      : undefined,
    transport: transportData ?? undefined,
    economicTier: economicTierData ?? undefined,
    vitality: vitalityData ?? undefined,
    health: healthData ?? undefined,
    tradeBalance: tradeBalanceData ?? undefined,
  }),
  [
    wealthData, populationData, crisisData, diplomacyData, transportData,
    economicTierData, vitalityData, healthData, tradeBalanceData,
  ]
);
```

**Verify**: `bun run typecheck:file src/components/maps/core/hooks/useMapDataQueries.ts` → exit 0.

## Test plan

- No new automated test: this is a two-line wiring change matching an existing
  pattern; React-Query hooks aren't unit-tested in this repo.
- Manual/browser verification (reviewer note, not required to pass typecheck):
  on `/maps`, toggle "Health Map" and "Trade Balance" → the political fill
  recolors (by percentile rank). Before this change, toggling did nothing.

## Done criteria

ALL must hold:

- [ ] `useMapDataQueries.ts` issues `getRegionalChoropleth` queries for `metric: "health"` and `metric: "tradeBalance"`, each gated on its `overlayVisibility` flag
- [ ] `overlayData` includes `health` and `tradeBalance` keys, both in the object and the dependency array
- [ ] `bun run typecheck:file src/components/maps/core/hooks/useMapDataQueries.ts` exits 0
- [ ] `bun run lint` exits 0
- [ ] Only `useMapDataQueries.ts` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpt of `useMapDataQueries.ts` doesn't match (drift).
- `getRegionalChoropleth`'s metric enum no longer includes `"health"`/`"tradeBalance"`.
- `IxWorldMap.tsx` no longer reads overlay data via `overlayData?.[def.id]` (the
  render path changed — the fix target may be different).

## Maintenance notes

- **Follow-up (deferred):** the trade-balance overlay should use a diverging
  color scale (red = deficit, neutral, green = surplus). That requires the
  `getRegionalChoropleth` procedure to expose a signed, zero-centered value for
  signed metrics (it currently returns a percentile rank where 0 is not at 0.5),
  plus a `"diverging"` entry in `ChoroplethOverlay`'s `COLOR_SCALES` and the
  `choroplethRenderProps` helper. Out of scope here because it's a coordinated
  server+client change on data that is currently unpopulated.
- These overlays are only *meaningful* once `country.overallNationalHealth` and
  `country.tradeBalance` are populated by a game loop — same caveat the registry
  legends already note. This plan makes the toggle *functional*, not the data
  *meaningful*.
- Reviewer: confirm the dependency array includes the two new vars (a stale memo
  would defeat the fix).
