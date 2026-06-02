# Tax System Refactor Plan — Builder UI/UX

## Phase 6.1 — Simplify Tax State Flow

Remove the `onPersistTaxSystem` prop chain. Tax data reads/writes `builderState.taxSystemData` directly from `BuilderStateContext`.

### Changes
- `EconomyBuilderPage.tsx`: Remove `taxSystemData`/`onPersistTaxSystem` from props. Read/write via `builderContext.updateTaxSystem`.
- `StepRenderer.tsx`: Remove `handlePersistTaxSystem` callback. Remove `taxSystemData`/`onPersistTaxSystem` props.

## Phase 1.1 — Extract `FiscalTab.tsx`

New file at `tabs/fiscal/FiscalTab.tsx`. Extracts inline fiscal tab JSX (lines 1186-1475 of EconomyBuilderPage.tsx) into a proper component. 3 GlassCards: Fiscal Policy Configuration, Government Revenue Integration, Fiscal Verification Checkpoint.

## Phase 1.2 — Extract `TaxTab.tsx` + Embed TaxBuilder

New file at `tabs/tax/TaxTab.tsx`. Replaces 4 separate inline cards with embedded `<TaxBuilder>`. Keeps the Component Tax Optimization card (derived from selectedComponents). Passes all data through: economicInputs, economyBuilder, governmentBuilderData, governmentComponents, selectedComponents.

## Phase 1.3 — Update `EconomyBuilderPage.tsx`

Replace inline fiscal/tax JSX with `<FiscalTab>`/`<TaxTab>` imports. Remove unused imports. Add lazy exports to `tabs/index.ts`.

## Phase 3 — FiscalSystemSection Placeholder Fix (follow-up)

Replace "Coming Soon" card with `<TaxBuilder>` in FiscalSystemSection.tsx.
