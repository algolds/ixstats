# Plan 133: Dependency Prune — Purge xlsx, radix-ui meta-bundle, and Demote Tooling Deps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 928bd..HEAD -- package.json src/lib/wiki/data-parser.ts src/lib/wiki/index.ts src/components/ui/color-picker/index.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration / tech-debt
- **Planned at**: commit `928bd`, 2026-08-20
- **Status**: DONE

## Why this matters

The repo currently depends on `xlsx` (imported only in an unreferenced spreadsheet parser `data-parser.ts`) and a meta-package `radix-ui` (imported in only 1 file `color-picker/index.tsx`, when `@radix-ui/react-slider` is already installed). In addition, build/AST/test packages `playwright` and `ts-morph` are currently listed under runtime `dependencies` rather than `devDependencies`. Cleaning these up eliminates redundant bundle overhead, removes unused external tarball dependencies, and tightens dependency hygiene. (Note: `iconoir-react` is explicitly retained).

## Current state

1. `src/lib/wiki/data-parser.ts` (177 lines) imports `* as XLSX from "xlsx"`:
   ```ts
   // src/lib/wiki/data-parser.ts:7
   import * as XLSX from "xlsx";
   ```
   It is only re-exported in `src/lib/wiki/index.ts:94` and is not imported by any consumer in `src/`.
2. `src/components/ui/color-picker/index.tsx:5` imports from the full `radix-ui` meta package:
   ```tsx
   // src/components/ui/color-picker/index.tsx:5
   import { Slider } from "radix-ui";
   ```
   `@radix-ui/react-slider` is already installed in `package.json:189` and used across the codebase as `import * as SliderPrimitive from "@radix-ui/react-slider"`.
3. `package.json` contains:
   ```json
   "playwright": "^1.62.1",
   "radix-ui": "^1.6.7",
   "ts-morph": "^28.0.0",
   "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz"
   ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Audit Arch| `bun run audit:arch`     | exit 0, no errors   |
| Lint      | `bun run lint`           | exit 0              |

## Scope

**In scope**:
- `src/lib/wiki/data-parser.ts` (DELETE)
- `src/lib/wiki/index.ts` (remove re-export of `data-parser`)
- `src/components/ui/color-picker/index.tsx` (replace `radix-ui` import with `@radix-ui/react-slider`)
- `package.json` (remove `xlsx`, remove `radix-ui`, move `playwright` and `ts-morph` to `devDependencies`)

**Out of scope**:
- `iconoir-react` (retained per user instruction)
- Any other `@radix-ui/*` granular packages

## Steps

### Step 1: Replace radix-ui in color-picker with @radix-ui/react-slider

In `src/components/ui/color-picker/index.tsx`, change:
```tsx
import { Slider } from "radix-ui";
```
to:
```tsx
import * as SliderPrimitive from "@radix-ui/react-slider";
```
and replace references `<Slider.Root>` / `<Slider.Track>` / `<Slider.Range>` / `<Slider.Thumb>` with `<SliderPrimitive.Root>` / `<SliderPrimitive.Track>` / `<SliderPrimitive.Range>` / `<SliderPrimitive.Thumb>`.

**Verify**: `bun run lint` → passes on `src/components/ui/color-picker/index.tsx`.

### Step 2: Delete data-parser.ts and remove re-export from wiki index

1. Delete `src/lib/wiki/data-parser.ts`.
2. In `src/lib/wiki/index.ts`, remove `export * from "./data-parser";` (line 94).

**Verify**: `grep -rn "data-parser" src/` → only returns comments in `taxSystem/analysis.ts` and `tax-data-parser.ts` (no references to wiki `data-parser`).

### Step 3: Update package.json dependencies

1. In `package.json`:
   - Delete `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz"` from `dependencies`.
   - Delete `"radix-ui": "^1.6.7"` from `dependencies`.
   - Remove `"playwright": "^1.62.1"` from `dependencies` and add `"playwright": "^1.62.1"` to `devDependencies`.
   - Remove `"ts-morph": "^28.0.0"` from `dependencies` and add `"ts-morph": "^28.0.0"` to `devDependencies`.
2. Run `bun install` to update `bun.lock`.

**Verify**: `bun install` → exits 0.

## Done criteria

- [ ] `xlsx` and `radix-ui` meta package are completely removed from `package.json`
- [ ] `src/lib/wiki/data-parser.ts` is deleted
- [ ] `src/components/ui/color-picker/index.tsx` uses `@radix-ui/react-slider`
- [ ] `playwright` and `ts-morph` are in `devDependencies`
- [ ] `bun install` exits 0 with lockfile synced
- [ ] `plans/README.md` status row updated

## STOP conditions

- If any other file in `src/` is found importing `xlsx` or `data-parser.ts`.
- If `bun install` fails resolving dependencies.

## Maintenance notes

- `iconoir-react` was intentionally kept for Onoma glyph rendering per user instruction.
- All subsequent UI components should import from granular `@radix-ui/react-*` packages, never from `radix-ui`.
