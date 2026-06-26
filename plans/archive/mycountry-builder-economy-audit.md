# MyCountry Builder Audit + Finish Economy Builder & Preview

## Context

The MyCountry builder (`/builder`, flow: Foundation → Identity → Government → Economics → Preview)
is mostly complete: Foundation/Identity and the **Government builder** are the reference design
(`BuilderTabCard` + `GlassCard` emerald/teal glass theme, warnings surfaced inline, component
synergy/conflict via `MetricsPanel` + Interactions Dialog). The **Economy builder** already mirrors
that structure but has three rough edges the user called out, plus the **Preview step** is visually
inconsistent. This effort finishes the economy builder + preview to ship-quality.

Goal (user-confirmed decisions):
- **A.** Move *all* builder alerts/warnings into the **dynamic-island notch bar** (not just economy);
  retire the economy-only right sidebar.
- **B.** **Reskin + integrate + re-enable** the tax system (currently disabled) into the economy builder.
- **C.** Make the economy builder UX more intuitive: simplify sectors, add guided flow & presets,
  add live impact feedback, unify layout/headers.
- **D.** Restyle the **Preview step** to the glass theme.

## Audit findings (UI / UX / performance)

**UI / consistency**
- Preview step ([BuilderPreviewStep.tsx](src/app/builder/components/enhanced/sections/BuilderPreviewStep.tsx)) uses light pastel `Card`s (`bg-amber-50/30`, `blue-50`, `indigo-50`, `green-50`, `red-50`) — clashes with the glass theme used everywhere else.
- Sector cards ([SectorEditor.tsx](src/app/builder/components/enhanced/tabs/sectors/SectorEditor.tsx)) use light `bg-blue-500/5` / `bg-{color}-100` styling rather than the emerald glass idiom.
- Tax UI shell ([TaxBuilder.tsx](src/components/tax-system/TaxBuilder.tsx)) has a light header + `bg-muted` tab nav + light modals; its actual content tabs ([SettingsTab.tsx](src/components/tax-system/tabs/SettingsTab.tsx), [PreviewTab.tsx](src/components/tax-system/tabs/PreviewTab.tsx)) are **already** emerald GlassCard — so reskin scope is small.

**UX**
- Economy "System Warnings" render via [ValidationToast.tsx](src/app/builder/components/enhanced/tabs/utils/ValidationToast.tsx) into a right-only `right-sidebar-portal` that exists *only* for economics — inconsistent with the government builder, which surfaces warnings inline.
- Sectors tab is a dense form; advanced fields gated behind a global `showAdvanced` + a per-card gear toggle; normalization is a manual button (`SectorMetrics`).
- Blank-form tabs lack empty states / guidance; the `EconomicArchetypeModal` presets are under-surfaced.

**Performance / dead code**
- [BuilderNotchBar.tsx](src/app/builder/components/BuilderNotchBar.tsx) runs a constant `setInterval(onScroll, 150)` the whole time the builder is open (L276) — wasteful; a scroll listener + post-render sync already exist.
- `BuilderIntegrationSidebar.tsx` / `EconomyBuilderSidebar.tsx` (vitality rings) are **dead** — defined/exported, never rendered.
- `validateEconomy` is computed in two places (EconomyBuilderPage + EconomySectorsTab).

## Confirmed architecture facts (ground truth)
- Live economics path is **[StepRenderer.tsx](src/app/builder/components/enhanced/sections/StepRenderer.tsx)** → renders `EconomyBuilderPage` directly (sources tax from **context**, not props). `EconomicsStep.tsx` is legacy — do not wire `taxSystemData` through it.
- Tax context wiring already exists: `useBuilderState` exposes `taxSystemData` + `updateTaxSystem`; `EconomyBuilderPage` reads/writes it (gated behind the flag); `BuilderPreviewStep` L124 already reads `builderState.taxSystemData`. So **the preview tax section auto-populates once tax is enabled** — no new wiring.
- `validateEconomy` ([validation.ts](src/app/builder/components/enhanced/tabs/utils/validation.ts)) already returns structured `{field, message, severity}` + `byTab` + a working `scrollToField` — the right substrate for the unified alert hook. `useBuilderValidation` returns only coarse `string[]` (no field anchors).
- `BuilderNotchBar` already calls `useBuilderContext()` (has full builder state) and already has an `AnimatePresence` subnav-row pattern to copy for an expandable panel.

## Implementation plan (phased, least-risk first)

### Phase 0 — Preview glass restyle (Decision D)
Pure visual, no logic. In [BuilderPreviewStep.tsx](src/app/builder/components/enhanced/sections/BuilderPreviewStep.tsx) swap each light `Card` for `GlassCard` with a matching `theme`: National Identity→`gold`, Core Indicators→`blue`, Government→`teal`, Economy→`emerald`, Tax→`red`, Summary→`neutral`. Convert inner `bg-white/50` blocks and the per-category `Card`s (L1101) to glass sub-panels; convert `CardHeader/CardTitle` to the `border-border/40 … bg-white/[0.02]` header pattern. **Preserve** all `Collapsible` structure, expand/collapse-all, and data bindings (incl. `taxSystemData` L124).

### Phase 1 — Tax enable + shell reskin (Decision B)
1. [constants.ts](src/app/builder/constants.ts): `TAX_SYSTEM_TEMP_DISABLED = false` (auto-un-disables the notch Tax subtab, which is bound to the flag at BuilderNotchBar L228).
2. [EconomyBuilderPage.tsx](src/app/builder/components/enhanced/EconomyBuilderPage.tsx): replace the placeholder "Temporarily Disabled" GlassCard (L1043–1075) with the real `<TaxTab/>` ([TaxTab.tsx](src/app/builder/components/enhanced/tabs/tax/TaxTab.tsx)), passing `economicInputs`, `economyBuilder`, `governmentBuilderData`, `selectedComponents`, `activeTaxBuilderState={taxSystemData ?? default}`, `onTaxStateChange={handleTaxStateChange}`, `countryId`. Remove the `TAX_SYSTEM_TEMP_DISABLED ? null :` ternary (L424) and the early-return no-op in `handleTaxStateChange` (L433).
3. [TaxBuilder.tsx](src/components/tax-system/TaxBuilder.tsx) shell only: convert the light header (L334–367) to an emerald GlassCard header (or drop it since the economy tab already has a "Tax System" header); restyle the `bg-muted` Settings/Preview pill toggle (also at [SettingsTab.tsx](src/components/tax-system/tabs/SettingsTab.tsx) L84) to the emerald pill style; restyle the calculator/templates modals (L449–594) to glass (lower priority — transient). Leave `useTaxBuilderState`, `tax-builder-validation.ts`, `tax-suggestions-engine.ts`, templates untouched.

Result: tax tab is live + on-theme; preview tax section populates for free.

### Phase 2 — Unified notch alert system (Decision A) — largest/riskiest
1. New types `src/app/builder/lib/builder-alerts.ts`:
   `BuilderAlert { severity: "error"|"warning"|"info"; message: string; section: BuilderSection; tab?: string; field?: string }`.
2. New hook **`src/app/builder/hooks/useBuilderAlerts.ts`** — a **pure derivation** (must NOT write back into context; EconomyBuilderPage has heavy sync effects that would loop). It composes:
   - Economics: `validateEconomy(economyBuilderState, selectedComponents)` → map `byTab` keys to `tab`, keep `field`.
   - Government: extract the three `useMemo` warnings from [GovernmentStep.tsx](src/app/builder/components/enhanced/steps/GovernmentStep.tsx) (`gdpCapWarning` L158, `deltaWarning` L132, `currencyChangeWarning` L142) into a pure helper `src/app/builder/components/enhanced/government-preview/governmentWarnings.ts`; GovernmentStep imports the same helper so its inline Verification Checkpoint stays in sync (single source). (delta/currency depend on mount-captured baseline refs — persist baseline budget/currency into builder state to surface in notch, else those two stay inline-only as an accepted fallback.)
   - Coarse foundation/identity/core via `useBuilderValidation().validateStep`.
   - Tax via `validateTaxBuilderState(taxSystemData)`.
   Returns `{ alerts, counts:{error,warning,info}, forSection(s) }`, memoized.
3. [BuilderNotchBar.tsx](src/app/builder/components/BuilderNotchBar.tsx): add a **status chip** (red/amber pill or emerald check) showing the active section's error/warning counts + an all-sections total; clicking toggles an **expandable panel** (copy the `AnimatePresence` subnav pattern L470–521) listing alerts grouped by severity. Reuse the severity color/icon mapping + grouped-list JSX from `ValidationToast.tsx` (L52–183) before deleting it. Panel row click: switch to `alert.section`/`tab`, then `requestAnimationFrame(() => scrollToField(alert.field))`. Also **remove the `setInterval` polling** (L276) here (replace with a `ResizeObserver` on `containerRef` if needed).
4. [BuilderSidebarLayout.tsx](src/app/builder/components/BuilderSidebarLayout.tsx): remove the `activeSection === "economics"` portal blocks (L150–152 mobile, L182–186 desktop). Main content is `flex-1` → reflows to full width.
5. [EconomyBuilderPage.tsx](src/app/builder/components/enhanced/EconomyBuilderPage.tsx): remove `<ValidationToast/>` (L1103) + now-unused `economyValidation` (L830) + import.
6. Delete dead files + barrel exports (`enhanced/index.ts`): `ValidationToast.tsx`, `BuilderIntegrationSidebar.tsx`, `EconomyBuilderSidebar.tsx` — **but first extract** `BuilderIntegrationSidebar`'s `econMetrics` math (L81–188) into `src/app/builder/components/enhanced/economy-builder/economyImpactMetrics.ts` for Phase 3.

### Phase 3 — Economy UX (Decision C)
1. **Simplify sectors** ([SectorEditor.tsx](src/app/builder/components/enhanced/tabs/sectors/SectorEditor.tsx), [EconomySectorsTab.tsx](src/app/builder/components/enhanced/tabs/EconomySectorsTab.tsx), `tabs/sectors/SectorMetrics.tsx`): per-card "Advanced" toggle (decouple from global `showAdvanced`); **auto-normalize on commit** (slider release / add / remove — NOT on every drag) and replace the manual Normalize button with a live "X% remaining" indicator; restyle the SectorEditor card to the emerald glass idiom; add a no-sectors empty state.
2. **Guided flow & presets**: surface `EconomicArchetypeModal` more prominently — empty-state CTAs in Components/Sectors tabs ("Apply an archetype" → `setIsPresetsOpen(true)`); per-tab guidance cards.
3. **Live impact feedback**: render a compact inline impact strip (top of Components/Sectors) using `computeEconomyImpact(...)` from the extracted `economyImpactMetrics.ts`, aggregating the existing `sectorImpacts` math; reuse `MetricsPanel` where it fits.
4. **Unify layout/headers** ([EconomyBuilderPage.tsx](src/app/builder/components/enhanced/EconomyBuilderPage.tsx)): extract a local `EconomyTabHeader` to dedupe the four tab headers; apply the government builder's two-column grid usage where economy tabs sprawl single-column.

## Critical files
- New: `src/app/builder/hooks/useBuilderAlerts.ts`, `src/app/builder/lib/builder-alerts.ts`, `src/app/builder/components/enhanced/government-preview/governmentWarnings.ts`, `src/app/builder/components/enhanced/economy-builder/economyImpactMetrics.ts`
- Edit: [BuilderNotchBar.tsx](src/app/builder/components/BuilderNotchBar.tsx), [BuilderSidebarLayout.tsx](src/app/builder/components/BuilderSidebarLayout.tsx), [EconomyBuilderPage.tsx](src/app/builder/components/enhanced/EconomyBuilderPage.tsx), [BuilderPreviewStep.tsx](src/app/builder/components/enhanced/sections/BuilderPreviewStep.tsx), [GovernmentStep.tsx](src/app/builder/components/enhanced/steps/GovernmentStep.tsx), [SectorEditor.tsx](src/app/builder/components/enhanced/tabs/sectors/SectorEditor.tsx), [EconomySectorsTab.tsx](src/app/builder/components/enhanced/tabs/EconomySectorsTab.tsx), [TaxBuilder.tsx](src/components/tax-system/TaxBuilder.tsx), [constants.ts](src/app/builder/constants.ts), `enhanced/index.ts`
- Delete (after extraction): `ValidationToast.tsx`, `BuilderIntegrationSidebar.tsx`, `EconomyBuilderSidebar.tsx`

## Reuse (don't reinvent)
`GlassCard` (`glass/GlassCard.tsx`, themes gold/blue/indigo/red/emerald/teal/neutral), `BuilderTabCard`, `MetricsPanel`, `EnhancedSlider`/`EnhancedNumberInput` (`primitives/enhanced/`), `validateEconomy` + `scrollToField`, `validateTaxBuilderState`, `useBuilderValidation`, `FieldIndicator` (emits `data-field` anchors), `EconomicArchetypeModal` + `data/archetypes/`.

## Risks / watch-outs
- Keep `useBuilderAlerts` a pure derivation — never write alerts into builder context (loop risk with existing sync effects).
- Auto-normalize on commit only (drag-normalize fights the user).
- Government baseline (delta/currency) warnings need baseline persisted to builder state to appear in the notch; otherwise inline-only fallback.
- Right-sidebar removal drops only the third flex child; verify no orphan `mt-4` wrapper on mobile.

## Verification
Run `bun run dev` and manually click through:
1. Preview renders all sections in glass; tax section populates after editing tax.
2. Tax tab loads the real builder on-theme; edits persist into preview; no console errors.
3. Notch chip shows correct per-section error/warning counts; panel click scrolls to field / deep-links the tab.
4. Sectors: per-card advanced toggle, auto-balance behavior, glass styling, empty state.
5. Economy right sidebar gone; layout full-width; no portal errors; notch no longer polls (no constant 150ms timer in profiler).

**Do NOT** run global `tsc`/`typecheck` (forbidden — crashes the server). Rely on dev-server per-file type errors + manual testing.
