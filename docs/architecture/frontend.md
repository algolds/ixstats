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
