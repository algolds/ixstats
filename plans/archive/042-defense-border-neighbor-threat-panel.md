# Plan 042: Defense border / neighbor-threat panel

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7b4bbf73..HEAD -- src/components/mycountry/EnhancedDefenseContent.tsx src/components/defense/BorderThreatPanel.tsx src/server/api/routers/security/borders.ts`
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

The Defense section already models border security and neighbor threat assessments in `src/server/api/routers/security/borders.ts`, but none of that modeled data is surfaced in the MyCountry Defense UI. Adding a read-only panel makes the modeled threats visible to players and unblocks future gameplay that reacts to neighbor threat levels.

## Current state

- `src/server/api/routers/security/borders.ts`:
  - `getBorderSecurity` (line ~166) returns a `BorderSecurity` record including `neighborThreats: NeighborThreatAssessment[]`.
  - `NeighborThreatAssessment` fields include `neighborName`, `threatLevel` ("minimal" | "low" | "moderate" | "high" | "critical"), `threatScore` (0–100), `militaryThreat`, `terrorismRisk`, `smugglingRisk`, `refugeeFlow`, `politicalStability`, `diplomaticRelations`, `borderType`, `borderLength`, `notes`.
- `src/components/mycountry/EnhancedDefenseContent.tsx`:
  - Current tabs: `type DefenseTab = "command" | "forces" | "operations";`.
  - Tabs render `<DefenseCommandPanel />`, `<MilitaryCustomizer />`, `<OperationsPanel />`.
  - Uses `SectionShell` with `section="defense"` and a red theme.
- Existing defense components live under `src/components/defense/` (e.g., `DefenseCommandPanel.tsx`, `OperationsPanel.tsx`, `MilitaryCustomizer.tsx`).
- Existing sidebar widget: `src/components/mycountry/sidebar-widgets/DefenseSidebarWidget.tsx`.

## Commands you will need

| Purpose   | Command                                                         | Expected on success        |
|-----------|-----------------------------------------------------------------|----------------------------|
| Test      | `bun run test -- src/components/defense/__tests__/BorderThreatPanel.test.tsx` | all pass (if you write tests) |
| Lint      | `bun run lint`                                                  | exit 0, no new errors      |
| Typecheck | `bun run typecheck:file src/components/defense/BorderThreatPanel.tsx`        | exit 0                     |
| Typecheck | `bun run typecheck:file src/components/mycountry/EnhancedDefenseContent.tsx` | exit 0                     |

## Scope

**In scope**:
- `src/components/defense/BorderThreatPanel.tsx` — new read-only panel component.
- `src/components/mycountry/EnhancedDefenseContent.tsx` — add a "Borders" tab and render the new panel.
- `src/components/defense/__tests__/BorderThreatPanel.test.tsx` — create this test file (optional but recommended).

**Out of scope**:
- Do not add new tRPC mutations; use the existing `getBorderSecurity` query.
- Do not modify the `security/borders.ts` router beyond ensuring the query shape is usable (it already is).
- Do not change the Defense sidebar widget unless the panel is trivially small and done.

## Git workflow

- Branch: `advisor/042-defense-border-threat-panel`
- Commit style: conventional commits, e.g. `feat(defense): add BorderThreatPanel`, `feat(mycountry): add borders tab to defense section`, `test(defense): cover BorderThreatPanel rendering`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create `BorderThreatPanel.tsx`

Create `src/components/defense/BorderThreatPanel.tsx`.

1. Use `api.security.getBorderSecurity.useQuery({ countryId })` to fetch data.
2. Render a loading skeleton/spinner while loading (match the style used in `OperationsPanel` or `DefenseCommandPanel`).
3. Render two cards:
   - **Border Security Overview**: show `overallSecurityLevel` (0–100), `securityStatus`, `borderLength`, `landBorders`, `maritimeBorders`, `checkpoints`, `surveillanceSystems`.
   - **Neighbor Threats**: a list/table of `neighborThreats`. For each threat show `neighborName`, `borderType`, `threatLevel` badge, `threatScore` progress bar, and optional notes. Use color-coded badges: minimal/low = emerald, moderate = amber, high/critical = red.
4. Empty state: if `neighborThreats` is empty, show "No neighbor threat assessments recorded yet."

Match the Facet design system: use existing primitives like `Card`, `Badge`, `Progress`, `ScrollArea` from `~/components/ui/*`; use Tailwind glass/physics classes consistent with the defense section (red accent). Look at `OperationsPanel.tsx` for component structure conventions.

**Verify**: `bun run typecheck:file src/components/defense/BorderThreatPanel.tsx` → exit 0.

### Step 2: Wire the panel into the Defense section

Open `src/components/mycountry/EnhancedDefenseContent.tsx`.

1. Add `"borders"` to the `DefenseTab` union: `type DefenseTab = "command" | "forces" | "operations" | "borders";`.
2. Add a new tab trigger next to the existing three tabs with label "Borders" and icon `Shield` or `Globe` from `lucide-react`.
3. Add a new `<ThemedTabContent theme="defense">` block for `activeTab === "borders"` that renders `<BorderThreatPanel countryId={country.id} />`.
4. Import the new component lazily with `next/dynamic` (follow the pattern of `EnhancedDefenseContent` itself).

**Verify**: `bun run typecheck:file src/components/mycountry/EnhancedDefenseContent.tsx` → exit 0.

### Step 3: Add tests (optional but recommended)

Create `src/components/defense/__tests__/BorderThreatPanel.test.tsx`.

Use React Testing Library. Mock tRPC with `api.useUtils` / render a wrapper if needed; the project has existing component test patterns (e.g., `src/components/__tests__/stability-guardrails.test.tsx`). At minimum, test:
- renders loading state.
- renders overview stats and neighbor threat rows when data returns.
- renders empty state when `neighborThreats` is empty.

**Verify**: `bun run test -- src/components/defense/__tests__/BorderThreatPanel.test.tsx` → all pass.

### Step 4: Lint

Run `bun run lint` and fix any errors you introduced.

## Done criteria

- [ ] `bun run typecheck:file src/components/defense/BorderThreatPanel.tsx` exits 0.
- [ ] `bun run typecheck:file src/components/mycountry/EnhancedDefenseContent.tsx` exits 0.
- [ ] A "Borders" tab appears in the MyCountry Defense section and renders `BorderThreatPanel`.
- [ ] `bun run lint` exits 0 with no new errors.
- [ ] `git diff --stat` shows only in-scope files changed.
- [ ] `plans/README.md` status row for Plan 042 updated to DONE.

## STOP conditions

Stop and report if:
- `getBorderSecurity` query does not exist or does not include `neighborThreats`.
- `EnhancedDefenseContent.tsx` does not have a tab system you can extend.
- Adding the panel requires creating new tRPC procedures or schema changes.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future work may add CRUD for neighbor threats in this panel; keep the component data-driven so mutations can be added later without restructuring.
- If the defense section gets a fourth or fifth tab, consider extracting the tab configuration into an array.
- Reviewers should confirm the panel is read-only and uses the existing query.
