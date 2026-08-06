# Plan 104 (revised): Country Profile (`/countries/[slug]`) UI/UX Refresh → v2 MyCountry Facet Alignment

> **Executor instructions**: Follow step by step. Run every verification command before moving on. If a STOP condition fires, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat HEAD -- "src/app/countries/[slug]/page.tsx" "src/app/countries/[slug]/_components"`

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: LOW-MED · **Depends on**: none
- **Category**: feature / UX redesign / design-system
- **Revision**: 2026-08-06 (drift-corrected; original authored against the non-live `/countries/[slug]/profile` sub-route)

## Drift report (why this revision)

The original plan scoped the **legacy sub-route** `/countries/[slug]/profile` (`profile-page.tsx` + `DynamicCountryHeader`/`PublicVitalityRings`/`PublicExecutiveOverview`/`CountryProfileInfoBox`), but:

1. **The live page is `/countries/[slug]`** (`src/app/countries/[slug]/page.tsx`) and uses entirely different components: `_components/CountryHeader`, `CountryTabs`, `CountryOverviewPanel`, `CountryActivityPanel`, `WikiIntelligenceTab`. The legacy sub-route is an unlinked "testing" route (per `src/app/countries/README.md`) and its only importers are the components themselves. → The refresh must target the live page.
2. **Step 4 (Facet tab strip) is already done.** `MyCountryTabsList.tsx` already renders `FacetTabs tone="mycountry"` (Apple-Switch sliding indicator + spring physics) and is already embedded in the live overview via `MyCountryTabSystem variant="unified"` inside `CountryOverviewPanel.tsx`. The real gap is the **top-level `CountryTabs` (Overview / Dossier / Activity)**, which is still legacy `Button`-based.
3. **`CountryHeader.tsx` is partially modernized** (frosted-glass readability bar, `UnifiedCountryFlag`, owner banner picker, growth badges) but uses legacy `glass-hierarchy-*` classes, fixed blue/green/purple badge colors, and no Facet primitives or flag ambient lighting.
4. **`CountryOverviewPanel.tsx`** already embeds the Facet MyCountry tab system; its sidebar stack (Geography map, `VitalityRings`, Recent Activity) uses legacy `Card`/`glass-hierarchy-*`.
5. **`PublicVitalityRings.tsx`** (legacy) computes a 6-metric `vitalityMetrics` array that is **never rendered** (dead code) — the live `mycountry/primitives/VitalityRings` is the maintained, spring-physics ring component. Migrate the useful metric ideas there, don't re-skin the legacy one.
6. **v2 aesthetic reference**: `src/components/mycountry/v2/V2CommandBriefingHero.tsx` — `FacetCard depth={1}`, cinematic Unsplash overlay (`mix-blend-overlay`, `opacity-20/25`), ambient glow blob + watermark glyph, uppercase micro-labels, border-accent context cards.

## Current state (verified)

| File | State |
|---|---|
| `src/app/countries/[slug]/page.tsx` | Live tabbed profile (Overview / Dossier / Activity). Drives `CountryHeader`, `CountryTabs`, `CountryOverviewPanel`. |
| `_components/CountryHeader.tsx` | Frosted-glass banner + flag + badges + owner banner picker; legacy glass classes. |
| `_components/CountryTabs.tsx` | Legacy `Button` tab strip (`glass-hierarchy-child`). **Primary tab-bar gap.** |
| `_components/CountryOverviewPanel.tsx` | Emits `MyCountryTabSystem variant="unified"` (Facet) + sidebar (`CountryMapEmbed`, `VitalityRings`, Recent Activity) in legacy `Card`s. |
| `mycountry/primitives/VitalityRings.tsx` | Spring `HealthRing` gauges; wraps in legacy `Card`. |
| `[slug]/profile/` + `profile-page.tsx` | Legacy sub-route to **retire**. Sole importer of the 4 legacy components. |
| Facet primitives | `FacetCard` (`~/components/ui/facet-container`, `depth={1..4}`), `FacetTabs` (`~/components/facet-ui`, `tone: neutral/accent/mycountry/forum/sdi`), `StateSeal` (`mycountry/primitives`), `getFlagColors`/`generateFlagThemeCSS` (`--flag-glow-*`, `--country-*`). |

## Design language to match (v2 MyCountry)

- **FacetCard depth hierarchy** — `depth={1}` for surface cards, `depth={2}` for raised telemetry/ring cards.
- **Flag ambient lighting** — flag-derived `--flag-glow-*`/`--country-primary` for glow blobs, borders, and accents (not fixed blue/green/purple).
- **Apple-Switch tabs** — `FacetTabs` sliding sheen + spring physics (already used by `MyCountryTabsList`).
- **v2 briefing hero** — cinematic Unsplash overlay + ambient glow + uppercase `tracking-wider` micro-labels (V2CommandBriefingHero pattern).
- **Spring motion** — `motion/react`; ring gauges already spring via `HealthRing`.

## Commands

| Purpose | Command | Expected on success |
|---|---|---|
| Lint | `bun run lint` | exit 0 |
| Typecheck (frontend) | `bun run typecheck:ui` | exit 0 |
| Dev Server | `bun run dev` | http://localhost:3000 |
| Stale-ref grep | `grep -rn "profile-page\|PublicVitalityRings\|PublicExecutiveOverview\|CountryProfileInfoBox\|DynamicCountryHeader" src` | no legacy refs remain |

## Scope

**In scope**: `[slug]/page.tsx`, `[slug]/_components/CountryHeader.tsx`, `_components/CountryTabs.tsx`, `_components/CountryOverviewPanel.tsx`, `[slug]/profile/` + `profile-page.tsx`, `components/countries/DynamicCountryHeader.tsx`, `PublicVitalityRings.tsx`, `PublicExecutiveOverview.tsx`, `CountryProfileInfoBox.tsx`, admin `rings-audit` manifest string.

**Out of scope**: DB models / tRPC backend schema (except one orphaned procedure — see Step 5); Map Editor routes; private MyCountry dashboard.

## Steps

### Step 1 — Facet Command Header (`_components/CountryHeader.tsx`)
- Wrap the banner block in `FacetCard depth={1}`; add flag-derived ambient glow blob + `backdrop-blur-xl` glass scrim under content (keep the existing frosted-glass readability bar, replacing `bg-black/40` with flag-tinted scrim).
- Add flag theming: `getFlagColors(country.name)` + `generateFlagThemeCSS(flagColors)` on the root; restyle the metric badges (population / GDP / land / growth / continent) as uppercase `tracking-wider` micro-labels tinted by `--flag-*` vars instead of fixed blue/green/purple.
- Title: `tracking-tight` optical sizing; keep `UnifiedCountryFlag` as the emblem (optionally float it in a glass circle = "state seal").
- Keep owner banner picker + Country Actions button; re-skin to Facet tokens.
- **Verify**: `bun run lint`; inspect header on `/countries/[slug]` (flag-lit glass, micro-labels).

### Step 2 — FacetTabs top-level tab bar (`_components/CountryTabs.tsx`)
- Replace the legacy `Button` strip with `FacetTabs` (Overview / Dossier / Activity), mirroring `MyCountryTabsList` (Apple-Switch sheen + spring). Preserve the `TabType` union + `onTabChange` contract so `page.tsx` is untouched.
- Use `tone="mycountry"` (or `"neutral"`) and add per-tab flag-color highlights via the Step 1 theme vars (satisfies the original plan's "HSL flag color highlights" intent, which `MyCountryTabsList` doesn't need since it's already Facet).
- **Verify**: clicking tabs animates the sliding sheen; layout at <640px and >1024px.

### Step 3 — Facet telemetry grid (`_components/CountryOverviewPanel.tsx`)
- Add a **condensed horizontal National Vitality strip** at the top of the overview (4 compact `HealthRing` gauges in a row, 2-up on mobile), flag-tinted from `getFlagColors`, wrapped in `FacetCard depth={2}`.
- Re-skin the sidebar stack: Public Briefing card, Geography map card, and Recent Activity from legacy `Card glass-hierarchy-*` → `FacetCard depth={1}`.
- Add a **public executive briefing card** (v2 briefing-hero style: national posture, diplomatic standing, active economic tier, ambient glow) — this is where the value of the retired `PublicExecutiveOverview` migrates. Build on `FacetCard depth={1}` per `V2CommandBriefingHero`.
- **Verify**: `bun run lint`; rings render as a clean horizontal strip, sidebar cards show glass depth hierarchy.

### Step 4 — Owner command surface (`[slug]/page.tsx`)
- Add the owner-only "Leader Command Surface → Edit in MyCountry" floating pill (migrate from legacy `profile-page.tsx`), flag-tinted, routing to `/mycountry`. Keep the existing Country Actions menu.
- **Verify**: signed-in owner sees the pill; guest sees none.

### Step 5 — Retire the legacy sub-route
- Delete `[slug]/profile/` + `[slug]/profile-page.tsx` and `components/countries/{DynamicCountryHeader,PublicVitalityRings,PublicExecutiveOverview,CountryProfileInfoBox}.tsx` (their useful parts are covered by Steps 1–3 + the live `MyCountryTabSystem`).
- Cleanup: remove orphaned `api.countries.getWikiInfobox` (non-cached; live page uses `getWikiInfoboxCached`) from `src/server/api/routers/countries/wiki.ts:593`; update the `PublicVitalityRings` string entry in `src/app/admin/rings-audit/page.tsx`.
- **Verify**: stale-ref grep returns no legacy refs; `bun run typecheck:ui` and `bun run lint` pass.

## Test plan (manual)

1. `/countries/[slug]` as guest → flag-lit Facet header, FacetTabs (Overview/Dossier/Activity), Facet telemetry grid, MyCountry tab system.
2. As owner → floating Leader Command Surface pill routes to `/mycountry`; banner picker still works.
3. Responsive <640px and >1024px; `prefers-reduced-motion` doesn't break tab/ring animations.

## Done criteria

- [ ] `bun run lint` exit 0.
- [ ] `bun run typecheck:ui` exit 0.
- [ ] Header uses `FacetCard` + flag ambient light; badges are uppercase micro-labels.
- [ ] Top-level `CountryTabs` uses `FacetTabs` with sliding sheen animation.
- [ ] Overview has a condensed horizontal National Vitality strip (flag-tinted rings) + Facet briefing/sidebar cards.
- [ ] Owner "Leader Command Surface" pill renders and routes to `/mycountry`.
- [ ] Legacy sub-route + 4 components deleted; no stale references.

## STOP conditions

- `CountryHeader`/`CountryTabs`/`CountryOverviewPanel` deviate significantly from baseline → verify diff is intended.
- Lint/typecheck fails after edits (unresolved).
- Retirement breaks a live importer (stale-ref grep shows a ref outside `[slug]/profile` or `rings-audit`).
