# Nation Builder System

**Last updated:** October 2025

The builder lets new nations establish identity, government, economics, demographics, and fiscal posture. It pulls from wiki sources and atomic component libraries to accelerate onboarding.

## Routes & Components
- `src/app/builder` – Primary builder wizard
- `src/app/builder/README.md` – Feature-level notes (kept in sync with this document)
- `src/components/builders` – Step components for identity, government, economy, demographics, fiscal policy
- `src/components/atomic` – Atomic component selectors (`UnifiedAtomicComponentSelector`, atomic themes)

## Data Sources & Routers
- `atomicGovernment.ts`, `atomicEconomic.ts`, `atomicTax.ts` – Component catalogs, synergies, conflicts
- `wikiImporter.ts`, `wikiCache.ts` – Wiki ingestion, caching, image retrieval
- `countries.ts` – Persists builder selections; `mycountry.ts` ensures MyCountry surfaces pick up results

## Workflow Summary
1. **Identity & Media** – Users configure coats of arms, flags (flag service + wiki fetch via `useUnifiedFlags`)
2. **Government** – Select atomic components and traditional structures
3. **Economy & Demographics** – Set baseline GDP, population, sector distributions
4. **Fiscal & Policy** – Configure revenue sources, spending, tax systems
5. **Review & Commit** – Persist via builder mutations; synced instantly with MyCountry analytics

## Utilities & Scripts
- `scripts/migrations/create-national-identity-records.ts` – Migration helper for identity data
- Builders rely on validation utilities under `src/app/mycountry/utils` and `src/lib`

## Help & Documentation
- `/help/getting-started/*` guides new users through the builder
- Update this document and help content when adding steps or fields

Keep builder data models backward compatible; migrations should include seed/backfill logic when adding required fields.
