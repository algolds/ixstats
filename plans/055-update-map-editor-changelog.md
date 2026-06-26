# Plan 055: Update Map Editor Welcome Modal Changelog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 098a44bc..HEAD -- src/components/maps/editor/components/MapEditorWelcomeModal.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P3 (polish — tells returning users what changed)
- **Effort**: S (one file, two array entries, one constant)
- **Risk**: LOW (purely additive string changes; no logic)
- **Depends on**: 053 + 054 (DONE) — changelog entries reference those plans
- **Category**: polish
- **Planned at**: commit `098a44bc`, 2026-06-16
- **Issue**: (none)

## Why this matters

The map editor welcome modal shows a changelog page to returning users. Plans
053 (auto-derive elevation/area) and 054 (bulk city importer) are user-facing
features that should be surfaced there. Bumping the welcome version ensures
existing users see the updated changelog the next time they open the editor.

## Current state

`src/components/maps/editor/components/MapEditorWelcomeModal.tsx`:

- Line 22 imports `MAP_EDITOR_WELCOME_VERSION` from `~/lib/buildVersion`:
  ```ts
  import { MAP_EDITOR_WELCOME_VERSION } from "~/lib/buildVersion";
  ```
- Lines 78-99 define the `CHANGELOG` array:
  ```ts
  const CHANGELOG = [
    {
      version: "v2.1",
      title: "Hierarchical Layers Tree",
      desc: "Merged the old Layers and Features tabs into a single unified tree view...",
    },
    {
      version: "v2.0",
      title: "Dialog-based Province Importer",
      desc: "Migrated the GeoJSON Province Import Wizard into a standard modal overlay...",
    },
    ...
  ];
  ```
- The version displayed in the modal is `MAP_EDITOR_WELCOME_VERSION`, which is
  derived from the app's build version registry in `src/lib/buildVersion.ts`.
  You do NOT need to edit `buildVersion.ts`; just rely on the imported
  constant.

## Commands you will need

| Purpose            | Command                                                                       | Expected on success |
|--------------------|-------------------------------------------------------------------------------|---------------------|
| Typecheck UI       | `tsc -p tsconfig.ui.json --noEmit` (or `bun run typecheck:file <path>`)       | 0 errors in scope   |
| Lint               | `bun run lint`                                                                | exit 0 (no new errors) |
| Test               | `bun run test`                                                                | all pass (no regressions) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run build`.

## Scope

**In scope** (only file to modify):
- `src/components/maps/editor/components/MapEditorWelcomeModal.tsx` — prepend
  two new entries to `CHANGELOG` and update `MAP_EDITOR_WELCOME_VERSION` usage
  so the modal re-appears for existing users.

**Out of scope (do NOT touch):**
- `src/lib/buildVersion.ts` — the welcome version comes from the build-version
  registry; do not edit it.
- Any other changelog or release notes files.

## Git workflow

- Branch: `advisor/055-update-map-editor-changelog` off the verification
  branch that contains Plans 053 and 054 (or off `v2` if 053/054 are already
  merged).
- Conventional commit, e.g. `feat(maps): add editor changelog entries for city auto-elevation and city importer`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Prepend new changelog entries

In `MapEditorWelcomeModal.tsx`, update the `CHANGELOG` array so the two most
recent entries are first:

```ts
const CHANGELOG = [
  {
    version: "v2.4",
    title: "Bulk City Importer",
    desc: "Upload a CSV, TSV, or JSON file to create many cities at once. Validates coordinates inside your borders and reports any rows that need fixing.",
  },
  {
    version: "v2.3",
    title: "Auto-Derived City Elevation & Region Area",
    desc: "City elevation and region area now auto-fill from terrain zones and geometry. Manual overrides still accepted — click the Auto button to derive.",
  },
  {
    version: "v2.2",
    title: "Toolbar Consolidation",
    desc: "Moved Network view, Snap toggle, Grid, and Center controls into the editor toolbar for a cleaner canvas.",
  },
  {
    version: "v2.1",
    title: "Hierarchical Layers Tree",
    desc: "Merged the old Layers and Features tabs into a single unified tree view. Click to expand layer groups and select child features directly.",
  },
  ...
];
```

Keep the existing `v2.0`, `v1.9`, `v1.8` entries below unchanged.

**Verify**:
- `grep -c "Bulk City Importer" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 1.
- `grep -c "Auto-Derived City Elevation" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 1.

### Step 2: Ensure the modal re-appears for existing users

The modal uses `MAP_EDITOR_WELCOME_VERSION` as the local-storage key value:

```ts
localStorage.setItem(STORAGE_KEY, MAP_EDITOR_WELCOME_VERSION);
```

Because `MAP_EDITOR_WELCOME_VERSION` is derived from the app build version, it
will change whenever the app version bumps, causing the modal to show again.
No code change is required for this behavior.

However, if the imported constant is currently a literal string (e.g.
`"2.1.0"`) and not the app version, the reviewer will update the registry.
You do not need to touch `buildVersion.ts`.

**Verify**:
- `grep -c "MAP_EDITOR_WELCOME_VERSION" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 2 (import + usage).

### Step 3: Full test + lint gate

**Verify**:
- `bun run lint` → exit 0 (no new errors).
- `bun run test` → all pass (no regressions).
- `tsc -p tsconfig.ui.json --noEmit` → 0 errors in scope.

## Test plan

No automated tests. Manual check (non-blocking):

1. Open the map editor.
2. If the modal does not appear automatically, click the help icon to force
   it open.
3. Navigate to the Changelog page.
4. Confirm the top three entries are:
   - Bulk City Importer
   - Auto-Derived City Elevation & Region Area
   - Toolbar Consolidation

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run lint` exits 0
- [ ] `bun run test` → all suites pass (no regressions)
- [ ] `grep -c "Bulk City Importer" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 1
- [ ] `grep -c "Auto-Derived City Elevation" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 1
- [ ] `grep -c "MAP_EDITOR_WELCOME_VERSION" src/components/maps/editor/components/MapEditorWelcomeModal.tsx` → 2
- [ ] `git status --porcelain` shows only the one file modified
- [ ] `plans/README.md` status row for 055 updated (SKIP — reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- `MapEditorWelcomeModal.tsx` no longer imports `MAP_EDITOR_WELCOME_VERSION`.
- The `CHANGELOG` array structure changed (e.g. keys renamed).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- **Version numbers are illustrative.** The `v2.4`, `v2.3`, `v2.2` strings are
  user-facing labels only; the actual "has the user seen this" check uses
  `MAP_EDITOR_WELCOME_VERSION`. If the design team wants a different labeling
  scheme later, only these strings change.
- **Why include Toolbar Consolidation now.** Plan 052 landed recently and was
  not announced in the changelog; adding it here closes the loop for users
  who missed the toolbar change.
