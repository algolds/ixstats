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



-----
The user wants me to use subagents. This implementation decomposes cleanly into disjoint file sets that can run in parallel, while I (orchestrator) own the shared hot files (EconomyBuilderPage.tsx, BuilderNotchBar.tsx, BuilderSidebarLayout.tsx, enhanced/index.ts, constants.ts) for the integration pass afterward.

Update Todos

Phase 0: Restyle BuilderPreviewStep to glass theme (subagent A)

Phase 1a: Reskin TaxBuilder shell + toggle + modals to emerald glass (subagent B)

Phase 2a: builder-alerts types + useBuilderAlerts hook + governmentWarnings helper + GovernmentStep refactor (subagent C)

Phase 3a: Extract economyImpactMetrics + simplify/restyle sectors (subagent D)

Integration: wire shared hot files (EconomyBuilderPage tax tab + remove ValidationToast + impact strip/header; constants flag; NotchBar chip+panel+remove polling; SidebarLayout remove portals; delete dead files)

Verify via dev server (manual click-through)
Now I'll launch the four subagents in parallel, each with a disjoint set of files so they can't conflict.

Agent:Restyle Preview step to glass
IN
You are editing ONE file in the IxStats Next.js app at /ixwiki/public/projects/ixstats. Make ONLY visual styling changes — no logic, no data-binding changes, no behavior changes.

FILE (edit only this): `src/app/builder/components/enhanced/sections/BuilderPreviewStep.tsx`

GOAL: This file currently uses light pastel shadcn `Card` components (e.g. `border-amber-200/50 bg-amber-50/30 backdrop-blur-sm`) which clash with the dark glass-physics theme used everywhere else in the builder. Convert each top-level section `Card` to the project's `GlassCard` with the appropriate theme, and convert inner light blocks to glass sub-panels — while preserving ALL existing structure, Collapsible behavior, expand/collapse-all logic, data bindings, and props.

THE GLASS COMPONENT TO USE:
Import: `import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";`
First read `src/app/builder/components/glass/GlassCard.tsx` to learn its exact props. It supports props like `depth` (e.g. "base"), `theme` (one of: gold, blue, indigo, red, emerald, teal, neutral — verify the exact union in the file), `texture` (e.g. "chevron"), `textureOpacity` (e.g. 0.04). Look at how it's used in a reference file for the exact idiom: `src/app/builder/components/enhanced/steps/GovernmentStep.tsx` (e.g. `<GlassCard depth="base" theme="teal" className="border-cyan-500/20" texture="chevron" textureOpacity={0.04}>` with an inner header `<div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]"><h3 className="text-foreground flex items-center gap-2 text-base font-bold">...</h3></div>` then `<GlassCardContent className="p-6">`).

MAPPING (apply theme per section; the file has 5 collapsible sections + a summary card):
- National Identity section (currently `border-amber-200/50 bg-amber-50/30`) → GlassCard theme="gold"
- Core Economic Indicators (currently `border-blue-200/50 bg-blue-50/30`) → theme="blue"
- Government Configuration (currently `border-indigo-200/50 bg-indigo-50/30`) → theme="teal" (to match the government section's cyan/teal identity)
- Economy Configuration (currently `border-green-200/50 bg-green-50/30`) → theme="emerald"
- Tax System (currently `border-red-200/50 bg-red-50/30`) → theme="red"
- Configuration Summary (currently `border-gray-200/50 bg-gray-50/30`) → theme="neutral"

IMPORTANT CONSTRAINTS:
1. The sections use `<Collapsible>` + `<CollapsibleTrigger asChild><CardHeader ...>` + `<CollapsibleContent><CardContent>`. GlassCard does NOT have CardHeader/CardContent sub-parts the same way. Keep the `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` wrappers intact. Replace the `<Card>` with `<GlassCard ...>`. Replace `<CardHeader>` (the clickable trigger header) with a styled `<div>` that keeps the same click affordance/hover and chevron — use a header div like `className="cursor-pointer border-b border-border/40 bg-white/[0.02] px-6 py-4 transition-colors hover:bg-white/[0.04]"`. Replace `<CardContent>` with `<GlassCardContent className="p-6">` (or `<div className="p-6">` if GlassCardContent causes nesting issues). Keep `CardTitle` text but you can render it as an `<h3>`/`<div>` with `text-foreground ... font-bold`.
2. Convert the many inner light blocks `rounded-lg border bg-white/50 p-3|p-4` (metric cells) to glass sub-panels: `rounded-lg border border-white/10 bg-white/[0.03] p-3` (keep dark-mode friendly). Convert inner `<Card className="border">` (the per-tax-category cards around line 1101) similarly to `rounded-lg border border-white/10 bg-white/[0.03]`.
3. Keep the colored value text (text-blue-600, text-green-600, etc.) — those are fine accents. But ensure they read on dark glass; where a value uses only a light-mode color (e.g. `text-amber-700`) add a dark variant if missing (e.g. `dark:text-amber-300`). Don't over-engineer; match the existing dark-friendly patterns in GovernmentStep.
4. DO NOT change any of: `useBuilderContext()` usage, the `sectionStates`/`toggleSection`/`expandAll`/`collapseAll` logic, `normalizedGovernmentStructure`/`economicHealthMetrics`/`revenueIntegration` useMemos, the government-preview sub-component usage (StructureOverview, ComponentsList, etc.), the `EconomyPreviewTab`/`FiscalTab` usage, or `taxSystemData` binding (line ~124). Visual only.
5. Keep the `Dialog` flag/coat-of-arms zoom behavior.
6. Remove the now-unused `Card`/`CardHeader`/`CardContent`/`CardTitle` imports IF you replace all usages; if some inner usages remain, keep the import. Verify by searching the file after edits.

Do NOT run typecheck or tsc (forbidden in this repo — crashes the server). You may read other files for reference. When done, report exactly which sections you converted and confirm no logic changed.
Read GlassCard.tsx
Read BuilderPreviewStep.tsx
Bash Find GlassCard usage idioms in GovernmentStep
IN
grep -n "GlassCard\|border-b\|text-foreground\|border-border" /ixwiki/public/projects/ixstats/src/app/builder/components/enhanced/steps/GovernmentStep.tsx | head -40

OUT
31:import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
188:            <GlassCard
195:              <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
196:                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
209:              <GlassCardContent className="p-6">
219:              </GlassCardContent>
220:            </GlassCard>
227:            <GlassCard
234:              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
235:                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
240:              <GlassCardContent className="p-6">
288:              </GlassCardContent>
289:            </GlassCard>
292:            <GlassCard
299:              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
300:                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
305:              <GlassCardContent className="p-6">
393:              </GlassCardContent>
394:            </GlassCard>
455:              <GlassCard
462:                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
463:                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
468:                <GlassCardContent className="p-6">
476:                </GlassCardContent>
477:              </GlassCard>
482:              <GlassCard
489:                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
490:                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
495:                <GlassCardContent className="space-y-4 p-6">
554:                </GlassCardContent>
555:              </GlassCard>
Agent:Reskin TaxBuilder shell to glass
IN
You are editing the tax-system UI shell in the IxStats Next.js app at /ixwiki/public/projects/ixstats to match the builder's emerald glass-physics theme. Make styling changes only — preserve all logic, state, calculations, props, and data flow.

FILES YOU MAY EDIT (only these two):
- `src/components/tax-system/TaxBuilder.tsx`
- `src/components/tax-system/tabs/SettingsTab.tsx`

DO NOT touch: EconomyBuilderPage.tsx, constants.ts, PreviewTab.tsx, useTaxBuilderState, tax-builder-validation.ts, tax-suggestions-engine.ts, TaxSystemTemplates, or any atoms. Those are owned elsewhere.

CONTEXT: The tax builder is being re-enabled and rendered as the "Tax System" tab inside the economy builder, which already wraps it in an emerald `GlassCard` with a header. The tab CONTENT (`SettingsTab.tsx`, `PreviewTab.tsx`) already uses `GlassCard` emerald theme — good. The problem is the `TaxBuilder.tsx` SHELL: it has a light header block and a `bg-muted` Settings/Preview pill toggle, plus light modals (calculator/templates/template-confirm). These need to match the emerald glass idiom.

STEPS:
1. First READ both files fully. Also read `src/app/builder/components/glass/GlassCard.tsx` for props and `src/app/builder/components/enhanced/steps/GovernmentStep.tsx` for the canonical header idiom (`border-border/40 border-b bg-white/[0.02] px-6 py-4` + `text-foreground ... font-bold` h3, emerald icon).

2. In `TaxBuilder.tsx` (around lines 332-400):
   - The light top header (`<h1>`-style block, roughly L334-367): Since the economy tab ALREADY renders a "Tax System" GlassCard header around this component, simplify/remove the redundant big light header. Keep the "Tax Calculator" action button but restyle it to a subtle ghost/emerald button consistent with the rest (look at how buttons are styled in GovernmentStep / SettingsTab). If you keep any header text, use the dark `text-foreground` style, not light.
   - The Settings/Preview pill toggle nav (roughly L369-392, uses `bg-muted/...` and light active states): restyle to the emerald pill pattern. Reference the toggle in `SettingsTab.tsx` line ~84 (`bg-muted/30 border-border inline-flex rounded-lg border p-0.5`) — make the active pill emerald (e.g. active: `bg-emerald-500/15 text-emerald-400 font-semibold`, inactive: `text-foreground/50 hover:text-foreground/80 hover:bg-white/5`). Keep the `activeTab` state and its switching logic exactly as-is.

3. In `SettingsTab.tsx`: the toggle at L84 (`bg-muted/30 border-border ...`) — if it controls something (read it), restyle its active/inactive states to the same emerald pill style for consistency. Do not change its behavior.

4. Modals in `TaxBuilder.tsx` (calculator/templates/template-confirm, roughly L449-594): convert their light containers (`bg-background`, shadcn `Card`/`CardHeader`/`CardContent`, light borders) to the glass idiom — `GlassCard` with theme="emerald" or dark panels `border border-white/10 bg-zinc-900/90 backdrop-blur-xl`. Keep all modal logic, buttons, and the template list rendering intact. This is lower priority than 2/3 but do it.

CONSTRAINTS:
- Do NOT change `useState`/`useCallback` logic, the `useTaxBuilderState`/`useTaxBuilderAutoSync` hooks, `computeTaxSuggestions`, conflict dialog wiring, props, or the `onChange`/`onSave` flow.
- Keep accessibility (button roles, labels).
- Do NOT run typecheck/tsc (forbidden — crashes server).
- After editing, search both files to confirm no leftover light `bg-muted`/`bg-background`/pastel header classes remain in the shell/toggle/modals.

Report what you changed in each file.
Read GovernmentStep.tsx (lines 187-226)
Read TaxBuilder.tsx
Read SettingsTab.tsx
Read GlassCard.tsx
Read GovernmentStep.tsx
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Added 6 lines
Edit TaxBuilder.tsx
Removed 7 lines
Edit BuilderPreviewStep.tsx
Modified
Edit TaxBuilder.tsx
Added 8 lines
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit TaxBuilder.tsx
Added 7 lines
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit TaxBuilder.tsx
Added 5 lines
Bash Check remaining usages of Card components in TaxBuilder
IN
grep -nE '\b(Card|CardContent|CardHeader|CardTitle)\b' src/components/tax-system/TaxBuilder.tsx

OUT
4:import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
Edit BuilderPreviewStep.tsx
Added 6 lines
Edit TaxBuilder.tsx
Removed 1 line
Edit BuilderPreviewStep.tsx
Modified
Bash Check remaining Button usages in TaxBuilder
IN
grep -nE '<Button\b|\bButton\b' src/components/tax-system/TaxBuilder.tsx

OUT
4:import { Button } from "~/components/ui/button";
Edit BuilderPreviewStep.tsx
Modified
Edit TaxBuilder.tsx
Removed 1 line
Edit SettingsTab.tsx
Modified
Edit BuilderPreviewStep.tsx
Added 6 lines
Bash Check for leftover light classes in shell, toggle, and modals
IN
echo "=== TaxBuilder.tsx ==="; grep -nE 'bg-background|bg-muted|<Card|CardHeader|CardContent|CardTitle|bg-amber-100|text-amber-600|shadow-lg|shadow-xl|hover:shadow' src/components/tax-system/TaxBuilder.tsx; echo "(exit $?)"; echo "=== SettingsTab.tsx ==="; grep -nE 'bg-background|bg-muted/30 border-border inline-flex|text-muted-foreground hover:text-foreground"' src/components/tax-system/tabs/SettingsTab.tsx; echo "(exit $?)"

OUT
=== TaxBuilder.tsx ===
335:        <div className="bg-muted/30 border-border inline-flex rounded-lg border p-0.5">
(exit 0)
=== SettingsTab.tsx ===
84:      <div className="bg-muted/30 border-border inline-flex rounded-lg border p-0.5">
(exit 0)
Edit BuilderPreviewStep.tsx
Modified
Bash Final scan for residual light idioms and unused imports
IN
echo "=== TaxBuilder.tsx residual light idioms ==="; grep -nE 'text-2xl font-semibold|text-3xl|variant="outline"|variant="ghost"|variant="default"|bg-amber-9|dark:bg-amber' src/components/tax-system/TaxBuilder.tsx; echo "(none if empty)"; echo "=== confirm Button import gone, UIBadge still used ==="; grep -nE "from \"~/components/ui/button\"|UIBadge" src/components/tax-system/TaxBuilder.tsx

OUT
=== TaxBuilder.tsx residual light idioms ===
514:                    <UIBadge variant="outline" className="ml-2">
(none if empty)
=== confirm Button import gone, UIBadge still used ===
4:import { Badge as UIBadge } from "~/components/ui/badge";
369:            <UIBadge variant="secondary" className="text-xs">
371:            </UIBadge>
511:                    <UIBadge variant="secondary">
513:                    </UIBadge>
514:                    <UIBadge variant="outline" className="ml-2">
516:                    </UIBadge>
Edit BuilderPreviewStep.tsx
Added 6 lines
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Bash Find remaining light-mode backgrounds
IN
grep -n "bg-white/50\|bg-gray-50\|bg-gray-100\|hover:bg-muted\|bg-muted" /ixwiki/public/projects/ixstats/src/app/builder/components/enhanced/sections/BuilderPreviewStep.tsx

OUT
1087:                  <div className="grid grid-cols-1 gap-4 rounded-lg border bg-white/50 p-4 md:grid-cols-3">
1127:                                  <div className="hover:bg-muted/30 flex cursor-pointer items-center justify-between p-3 transition-colors">
1156:                                  <div className="bg-muted/20 border-t p-3">
1174:                                                  className="rounded border bg-white/50 p-2 text-xs"
1207:                                <div key={index} className="rounded border bg-white/50 p-2 text-xs">
1238:                                      className="rounded border bg-white/50 p-2 text-xs"
1269:      <Card className="border-gray-200/50 bg-gray-50/30 backdrop-blur-sm">
Read BuilderPreviewStep.tsx (lines 983-994)
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Added 6 lines
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
Edit BuilderPreviewStep.tsx
Modified
