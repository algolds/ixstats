# Country Profile Navigation Redesign Design Spec

**Date:** 2026-08-06
**Status:** Approved (Approach 1)

## Goal

Fix the unintuitive multi-layer navigation on the public country profile page (`/countries/[slug]`) and the `/mycountry` command suite. Today the profile stacks up to 3 identical-looking `FacetTabs` bars:

1. **Layer 1 — page tabs**: `Factbook | Dossier | Activity`
2. **Layer 2 — factbook sections**: `Factbook | Economy | Government | Geography`
3. **Layer 3 — economy sub-tabs**: `Economy | Labor` (hidden until Economy is selected)

Problems confirmed with the user:

- **No clear hierarchy** — all layers use the same `FacetTabs` component, differing only by size/tone.
- **Hidden third layer** — `Labor` is buried inside `Economy`.
- **Duplicate "Factbook" label** — Layer 1 and Layer 2 both show a tab literally named "Factbook" simultaneously.
- **No deep-linking** — Layer 1 state isn't in the URL at all; Layers 2/3 collide on the same `#hash`.

## Decisions (from brainstorming)

- **Flatten to 2 levels**: Labor is promoted back to a top-level factbook section.
- **Rename** the Layer-2 first tab from "Factbook" → **"At a Glance"** (renders `OverviewTab`). Layer 1 keeps "Factbook" as the umbrella.
- **Visual hierarchy**: prominent top bar (page tabs) + inner pills (factbook sections).
- **Routing**: real nested routes (not query params, not hash) for shareable/deep-linkable URLs.
- **Scope**: apply to both the public page and `/mycountry` (they share `MyCountryTabSystem`).
- **Dossier sub-views** (`Wiki Synced | Native Canvas Lore`): keep as the existing in-page toggle — not routed.
- **Sidebar** (vitality + geography + recent activity): keep visible across all 5 factbook sections.

## Resulting Information Architecture

Two visual tiers only:

- **Tier 1 — page tabs** (prominent top bar): `Factbook | Dossier | Activity`
- **Tier 2 — factbook sections** (inner pills): `At a Glance | Economy | Labor | Government | Geography`

## Routing (nested routes)

```
src/app/countries/[slug]/layout.tsx                        ← country shell
  CountryHeader, breadcrumb, CountryActionsMenu,
  CountryTabs = prominent top bar (Link-based, active from pathname)
  {children}
src/app/countries/[slug]/page.tsx                          ← client redirect → /countries/[slug]/factbook
src/app/countries/[slug]/factbook/layout.tsx               ← factbook shell
  CountryDataProvider (isPublicReadOnly) + metrics provider
  MyCountryTabsList (inner pills, Link mode)
  shared metric-details modals + sidebar (vitality + geography + recent activity)
  {children}
src/app/countries/[slug]/factbook/page.tsx                 ← At a Glance (OverviewTab)
src/app/countries/[slug]/factbook/economy/page.tsx         ← EconomyTab
src/app/countries/[slug]/factbook/labor/page.tsx           ← LaborTab
src/app/countries/[slug]/factbook/government/page.tsx      ← GovernmentTab
src/app/countries/[slug]/factbook/geography/page.tsx       ← GeographyTab
src/app/countries/[slug]/dossier/page.tsx                  ← DossierTab (existing component)
src/app/countries/[slug]/activity/page.tsx                 ← CountryActivityPanel (existing)
src/app/countries/[slug]/modeling/page.tsx                 ← unchanged
```

### Why layouts

- `[slug]/layout.tsx` persists across all children (App Router), so header + top bar don't remount on section switches. It owns the country query (`countries.getByIdWithEconomicData`) that currently lives in `[slug]/page.tsx`, plus `useCountryPageState` (banner mode, GDP/population toggles, actions menu).
- `factbook/layout.tsx` persists across all 5 factbook sections, so pills, sidebar, and modals stay mounted and only the section content swaps. It reads the `slug` from its own params and wraps children in `CountryDataProvider userId="" countryId={slug} isPublicReadOnly` + `FactbookMetricsProvider`.
- Both existing sibling routes (`modeling`) and all existing inbound links to `/countries/[slug]` keep working.

### Legacy back-compat

Old hash deep links must still resolve. `/countries/[slug]#economy|#labor|#government|#geography|#overview|#dossier|#activity` are mapped by `[slug]/page.tsx` (client component that reads `location.hash` on mount) to the corresponding nested route before navigating. Sources of these links include `V2DrillSheets.tsx` (`/countries/${id}#${drill.kind}`) and the pre-existing `useMyCountryNavigation` hash behavior.

## Component Changes

| File | Change |
|---|---|
| `src/components/mycountry/tabs/MyCountryTabsList.tsx` | Add `baseHref` prop → renders `<Link>`s (public route mode) vs. buttons (mycountry state mode). Rename `overview` label → "At a Glance". Add promoted `labor` tab (reuse theme colors from `EconomyLaborTab`). |
| `src/components/mycountry/MyCountryTabSystem.tsx` | Remove `EconomyLaborTab` nesting — render `EconomyTab` and `LaborTab` as separate `TabsContent`. Keep hash/state mode for `/mycountry` (via `useMyCountryNavigation`). |
| `src/components/mycountry/tabs/EconomyLaborTab.tsx` | **Deleted** (no remaining usages after flattening). Remove its export from `tabs/index.ts`. |
| `src/app/countries/[slug]/_components/CountryTabs.tsx` | Convert to Link-based prominent top bar; active tab derived from pathname. Prominent `size="lg"` styling, flag-colored active states. |
| `src/hooks/useMyCountryNavigation.ts` | Remove the `labor → economy` hash remap (Labor is top-level again). Remains `/mycountry`-only. |
| `src/app/countries/[slug]/_components/CountryOverviewPanel.tsx` | Decomposed: factbook hosting → `factbook/layout.tsx` + section pages; sidebar (vitality/geography/activity) → factbook layout. |
| `src/components/mycountry/FactbookMetricsProvider.tsx` *(new)* | Provider wrapping `useMyCountryMetrics`; exposes `useFactbookMetrics()`. Shared by `/mycountry` and public factbook shell. |
| `src/components/mycountry/FactbookModals.tsx` *(new)* | Shared modal renderer (upload + metric-details modals). Used by `MyCountryTabSystem` and `factbook/layout.tsx`. |
| `src/app/countries/[slug]/_hooks/useCountryPageState.ts` | No change to its logic; its caller moves from `page.tsx` to `layout.tsx`. |
| `src/components/countries/dossier/WikiHeader.tsx` | No change (in-page toggle kept). |

### Metrics sharing (new shared provider + modals)

Create in `src/components/mycountry/`:

- **`FactbookMetricsProvider`** — calls `useMyCountryMetrics(section)` once, exposes the return via `useFactbookMetrics()` context. Used by BOTH `MyCountryTabSystem` (state mode, `/mycountry`) and the public `factbook/layout.tsx` (route mode) — no divergence.
- **`FactbookModals`** — renders `CardImageUploadModal` + all metric-details modals from context (the modal JSX currently inline in `MyCountryTabSystem` lines 138–203). Rendered once by `MyCountryTabSystem` (state mode) and once by `factbook/layout.tsx` (route mode).

This keeps modal state (`imageUploadModal`, metric-details modal) and `metricView` toggles persistent across section navigations on the public page, since the provider lives in `factbook/layout.tsx` (which stays mounted).

Section pages are thin: each resolves its section from `usePathname()`/params and renders the corresponding tab component, consuming `useFactbookMetrics()`.

## Visual Hierarchy

- **Top bar** (`CountryTabs`): `FacetTabs size="lg"`, full-width, flag-colored active indicator, prominent placement directly under the breadcrumb/header.
- **Inner pills** (`MyCountryTabsList`): `size="sm"`, grouped in a contained strip inside the factbook shell with a small "FACTBOOK" eyebrow label — visually subordinate to the top bar.
- **Dossier segmented control**: unchanged; already visually distinct (custom control, not `FacetTabs`) and reads as a view toggle rather than a nav tier.

## Error Handling & Data Flow

- Country loading skeleton + not-found/error cards move from `[slug]/page.tsx` up to `[slug]/layout.tsx` (the shell owns the country query).
- Unknown factbook section in URL → redirect to `/factbook`.
- Invalid/unknown hash on mount → redirect to `/factbook`.
- `/mycountry` functionality unchanged (state mode); it inherits the flattening + rename automatically via the shared `MyCountryTabsList`/`MyCountryTabSystem`.

## Testing

- Run `bun run typecheck` (sequentially: ui, server, trpc, db).
- Run `bun run lint` (pre-existing issues expected).
- Run existing Jest suite (`bun run test`).
- Add a Jest test for the hash→route mapping and the factbook section config (At a Glance + Labor present; no duplicate "Factbook" labels at the two tiers).
- Manual verification:
  - Deep-link each new route directly (`/factbook/labor`, `/dossier`, `/activity`).
  - Browser back/forward across sections.
  - Refresh mid-section — state persists via URL.
  - Old `/countries/[slug]#economy` link still resolves.
  - `/mycountry` — Labor now a top-level pill; no behavior regression in the executive suite.

## Out of Scope

- Dossier `Wiki Synced | Native Canvas Lore` routing (kept as in-page toggle).
- Any changes to `modeling`, `/mycountry` sidebar nav, or the Dossier component internals.
- Facet design-system work beyond the top-bar/pill styling described above.
