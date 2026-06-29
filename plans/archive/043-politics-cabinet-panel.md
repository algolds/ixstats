# Plan 043: Politics cabinet panel (appoint government from existing backend)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7b4bbf73..HEAD -- src/components/mycountry/EnhancedPoliticsContent.tsx src/components/executive/politics/CabinetPanel.tsx src/server/api/routers/meetings/government.ts src/server/api/routers/government/crud.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7b4bbf73`, 2026-06-16
- **Issue**: (none)

## Why this matters

The government backend already supports departments and officials (`governmentDepartment`, `governmentOfficial` tables, plus tRPC procedures in `src/server/api/routers/meetings/government.ts` and `src/server/api/routers/government/crud.ts`). The Politics section, however, has no UI to view or appoint cabinet members. Surfacing this completes the executive-politics loop and lets players actually staff their government.

## Current state

- `src/server/api/routers/government/crud.ts`:
  - `getByCountryId` (line ~137) returns the country's `governmentStructure` with `departments` (each with `id`, `name`, `minister`, `ministerTitle`, etc.).
- `src/server/api/routers/meetings/government.ts`:
  - `getOfficials` (line ~41) returns active `governmentOfficial` rows, optionally filtered by `governmentStructureId` or `departmentId`, including `department`.
  - `appointOfficial` (line ~20) creates a new official. Required fields: `name`, `title`, `role`, `appointedDate`. Optional: `governmentStructureId`, `departmentId`, `termEndDate`, `bio`.
  - `removeOfficial` (line ~106) soft-deletes an official by setting `isActive: false` and `termEndDate: new Date()`.
- `src/components/mycountry/EnhancedPoliticsContent.tsx` renders the politics section using `SectionShell`, `VitalityRings`, `CrossPillarBanner`, `PoliticsWarRoom`, and `InlineWiki`.
- Existing politics components live under `src/components/executive/politics/` (e.g., `PoliticsWarRoom.tsx`, `LegislaturePanel.tsx`).

## Commands you will need

| Purpose   | Command                                                         | Expected on success        |
|-----------|-----------------------------------------------------------------|----------------------------|
| Test      | `bun run test -- src/components/executive/politics/__tests__/CabinetPanel.test.tsx` | all pass (if you write tests) |
| Lint      | `bun run lint`                                                  | exit 0, no new errors      |
| Typecheck | `bun run typecheck:file src/components/executive/politics/CabinetPanel.tsx`  | exit 0                     |
| Typecheck | `bun run typecheck:file src/components/mycountry/EnhancedPoliticsContent.tsx` | exit 0                     |

## Scope

**In scope**:
- `src/components/executive/politics/CabinetPanel.tsx` — new component to list departments and their appointed officials, plus a form to appoint a new official to a department.
- `src/components/mycountry/EnhancedPoliticsContent.tsx` — render `<CabinetPanel countryId={country.id} />` after `PoliticsWarRoom`.
- `src/components/executive/politics/__tests__/CabinetPanel.test.tsx` — create this test file (optional but recommended).

**Out of scope**:
- Do not add new tRPC procedures beyond what already exists.
- Do not modify the `government` or `meetings` routers unless a tiny adapter is required (document any such change in NOTES).
- Do not implement full government-structure editing; only appoint/remove officials against existing departments.

## Git workflow

- Branch: `advisor/043-politics-cabinet-panel`
- Commit style: conventional commits, e.g. `feat(politics): add CabinetPanel`, `feat(mycountry): render CabinetPanel in politics section`, `test(politics): cover cabinet appointment flow`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create `CabinetPanel.tsx`

Create `src/components/executive/politics/CabinetPanel.tsx`.

1. Fetch data:
   - `api.government.getByCountryId.useQuery({ countryId })` to get `governmentStructure` and `departments`.
   - `api.meetings.government.getOfficials.useQuery({ governmentStructureId: structure?.id, active: true })` to get active officials.
2. Derive a per-department view: for each department, show the department name and any active officials whose `departmentId` matches. If a department has no official, show "Vacant".
3. Add an "Appoint Official" action per vacant department (or a global "+ Appoint" button) that opens a dialog/form with fields:
   - `name` (required)
   - `title` (required — default to the department's `ministerTitle` or "Minister")
   - `role` (required — default to "Cabinet Member")
   - `appointedDate` (required — default to today)
   - `bio` (optional)
4. Use `api.meetings.government.appointOfficial.useMutation()` to submit. On success, invalidate the `getOfficials` query (`api.useUtils().meetings.government.getOfficials.invalidate()`).
5. Add a "Remove" action per official that calls `removeOfficial.mutate({ id, reason: "Resigned" })` and invalidates queries.
6. Match the Facet design system: use `Card`, `Dialog`, `Button`, `Input`, `Label`, `Textarea`, `Badge`, `ScrollArea` from `~/components/ui/*`; use indigo accent consistent with the politics section. Follow the layout patterns in `LegislaturePanel.tsx`.

**Verify**: `bun run typecheck:file src/components/executive/politics/CabinetPanel.tsx` → exit 0.

### Step 2: Wire the panel into the Politics section

Open `src/components/mycountry/EnhancedPoliticsContent.tsx`.

1. Import `CabinetPanel` lazily with `next/dynamic` (follow the pattern of `PoliticsWarRoom` if it is dynamically imported; if not, a static import is fine).
2. Render `<CabinetPanel countryId={country.id} />` after `<PoliticsWarRoom countryId={country.id} />` and before `<InlineWiki ... />`.

**Verify**: `bun run typecheck:file src/components/mycountry/EnhancedPoliticsContent.tsx` → exit 0.

### Step 3: Add tests (optional but recommended)

Create `src/components/executive/politics/__tests__/CabinetPanel.test.tsx`.

Mock tRPC responses and test:
- renders department list and appointed officials.
- renders "Vacant" for a department with no official.
- opens the appoint form and submits (verify the mutation is called with the right `departmentId`).

Use existing component tests as a structural pattern.

**Verify**: `bun run test -- src/components/executive/politics/__tests__/CabinetPanel.test.tsx` → all pass.

### Step 4: Lint

Run `bun run lint` and fix any errors you introduced.

## Done criteria

- [ ] `bun run typecheck:file src/components/executive/politics/CabinetPanel.tsx` exits 0.
- [ ] `bun run typecheck:file src/components/mycountry/EnhancedPoliticsContent.tsx` exits 0.
- [ ] The Politics section shows the new Cabinet panel listing departments and officials.
- [ ] Appointing/removing officials works through the existing `meetings.government` mutations.
- [ ] `bun run lint` exits 0 with no new errors.
- [ ] `git diff --stat` shows only in-scope files changed.
- [ ] `plans/README.md` status row for Plan 043 updated to DONE.

## STOP conditions

Stop and report if:
- `government.getByCountryId` or `meetings.government.getOfficials` / `appointOfficial` / `removeOfficial` do not exist or have a different shape than described.
- No `governmentStructure` / `departments` data path exists for a country.
- Adding the panel requires creating new tRPC procedures or schema changes.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future work may allow editing department `minister`/`ministerTitle` directly; this panel should stay read-only for department metadata and write-only for officials.
- If the politics section later gets tabs, `CabinetPanel` is already a self-contained component that can move into a tab.
- Reviewers should confirm the panel uses the existing mutations and does not introduce new backend code.
