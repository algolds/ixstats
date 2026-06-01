# Builder Overview

**Last updated:** May 2026

The builder (`/builder`) lets new nations configure identity, government, economics, demographics, and fiscal policy before entering the MyCountry command suite.

## Structure
| Path | Purpose |
| --- | --- |
| `page.tsx` | Entry point orchestrating steps and progress state |
| `components/` | UI sections for identity, economy, labor, government, demographics, policy review |
| `sections/` | Focused step implementations reused across builder and editor flows |
| `primitives/` | Glass-physics primitives (cards, headers, navigation) |
| `utils/` | Section configuration, validation, policy advisor helpers |
| `types/` | Shared TypeScript definitions |
| `editor/` | Post-creation editing experience (same data contracts) |

## Data & Services
- Builder mutations run through `api.countries.createCountry`, `api.mycountry.updateCountry`, and related routers
- Atomic component data sourced from `api.atomicGovernment.listComponents`, `api.atomicEconomic.listComponents`, `api.atomicTax.listComponents`
- Wiki importers and flag services are shared with the `/wiki` route (see `docs/systems/builder.md` for flow chart)

## UX Guidelines
- Maintain the step order: Identity → Government → Economy → Labor → Demographics → Fiscal → Review
- Use primitives in `primitives/` to keep layout consistent (glass depth, animations, navigation)
- Keep validation synchronous where possible; heavier calculations can call server helpers but must handle loading states gracefully

## May 2026 Optimizations
- **Template Contexts**: Configured step defaults using the template context state (`selectedTemplate`) during foundation and core step navigation.
- **Visual Improvements**: Added layout-animated search islands in heroes, color-coded complexity badges on archetypes, and dynamic layout padding.
- **Lag & Feedback Loops Prevention**: Replaced dependency checkers with Lodash `isEqual` in `useGovernmentSpending` to avoid redundant micro-stutters and wrapped `onChange` callbacks in React Refs.
- **Wiki Caching**: Leveraged `WikiCacheService` to cache wiki imports persistently for 24 hours.

## Maintenance Checklist
- Update `docs/systems/builder.md` and `/help/getting-started/*` after altering steps or data contracts
- Add regression tests for new validation or calculation logic
- Ensure new fields persist to Prisma models and appear in MyCountry immediately

