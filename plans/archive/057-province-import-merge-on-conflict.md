# Plan 057: Province import commit merges on name conflict instead of aborting the batch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 3a4e3324..HEAD -- src/server/api/routers/geo/admin/provinces.ts src/lib/geo-validation.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3a4e3324`, 2026-06-17

## Why this matters

After importing provinces via the map editor wizard, **saving fails and nothing
is written** whenever the country already has subdivisions whose names collide
with imported ones. The commit endpoint calls `checkNameUniqueness` for every
province *before* the transaction; the **first** collision throws
`BAD_REQUEST: A subdivision named "X" already exists` and aborts the **entire**
batch. The only escape today is the "Replace existing subdivisions" checkbox,
which **deletes every existing subdivision** — too destructive for a user who
just wants to re-import or add a few provinces. Concrete repro: a country with
existing subdivision `eryx` re-imports an SVG that also contains `eryx`; the
whole import is rejected even though 17 other provinces are new and valid.

The product decision (confirmed by the owner) is **merge**: a province whose
name matches an existing subdivision **updates** that subdivision's geometry;
non-matching names are **created**. Re-imports then "just work" and no data is
lost. This is the same upsert-by-identity pattern the commit already uses for
cities (`upsertCity`).

## Current state

**File: `src/server/api/routers/geo/admin/provinces.ts`** — the `geoAdmin`
province sub-router. The relevant procedure is `commitProvinceImport`
(starts line 283). Today its body does three things that this plan changes:

1. **Name-conflict guard (lines 342–347)** — throws on the first collision:

```ts
// Check for name conflicts with existing subdivisions (unless replacing)
if (!input.replaceExisting) {
  for (const province of input.provinces) {
    await checkNameUniqueness(ctx.db as any, input.countryId, province.name, "subdivision");
  }
}
```

2. **The transaction (lines 349–405)** — deletes-all when replacing, then
   always `create`s every province:

```ts
return await ctx.db.$transaction(async (tx) => {
  // Optionally delete existing subdivisions
  if (input.replaceExisting) {
    await tx.subdivision.deleteMany({
      where: { countryId: input.countryId },
    });
  }

  // Batch create subdivisions
  const created: Array<{ id: string; name: string }> = [];
  for (const province of input.provinces) {
    const subdivision = await tx.subdivision.create({
      data: {
        name: province.name,
        countryId: input.countryId,
        type: province.type,
        level: province.level,
        geometry: province.geometry as any,
        capital: province.capital,
        population: province.population,
        color: province.color,
        status: "approved",
        submittedBy: userId,
      },
    });
    created.push({ id: subdivision.id, name: subdivision.name });
  }

  // Batch create/upsert cities  (lines 377–397 — leave UNCHANGED)
  let citiesCreated = 0;
  if (input.cities && input.cities.length > 0) {
    const { upsertCity } = await import("~/lib/country-geo-service");
    for (const city of input.cities) {
      try {
        await upsertCity(tx, input.countryId, { ... });
        citiesCreated++;
      } catch (err) { console.error(...); }
    }
  }

  return {
    created: created.length,
    replaced: input.replaceExisting,
    subdivisions: created,
    citiesCreated,
  };
});
```

3. The **within-batch duplicate guard (lines 329–340)** stays as-is — two
   imported provinces with the same name is still an error:

```ts
const nameSet = new Set<string>();
for (const province of input.provinces) {
  const key = province.name.trim().toLowerCase();
  if (nameSet.has(key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Duplicate province name in import: "${province.name}"` });
  }
  nameSet.add(key);
}
```

**Convention to follow** — name matching in this codebase is **case-insensitive
on the trimmed name**. `checkNameUniqueness` (in `src/lib/geo-validation.ts:384`)
normalizes with `name.trim().toLowerCase()` and queries with
`{ equals: normalizedName, mode: "insensitive" }`. Match that normalization
exactly so the merge key agrees with the existing uniqueness semantics.

**There is NO DB unique constraint on `(countryId, name)`** for subdivisions
(checked: `prisma/schema/maps.prisma` has `@@index([countryId, status])` and
`@@index([status, createdAt])` only). So matching must be done in application
code via `findMany`/`findFirst`, not relied upon at the DB layer.

**Return-shape consumers**: the wizard's `handleCommit`
(`src/components/maps/editor/province-importer/ProvinceImportWizard.tsx:49-54`)
only checks `if (result)` truthiness; it does not read `result.created`. Adding
an `updated` field is therefore safe.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck (single file) | `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` | exit 0, no errors |
| Typecheck (helper) | `bun run typecheck:file src/lib/province-importer/merge-plan.ts` | exit 0, no errors |
| Lint | `bun run lint` | exit 0 (pre-existing warnings OK; no NEW errors in touched files) |
| Unit test | `bun run test -- src/lib/province-importer/merge-plan.test.ts` | all pass |

Do **NOT** run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build` —
they OOM the server (see `plans/README.md` evergreen facts).

## Scope

**In scope** (the only files you may modify/create):
- `src/server/api/routers/geo/admin/provinces.ts` (modify `commitProvinceImport`)
- `src/lib/province-importer/merge-plan.ts` (create — pure helper)
- `src/lib/province-importer/merge-plan.test.ts` (create — unit test)

**Out of scope** (do NOT touch):
- The cities block inside the transaction (lines 377–397) — works, leave it.
- `checkNameUniqueness` in `src/lib/geo-validation.ts` — other procedures
  (`pois.ts`, `features/cities.ts`) import it; do not change its behavior.
- The `validateProvinceImport` query and `getProvinceImportPreview` query in
  the same file — unrelated.
- Any `geom_postgis` / geometry-repair work — that is Plan 058.
- The `replaceExisting` UI in `CommitStep.tsx` — still valid as the
  "wipe and start fresh" option.

## Git workflow

- Branch: `advisor/057-province-import-merge-on-conflict`
- Conventional-commit message, e.g.
  `fix(geo): merge province import on name conflict instead of aborting batch`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the pure merge-plan helper

Create `src/lib/province-importer/merge-plan.ts`. It decides, for each incoming
province, whether it updates an existing subdivision or creates a new one —
with no DB or React dependency so it is unit-testable.

```ts
/**
 * Pure decision helper for province-import commit.
 * Splits incoming provinces into "update existing" vs "create new" by
 * case-insensitive, trimmed name match against existing subdivisions.
 *
 * No DB/React deps so it is unit-testable. The router passes the existing
 * subdivisions it already loaded.
 */

export interface ExistingSubdivisionRef {
  id: string;
  name: string;
}

export interface MergePlanEntry<T> {
  province: T;
  /** id of the existing subdivision to update, or null to create */
  existingId: string | null;
}

/** Normalize a subdivision name to its match key (matches checkNameUniqueness). */
export function subdivisionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Build a per-province plan. When `replaceExisting` is true, everything is a
 * create (the caller deletes existing rows first), so existingId is always null.
 */
export function buildProvinceMergePlan<T extends { name: string }>(
  incoming: T[],
  existing: ExistingSubdivisionRef[],
  replaceExisting: boolean
): MergePlanEntry<T>[] {
  const byKey = new Map<string, string>();
  if (!replaceExisting) {
    for (const e of existing) byKey.set(subdivisionNameKey(e.name), e.id);
  }
  return incoming.map((province) => ({
    province,
    existingId: replaceExisting ? null : (byKey.get(subdivisionNameKey(province.name)) ?? null),
  }));
}
```

**Verify**: `bun run typecheck:file src/lib/province-importer/merge-plan.ts` → exit 0.

### Step 2: Wire the helper into `commitProvinceImport`

In `src/server/api/routers/geo/admin/provinces.ts`:

1. **Delete** the name-conflict guard block (the lines 342–347 shown in
   "Current state" item 1 — the `if (!input.replaceExisting) { for ... await checkNameUniqueness ... }`).

2. Add an import near the top of the file (with the other imports), matching the
   existing import style in this file:
   ```ts
   import { buildProvinceMergePlan } from "~/lib/province-importer/merge-plan";
   ```

3. **Replace** the "Batch create subdivisions" loop (Current state item 2) with
   a load-existing + plan + upsert loop. The transaction body becomes:

   ```ts
   return await ctx.db.$transaction(async (tx) => {
     if (input.replaceExisting) {
       await tx.subdivision.deleteMany({ where: { countryId: input.countryId } });
     }

     // Load existing subdivisions to merge against (empty set when replacing)
     const existing = input.replaceExisting
       ? []
       : await tx.subdivision.findMany({
           where: { countryId: input.countryId },
           select: { id: true, name: true },
         });

     const plan = buildProvinceMergePlan(input.provinces, existing, input.replaceExisting);

     const created: Array<{ id: string; name: string }> = [];
     let createdCount = 0;
     let updatedCount = 0;

     for (const { province, existingId } of plan) {
       if (existingId) {
         const subdivision = await tx.subdivision.update({
           where: { id: existingId },
           data: {
             type: province.type,
             level: province.level,
             geometry: province.geometry as any,
             capital: province.capital,
             population: province.population,
             color: province.color,
             status: "approved",
           },
         });
         updatedCount++;
         created.push({ id: subdivision.id, name: subdivision.name });
       } else {
         const subdivision = await tx.subdivision.create({
           data: {
             name: province.name,
             countryId: input.countryId,
             type: province.type,
             level: province.level,
             geometry: province.geometry as any,
             capital: province.capital,
             population: province.population,
             color: province.color,
             status: "approved",
             submittedBy: userId,
           },
         });
         createdCount++;
         created.push({ id: subdivision.id, name: subdivision.name });
       }
     }

     // ...existing cities block UNCHANGED...

     return {
       created: createdCount,
       updated: updatedCount,
       replaced: input.replaceExisting,
       subdivisions: created,
       citiesCreated,
     };
   });
   ```

   Note: on update we deliberately do **not** overwrite `name` (it already
   matches by key) or `submittedBy` (preserve original author).

4. If `checkNameUniqueness` is now unused in this file, remove it from the
   import statement (only if it is no longer referenced anywhere else in
   `provinces.ts` — `grep -n "checkNameUniqueness" src/server/api/routers/geo/admin/provinces.ts` should return only the import line; if so, remove that import to avoid a lint error).

**Verify**:
- `grep -n "checkNameUniqueness" src/server/api/routers/geo/admin/provinces.ts` → no remaining *call* sites (import removed if it was the only use).
- `grep -n "buildProvinceMergePlan" src/server/api/routers/geo/admin/provinces.ts` → 2 matches (import + use).
- `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` → exit 0.

### Step 3: Unit-test the helper

Create `src/lib/province-importer/merge-plan.test.ts`, modeled structurally on
`src/lib/__tests__/geo-validation.test.ts` (plain Jest `describe`/`it`/`expect`,
no DB, no fixtures). Cover:

- **create-only**: no existing → every entry `existingId === null`.
- **the regression** (the bug this plan fixes): existing `[{id:"a",name:"eryx"}]`,
  incoming `[{name:"eryx"},{name:"caphiria 1"}]`, `replaceExisting=false` →
  `eryx` maps to `existingId === "a"`, `caphiria 1` maps to `null`.
- **case/whitespace insensitivity**: existing `"Eryx"`, incoming `"  eryx "` →
  matched.
- **replaceExisting=true**: even with a name match, every `existingId === null`.

```ts
import { buildProvinceMergePlan, subdivisionNameKey } from "../province-importer/merge-plan";

describe("buildProvinceMergePlan", () => {
  it("creates all when no existing subdivisions", () => {
    const plan = buildProvinceMergePlan([{ name: "A" }, { name: "B" }], [], false);
    expect(plan.every((e) => e.existingId === null)).toBe(true);
  });

  it("merges a name collision and creates the rest (regression)", () => {
    const plan = buildProvinceMergePlan(
      [{ name: "eryx" }, { name: "caphiria 1" }],
      [{ id: "a", name: "eryx" }],
      false
    );
    expect(plan[0]!.existingId).toBe("a");
    expect(plan[1]!.existingId).toBeNull();
  });

  it("matches case- and whitespace-insensitively", () => {
    const plan = buildProvinceMergePlan([{ name: "  eryx " }], [{ id: "a", name: "Eryx" }], false);
    expect(plan[0]!.existingId).toBe("a");
  });

  it("creates everything when replaceExisting is true", () => {
    const plan = buildProvinceMergePlan([{ name: "eryx" }], [{ id: "a", name: "eryx" }], true);
    expect(plan[0]!.existingId).toBeNull();
  });

  it("normalizes keys", () => {
    expect(subdivisionNameKey("  Foo Bar ")).toBe("foo bar");
  });
});
```

**Verify**: `bun run test -- src/lib/province-importer/merge-plan.test.ts` →
all pass (5 tests).

### Step 4: Full lint pass

**Verify**: `bun run lint` → exit 0 (pre-existing warnings elsewhere are
acceptable; there must be no NEW error in the two touched/created source files).

## Test plan

- New file `src/lib/province-importer/merge-plan.test.ts` with the 5 cases above
  (happy path, the eryx regression, case-insensitivity, replace mode, key
  normalization). Pattern source: `src/lib/__tests__/geo-validation.test.ts`.
- The router transaction itself is not unit-tested (requires a live Prisma/DB
  transaction — consistent with how this repo treats DB-bound commit endpoints).
  Its correctness is covered by the helper test plus the manual smoke below.
- **Manual smoke (do this if a dev server + DB are available; otherwise note it
  as deferred in your report)**: in the map editor, import provinces into a
  country that already has a subdivision sharing a name with one imported
  feature, leave "Replace existing" unchecked, click **Import Provinces** →
  the commit succeeds, the matching subdivision's geometry updates, and new
  provinces are added (no `BAD_REQUEST` toast).

## Done criteria

ALL must hold:

- [ ] `bun run typecheck:file src/server/api/routers/geo/admin/provinces.ts` exits 0
- [ ] `bun run typecheck:file src/lib/province-importer/merge-plan.ts` exits 0
- [ ] `bun run test -- src/lib/province-importer/merge-plan.test.ts` passes (5 tests)
- [ ] `bun run lint` exits 0 with no new error in the touched files
- [ ] `grep -n "await checkNameUniqueness" src/server/api/routers/geo/admin/provinces.ts` returns nothing
- [ ] Only the three in-scope files are modified/created (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `provinces.ts` changed and the "Current state" excerpts
  no longer match (e.g. the commit was already refactored).
- `commitProvinceImport` is found to rely on a DB unique constraint for
  `(countryId, name)` that this plan's app-level match would now conflict with
  (it should not — there is none today).
- Removing the `checkNameUniqueness` import breaks the build because it is used
  by another procedure in the same file (then leave the import in place).
- The manual smoke test produces a *different* error than the name-conflict
  `BAD_REQUEST` (e.g. a PostGIS/geometry error) — that points at Plan 058's
  territory; report it rather than expanding this plan's scope.

## Maintenance notes

- **Reviewer should scrutinize**: that `update` preserves `submittedBy` and does
  not null out columns this endpoint doesn't send (it only sets the listed
  fields — Prisma leaves others untouched, which is intended).
- **Interacts with Plan 058**: 058 adds geometry repair + `geom_postgis` sync to
  this same loop. After 058 lands, both the create and update branches must run
  the repair/sync — 058's plan accounts for both branches.
- **Deferred**: surfacing a "X updated / Y created" summary in `CommitStep.tsx`
  using the new `updated` return field — nice-to-have, not required to fix the
  bug. Left for a future UI pass.
