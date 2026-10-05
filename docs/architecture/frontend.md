# Frontend Architecture

**Framework**: Next.js 16.3.6 App Router · React 19.2.8 · Tailwind CSS 4.3.3 · TypeScript 7.0.2  
**Design System**: **Facet** (opaque cards, glass only for floating chrome)  
**Location**: `src/app/` (180+ page routes, 40+ API route handlers) · `src/components/` (900+ `.tsx` components) · `src/hooks/` (95 hook and helper modules)

---

## 1. App Router & Layout Architecture

The frontend is structured around Next.js App Router conventions with strong domain co-location:

```
src/
├── app/                              # Route tree & server layouts
│   ├── layout.tsx                    # Root HTML document, fonts, Clerk provider, global providers + <AppShell>
│   ├── page.tsx                      # Root route (splash vs signed-in command center)
│   ├── mycountry/                    # Single-page executive command suite (/mycountry/*)
│   ├── dashboard/                    # Signed-in executive overview & feed hub
│   ├── vault/                        # IxVault (cards, packs, marketplace, credits)
│   ├── thinkpages/                   # Social knowledge sharing & ThinkShare messaging
│   ├── maps/                         # Interactive IxWorld map viewer (also maps.ixwiki.com)
│   ├── countries/                    # Public Factbook country profiles (/countries/[slug])
│   ├── builder/                      # Nation creation & editing wizard
│   ├── labs/                         # Experimental suites (Onoma, Vexel, Map Pipeline)
│   └── admin/                        # 40+ admin CMS interfaces (RBAC guarded)
├── components/                       # Shared UI and domain presentation components
│   ├── ui/                           # Base design primitives (buttons, dialogs, badges)
│   │   └── facet/                    # Facet design system primitives (tabs, materials, swipeable rows)
│   ├── mycountry/                    # MyCountry single-page hub & domain tabs
│   ├── maps/                         # MapLibre GL core, editors, and vector overlays
│   └── halo/                         # Halo command palette, plugins, and tours
└── hooks/                            # Domain state, tRPC data queries, and sync engines
```

### Root Layout Providers (`src/app/layout.tsx`)
1. **`ClerkProvider`**: Authentication context. Required — the root layout throws at render if the Clerk keys are not configured.
2. **`TRPCReactProvider`**: Client-side query client and cache manager wrapping tRPC hooks (`src/trpc/react.tsx`).
3. **`ThemeProvider`** (`src/context/theme-context.tsx`): Theme and preference context (light / dark / system — default system; density, contrast, transparency, motion, text size), wrapped in a `MotionConfig reducedMotion="user"`. The same attributes are applied pre-paint by the inline script in the root layout (see [Tokens](#tokens)).
4. **`AbilityProvider` → `IxTimeProvider` → `ExecutiveNotificationProvider` → `WikiContextProvider` → `LazyGameProviders`**: Permissions, IxTime clock, executive notifications, wiki context, and lazily loaded gameplay providers.
5. **`CuelumeSoundProvider`**: Bootstraps the **Cuelume** audio-tactile engine, delegates declarative `data-cuelume-*` listeners globally to the `document`, and plays subtle route transition cues (`soundEffects.arrival()`).
6. **`<AppShell>`** (`src/components/shell/AppShell.tsx`): the page frame. It renders `FacetShell` (the `AppSidebar` source list from 1024px up, the `TabBar` below that, and the Halo island, `ShellHalo`) and `<main>`, and paints the canvas in the current app's tint (`data-app`). The navigation source is `src/lib/navigation/app-sections.ts`.

> See the **[Facet design system reference](../reference/facet-design-system.md)** for colour roles and app tints, text styles, radii, materials, z-index, motion, the primitives (Card, FacetList, controls, Sheet, dialogs), sound, appearance and accessibility preferences, and the guard tests.

---

## 2. The 4-Layer Modular Component Pattern

To enforce maintainability and performance across 900+ components, complex views (>500 lines) are decomposed into four strict layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                      │
│   Thin page/container wrapper (e.g. MyCountryRouter.tsx)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     PRESENTATION LAYER      │ │    STATE MANAGEMENT LAYER   │
│ Focused UI components       │ │ Custom domain React hooks   │
│ Optimized with React.memo   │ │ Encapsulates tRPC & caching │
│ (src/components/domain/*)   │ │ (src/hooks/use*Data.ts)     │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                     │
│ Pure TypeScript functions, math formulas, data transforms   │
│ Zero React dependencies, 100% testable (src/lib/*.ts)       │
└─────────────────────────────────────────────────────────────┘
```

### Layer Rules & Responsibilities:
1. **Business Logic Layer (`src/lib/<domain>/*.ts`)**: Pure functions (e.g. `government/synergy.ts`, `ixtime/core.ts`, `wiki-os/adapters/mediawiki/bridge/`). Never import React or UI elements.
2. **State Management Layer (`src/hooks/*.ts`, or co-located next to a feature)**: Custom hooks that query tRPC, manage optimistic updates, and wrap timers (e.g. `src/hooks/useUnifiedFlags.ts`, `src/app/builder/components/enhanced/national-identity/useNationalIdentityState.ts`).
3. **Presentation Layer (`src/components/domain/*`)**: Reusable UI components styled with Facet tokens. Memoized with `React.memo` to prevent unnecessary re-renders.
4. **Orchestration Layer (`src/app/**/page.tsx`)**: Composes hooks and UI components with minimal inline logic.

---

## 3. Single-Page Router Architecture

Major platform pillars use the **Single-Page Router Pattern** for instantaneous sub-navigation without Next.js route transition delays:

```tsx
// Pattern: Single-Page Hub Controller
export function MyCountryRouter() {
  const [activeSection, setActiveSection] = useState<MyCountrySection>("overview");

  // Sync with browser URL without full Next.js page unmount
  const navigateTo = useCallback((section: MyCountrySection) => {
    setActiveSection(section);
    window.history.pushState(null, "", `/mycountry/${section}`);
  }, []);

  return (
    <MyCountrySidebarLayout activeSection={activeSection} onNavigate={navigateTo}>
      {activeSection === "overview" && <OverviewSection />}
      {activeSection === "executive" && <ExecutiveSection />}
      {activeSection === "diplomacy" && <DiplomacySection />}
      {activeSection === "defense" && <DefenseSection />}
      {activeSection === "politics" && <PoliticsSection />}
    </MyCountrySidebarLayout>
  );
}
```

### Active Hub Routers & Shells:
| Hub | Location | Sub-Sections |
| :--- | :--- | :--- |
| **`MyCountryRouter`** | [`src/components/mycountry/shell/MyCountryRouter.tsx`](../../src/components/mycountry/shell/MyCountryRouter.tsx) | Overview, Executive, Economy, Diplomacy, Intelligence, Defense, Politics, Map Editor |
| **Vault routes** | [`src/app/vault/layout.tsx`](../../src/app/vault/layout.tsx) (guard + page container; navigation is the sidebar's source list) | Dashboard, Cards, Marketplace, Import, Achievements, Leaderboards |
| **`ThinktankWorkspace`** | [`src/components/thinktanks/ThinktankWorkspace.tsx`](../../src/components/thinktanks/ThinktankWorkspace.tsx) | Feed, Roster |
| **`MessagesRouter`** | [`src/components/messages/MessagesRouter.tsx`](../../src/components/messages/MessagesRouter.tsx) | Conversations (single folder, conversation list + thread view) |
| **`ThinkPagesAccountHub`**| [`src/components/thinkpages/ThinkPagesAccountHub.tsx`](../../src/components/thinkpages/ThinkPagesAccountHub.tsx) | Feed, composer (`UnifiedComposerContainer`), accounts |
| **`DashboardRouter`** | [`src/components/dashboard/DashboardRouter.tsx`](../../src/components/dashboard/DashboardRouter.tsx) (mounted by `src/app/dashboard/DashboardPageClient.tsx`) | Hero + single `UnifiedDashboardSection` in a sidebar layout |

---

## 4. Facet Design System & Styling Rules

The platform UI is built on **Facet**. Plain opaque cards are the default; glass is for floating chrome only (sidebar, tab bar, sheets, map overlays). Read [facet-design-system.md](../reference/facet-design-system.md) before changing UI.

### Key UI Primitives:
- **`Card`** (`src/components/ui/card.tsx`): `variant` `default | inset | hero`, `interactive`, `padding`. The hero variant is glass and is limited to the dashboard and MyCountry heroes.
- **`SegmentedControl`, `Tabs`, `ToggleGroup`, `RadioCard`** (`src/components/ui/`): Radix-based choice controls.
- **`BaseMetricDetailsModal`** (`src/components/mycountry/shared/modals/metric-details/BaseMetricDetailsModal.tsx`): Universal 4-tab drilldown modal (Overview, Trends, Comparison, Details).

### Tokens

All design tokens live in one file, **`src/styles/facet/tokens.css`** (imported first by `globals.css`), mirrored in
TypeScript by `src/lib/design/tokens.ts` (values) and `src/lib/design/motion.ts` (springs). Every token is a CSS
variable and a Tailwind utility — see the [Facet design system reference](../reference/facet-design-system.md):

- **Colour roles** — `text-label`, `text-label-secondary|tertiary|quaternary`, `bg-background`, `bg-grouped`,
  `bg-surface`, `bg-surface-secondary|elevated`, `bg-fill` … `bg-fill-4`, `border-separator(-opaque)`; system colours
  `red`…`pink` with `on-*` pairs; status aliases `destructive|warning|caution|success|info`; `chart-1…8`. The shadcn
  names (`foreground`, `muted-foreground`, `card`, `border`, `primary`…) are aliases of these roles.
- **App tint** — `bg-tint`, `text-tint`, `text-on-tint`, `bg-tint-fill`, `bg-tint-hover`; `primary` and `ring` alias
  the tint. Each app root sets `data-app="mycountry|maps|thinkpages|vault|forum|wiki|intel|sports|admin"`.
- **Type** — `text-display`, `text-large-title`, `text-title-1|2|3`, `text-headline`, `text-body`, `text-callout`,
  `text-subhead`, `text-footnote`, `text-caption` (rem × `--text-scale`).
- **Shape, depth, motion** — `rounded-sheet|card|row|control-lg|control|control-sm`; `material-thin|regular|thick`
  (floating chrome only); `shadow-card|floating|sheet`; `z-base` … `z-command`; `duration-fast`, `duration-exit`,
  `ease-out-facet`.
- **Appearance & accessibility** — one selector, `html[data-theme="light"|"dark"]`, plus `data-density`,
  `data-contrast="more"`, `data-transparency="reduced"`, `data-motion="reduced"`, `data-sound="off"` and
  `--text-scale` on `<html>`. A blocking, nonce-carrying inline script in `src/app/layout.tsx` writes them before
  first paint (`src/lib/design/appearance.ts`, shared with `ThemeProvider`). The `motion-reduce:`, `contrast-more:`,
  `transparency-reduced:` and `compact:` variants honour both the media query and the attribute.
- **Guard** — `src/tests/architecture/token-contrast.test.ts` checks the CSS against the TS values and computes WCAG
  contrast for every required pair.

### Styling Best Practices:
1. **Tailwind CSS v4**: Configured via CSS `@theme` tokens. Avoid legacy Tailwind v3 JavaScript configs.
2. **GPU Promotion**: Use `.force-gpu` (`transform: translate3d(0,0,0); backface-visibility: hidden;`) on heavy animated glows and map overlays to offload composition to the GPU.
3. **No Unicoded Regex Stripping**: Always use the `/u` flag in regex expressions to avoid stripping Latin ASCII characters when parsing emojis.

---

## 5. Universal State & Sync Hooks

Form builders and country editors use the canonical auto-sync engine:

```tsx
import { useGenericAutoSync } from "~/hooks/useGenericAutoSync";

export function useMyBuilderAutoSync(countryId: string, initialData: FormData) {
  const updateMutation = api.myDomain.update.useMutation();

  return useGenericAutoSync(initialData, {
    enabled: !!countryId,
    debounceMs: 2000,
    syncFn: async (dataToSync) => {
      return await updateMutation.mutateAsync({ countryId, data: dataToSync });
    },
  });
}
```

### Canonical Hook Directory:
- **Flags**: `useFlag`, `useBulkFlags`, `useFlagPreloader` (`src/hooks/useUnifiedFlags.ts`) — single source of truth for country flag URLs and SVG badge rendering.
- **Auto-Sync**: `useGenericAutoSync` (`src/hooks/useGenericAutoSync.ts`) — universal debounced autosave engine.
- **Notifications**: `useNotify` (`src/hooks/useNotify.ts`) — standardized toast and status messages.
- **Media / Wiki**: `useWikiScanner` (`src/hooks/useWikiScanner.ts`) — batched IxWiki lookups that flag unlinked pages and map/infobox data conflicts.

---

## 6. Server Components (RSC) & Dynamic Bundle Splitting

To ensure optimal initial load times and eliminate client-side waterfalls, routes follow strict RSC boundaries:

1. **Root Route Shells as React Server Components**: Static documentation, hub pages, and settings shells (`src/app/changelog/page.tsx`, `src/app/help/page.tsx`, `src/app/help/**/page.tsx`, `src/app/settings/page.tsx`) render on the server without top-level `"use client"`.
2. **Targeted `<Suspense>` Streaming**: Interactive data feeds and heavy client trees are wrapped in `<Suspense fallback={<Skeleton />}>`, streaming instant server HTML and hydrating asynchronously.
3. **Dynamic Library Code-Splitting**: Heavy client rendering engines (`maplibre-gl`, `recharts`, `@xyflow/react`) are dynamically imported via `next/dynamic` with SSR disabled (`{ ssr: false }`) and lightweight placeholder skeletons, preventing heavy canvas/chart code from bloating static entrypoints.

---

## 7. Navigation shell

There is one navigation: the app sidebar, a source list built from `src/lib/navigation/app-sections.ts`
(`AppSidebar` / `SourceList` from 1024px up; the `TabBar` and its More sheet below that). Every app is a top-level
row and the current app discloses its sections; Admin and Settings use area mode. There are no per-app sidebars,
rails or hidden sub-navigation.

- **Chromeless routes:** `/maps`, `/mycountry/map-editor`, `/admin/maps/editor` and `/admin/maps/style-editor`
  (`isChromelessPath`) get no canvas wash; Halo hides on `/maps`, where `MapDynamicIsland` takes over.
- **Page titles:** `PageHeader` (`~/components/shell`) renders the one `<h1>`, a back button and trailing actions in
  a sticky toolbar that collapses to a compact title on scroll.
- **Sticky rails** use `top-(--shell-top-offset)`; read the shell layout variables (`--shell-sidebar-width`,
  `--shell-tabbar-height`, `--shell-top-offset`, …) from `src/styles/facet/shell.css`, never redefine them.
- **Colour:** semantic tokens only; no arbitrary `[#...]` classes or inline hex colours.

The [Facet design system reference](../reference/facet-design-system.md) has the full rules.
