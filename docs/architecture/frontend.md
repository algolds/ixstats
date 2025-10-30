# Frontend Architecture

**Last updated:** October 2025

The frontend is built entirely on the Next.js 15 App Router. Client and server components coexist, with domain-specific modules co-located under `src/app` and shared component libraries under `src/components`.

## Layout Composition
- **App Router** – Each route folder contains `page.tsx`, optional `layout.tsx`, and feature-specific components. The root layout lives at `src/app/layout.tsx`.
- **Authentication-aware routing** – `src/app/page.tsx` switches between the splash page (`IxStatsSplashPage.tsx`) and the signed-in command center (`EnhancedCommandCenter.tsx`) using the Clerk-backed `useUser` hook.
- **Dynamic segments** – Features such as countries, profiles, and wiki content use nested routes in `src/app/countries`, `src/app/profile`, and `src/app/wiki`.

## Component Layers
- **Design System (`src/components/ui`)** – Buttons, cards, dialogs, badges, and Apple-style carousel components that power the "glass physics" theme.
- **Domain Widgets (`src/components/*`)** – Intelligence dashboards, diplomatic feeds, economic charts, and compliance modals. Components are grouped by domain to encourage reuse.
- **Feature Shells (`src/app/**/components`)** – Lightweight wrappers that stitch together UI primitives and data hooks for specific pages.

## Modular Component Architecture

The codebase follows a strict modular architecture pattern for complex components, separating concerns into distinct layers:

### Layer Separation
1. **Business Logic Layer** (`src/lib/*.ts`)
   - Pure functions for calculations, transformations, validations
   - No React dependencies
   - Fully testable in isolation
   - Examples: `synergy-calculator.ts`, `wiki-markup-parser.ts`, `tax-builder-validation.ts`

2. **State Management Layer** (`src/hooks/*.ts`)
   - Custom React hooks for data fetching and state management
   - Encapsulate tRPC queries and mutations
   - Use React.useMemo for expensive computations
   - Examples: `useEmbassyNetworkData.ts`, `useIntelligenceMetrics.ts`, `useTaxBuilderState.ts`

3. **Presentation Layer** (`src/components/**/component-name/*.tsx`)
   - Focused UI components with single responsibilities
   - Optimized with React.memo to prevent unnecessary re-renders
   - Barrel exports via `index.ts` for clean imports
   - Examples: `embassy-network/`, `intelligence-briefing/`, `tax-builder/`

4. **Orchestration Layer** (main component)
   - Thin wrapper that composes hooks and UI components
   - Minimal logic, primarily composition
   - Clear, readable component structure
   - Examples: `EnhancedEmbassyNetwork.tsx`, `EnhancedIntelligenceBriefing.tsx`

### Refactoring Pattern
Large monolithic components (>1000 lines) are refactored into modular architectures:
- Extract business logic to `src/lib/` utilities
- Create custom hooks in `src/hooks/` for state management
- Split UI into focused components under `src/components/domain/feature/`
- Optimize all components with React.memo
- Add comprehensive JSDoc documentation

This pattern has been successfully applied to:
- `EnhancedIntelligenceBriefing` (2,724 → 445 lines, 83.7% reduction)
- `TaxBuilder` (1,851 → 567 lines, 69.4% reduction)
- `EnhancedEmbassyNetwork` (402 → 103 lines, 74.4% reduction)

### Benefits
- **Maintainability**: Clear separation of concerns, single responsibility principle
- **Reusability**: Hooks and utilities can be shared across features
- **Testability**: Each layer can be tested independently
- **Performance**: React.memo prevents unnecessary re-renders
- **Readability**: Main components are simple orchestrators
- **Type Safety**: TypeScript interfaces distributed across modules

## Styling & Theming
- Tailwind CSS 4 with `prettier-plugin-tailwindcss` ensures consistent class ordering.
- Dark/light mode friendly gradients, blur, and depth levels implemented via utility classes and helper components (`src/components/magicui`).
- Iconography uses `lucide-react`, with icons imported per use to minimise bundle size.

## State & Data Fetching
- **tRPC React Query** – The `api` client from `src/trpc/react.tsx` wraps hooks like `api.countries.getByIdWithEconomicData.useQuery()`.
- **Custom hooks** – Domain hooks (e.g., `useMyCountryCompliance.ts`, `useUnifiedFlags.ts`) encapsulate derived state, timers, and formatting logic.
- **Server Components** – Data-heavy sections such as leaderboards and dashboard cards leverage server components for hydration efficiency when feasible.

## Performance Considerations
- Turbopack dev server (`npm run dev`) for quick reloads.
- Lazy loading via dynamic imports for large visualisations and modals.
- Shared chart utilities (`src/lib/chart-utils.ts`) to standardise formatting and avoid duplicate logic.

## Testing & Storytelling
- Jest tests cover critical components and routers; add component-level tests under `tests/` when expanding UI.
- Use the in-app help articles as living UX documentation; each major UI module should link to its help article for product alignment.

Keep this guide aligned with structural changes (e.g., new design primitives, layout conventions, or state management patterns).
