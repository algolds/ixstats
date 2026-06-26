# Plan 083: Move Countries Search Modal into Dynamic Island and Clean Up Header Nav

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: 
> `git diff --stat a024f856..HEAD -- src/app/countries/_components/CountriesPageModular.tsx src/app/countries/_components/CountriesFilterSidebar.tsx src/app/countries/_components/CountriesSortBar.tsx src/app/countries/_components/CountryComparisonModal.tsx src/components/DynamicIsland/hooks.ts src/components/DynamicIsland/CountriesDIView.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / direction (UI)
- **Planned at**: commit `a024f856`, 2026-06-18

## Why this matters

QA reported search icon alignment and scroll jump issues on the explore/countries page. Additionally, to align with the WikiOS and Dynamic Island (Halo) design system, the countries search modal should be moved into a Dynamic Island plugin view, and the old modal palette and redundant inline search elements should be removed from the main layout.

## Current state

- `src/app/countries/_components/CountriesPageModular.tsx` renders the modular layout for the countries directory page. It currently imports and renders `<CountriesHeader>` and `<CountriesCommandPalette>`.
- `src/app/countries/_components/CountriesSortBar.tsx` and `src/app/countries/_components/CountriesFilterSidebar.tsx` contain search inputs where magnifying glass search icons are misaligned or missing, and browser autocompletion popups can cover the search field.
- `src/app/countries/_components/CountryComparisonModal.tsx` contains a country search command palette where autofocusing on open causes the screen to scroll or jump.
- `src/components/DynamicIsland/hooks.ts` contains the state hook for the Dynamic Island but lacks dispatch sync for external events.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Test      | `bun run test`           | exit 0, all 690 pass|
| Lint      | `bun run lint`           | exit 0, no errors   |

## Scope

**In scope:**
- `src/app/countries/_components/CountriesPageModular.tsx`
- `src/app/countries/_components/CountriesFilterSidebar.tsx`
- `src/app/countries/_components/CountriesSortBar.tsx`
- `src/app/countries/_components/CountryComparisonModal.tsx`
- `src/components/DynamicIsland/hooks.ts`
- `src/components/DynamicIsland/CountriesDIView.tsx` (new file)

**Out of scope:**
- Modifying general Dynamic Island layout templates or other unrelated DI views.
- Modifying backend filters or database query schemas.

## Git workflow

- Branch: `advisor/083-countries-search-dynamic-island`
- Commit: `feat(countries): move search modal to dynamic island and clean up inline search layout`

## Steps

### Step 1: Create the Countries Dynamic Island plugin view
Create the new view component `src/components/DynamicIsland/CountriesDIView.tsx`. This component mimics the command palette modal's styling but fits within the expanded layout of the Dynamic Island. Ensure inputs are focused with `preventScroll: true` to avoid screen jumps.

**Verify**: The file `src/components/DynamicIsland/CountriesDIView.tsx` exists and compiles cleanly.

### Step 2: Implement Dynamic Island state dispatch synchronizers
In `src/components/DynamicIsland/hooks.ts`, dispatch the `"ix:di-mode-changed"` custom event inside `switchMode` to sync page-level state. Add a global event listener for `"ix:switch-di-mode"` to allow pages to trigger Dynamic Island mode changes.

**Verify**: `git diff src/components/DynamicIsland/hooks.ts` shows the custom event listener and dispatch logic.

### Step 3: Register countries plugin and clean up old modal & inline search
In `src/app/countries/_components/CountriesPageModular.tsx`:
1. Register `countriesDIPlugin` using the `useDIPlugin` hook.
2. Listen to the `"ix:di-mode-changed"` event to sync the `isDIPaletteOpen` state.
3. Replace the `Tab` key handler to trigger `ix:switch-di-mode` with `plugin:countries` instead of toggling the old `showDynamicIsland` modal overlay state.
4. Remove `<CountriesCommandPalette>` from the render hierarchy.
5. Remove the redundant `<CountriesHeader>` button pill and inline search input from the layout.
6. Fix any unused imports or TDZ issues.

**Verify**: The inline search bar and header button are removed from the layout return.

### Step 4: Centering search icons and disabling autocomplete
1. In `src/app/countries/_components/CountriesSortBar.tsx` and `src/app/countries/_components/CountriesFilterSidebar.tsx`, wrap the search inputs in `relative flex items-center` containers and style the `Search` icons with absolute centering to prevent off-center layout shifts.
2. Set `autoComplete="new-password"` on all search inputs to suppress native browser autocomplete popups.
3. In `src/app/countries/_components/CountryComparisonModal.tsx`, intercept `onOpenAutoFocus` inside the country search Popover to call `input.focus({ preventScroll: true })`.

**Verify**: `bun run lint` exits with 0 errors.

## Test plan

- Run `bun run test` to verify that all test suites pass.
- Start the development server (`bun run dev`) and test the `/countries` page:
  - Verify that the page renders without the inline search bar or tab shortcut header.
  - Press `Tab` and verify that the Dynamic Island expands smoothly into the Countries Search plugin view.
  - Verify that the search input inside the island autofocuses without causing the page to jump.
  - Verify that sorting, filtering, "Reshuffle", and "Lucky" actions within the island work and correctly filter the grid list.
  - Open the comparison modal and verify that the search box autofocuses without scrolling the page.

## Done criteria

- [ ] `bun run lint` exits 0 (unused imports resolved)
- [ ] `bun run test` exits 0 with all tests passing
- [ ] No inline search elements or old modal overlays exist in `/countries`
- [ ] Search input autofocus uses `preventScroll: true`
- [ ] All search icons are vertically centered and native autocomplete is suppressed using `autoComplete="new-password"`
- [ ] `plans/README.md` is updated

## STOP conditions

- If the Dynamic Island plugin registration hook (`useDIPlugin`) crashes the app on render.
- If browser behavior blocks `autoComplete="new-password"` or overrides `preventScroll: true`.

## Maintenance notes

- Reviewer: ensure no unused imports are left in `CountriesPageModular.tsx`.
- Reviewer: verify that the custom events (`ix:switch-di-mode` and `ix:di-mode-changed`) do not conflict with other active island plugins.
