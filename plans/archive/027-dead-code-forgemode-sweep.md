# Plan 027: Dead code sweep — forgeMode + Plan 024 leftovers

## Status
- **Priority**: P3
- **Effort**: S (~0.5h)
- **Risk**: LOW (removing dead code only — zero behavior change)
- **Depends on**: 024 (DONE — forge removed; dead variable remains)
- **Category**: tech debt
- **Planned at**: commit `daecb2ed`, 2026-06-15

## Why this matters

Plan 024 removed forge mode from the unified world editor (`946e4543`) but left behind dead state variables and UI references. These are confusing for future readers and suggest features that don't exist. Clean them up while the editor surface is fresh.

## Current state

- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts:551` — `const [forgeMode, setForgeMode] = useState(false);` — never consumed (grep confirms zero reads of `forgeMode` outside its own declaration/return).
- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts:1294` — `forgeMode,` in the return object.
- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts:1305` — `setForgeMode,` in the return object.
- `src/components/maps/editor/MapEditorOverlay.tsx` — destructured `forgeMode` and `setForgeMode` may be present.

## Scope

**In scope:**
- `src/components/maps/editor/hooks/useMapEditorOverlayState.ts` — remove `forgeMode`/`setForgeMode` declaration + return keys.
- `src/components/maps/editor/MapEditorOverlay.tsx` — remove `forgeMode`/`setForgeMode` destructuring if present.

**Out of scope:** Other dead code (admin-only, unrelated files).

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun run test` | 604/604 |
| Lint | `bun run lint` | 0 errors |
| Typecheck changed file | `bun run typecheck:file <path>` | exit 0 |

## Steps

1. **Remove forgeMode from `useMapEditorOverlayState.ts`:**
   - Delete line `const [forgeMode, setForgeMode] = useState(false);` (currently ~line 551).
   - Delete `forgeMode,` and `setForgeMode,` from the return object (~lines 1294, 1305).
   - **Verify:** `bun run typecheck:file src/components/maps/editor/hooks/useMapEditorOverlayState.ts` → exit 0.

2. **Remove from `MapEditorOverlay.tsx`:**
   - Search for `forgeMode` and `setForgeMode` in the destructuring block (~lines 165-224).
   - Delete any occurrences.
   - **Verify:** `bun run typecheck:file src/components/maps/editor/MapEditorOverlay.tsx` → exit 0.

3. **Global check:** `grep -rn "forgeMode\|setForgeMode" src/ --include="*.ts" --include="*.tsx"` → zero matches.

4. **Run `bun run test`** → 604/604. **Run `bun run lint`** → 0 errors, 9 pre-existing warnings.

## Done criteria

- [ ] `grep -rn "forgeMode\|setForgeMode" src/` returns zero matches.
- [ ] 604/604 tests.
- [ ] 0 new lint errors.
- [ ] `plans/README.md` row updated.

## STOP conditions

- `forgeMode` or `setForgeMode` is consumed in any file other than the declaration + return — STOP and report (the context may be needed). Verify with `grep -rn "forgeMode" src/` before starting.

## Maintenance notes

- If forge-like functionality is ever re-added, use a different name to avoid confusion with the removed implementation.
