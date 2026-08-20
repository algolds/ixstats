# Frontend Architecture

**Framework**: Next.js 16.3.0 App Router · React 19.2.8 · Tailwind CSS 4.3.3 · TypeScript 7.0.0  
**Design System**: **Facet** (Refraction, Depth Hierarchy, Tactile Feedback)  
**Location**: `src/app/` (210+ routes) · `src/components/` (750+ UI components) · `src/hooks/` (90+ custom hooks)

---

## 1. App Router & Layout Architecture

The frontend is structured around Next.js App Router conventions with strong domain co-location:

```
src/
├── app/                              # Route tree & server layouts
│   ├── layout.tsx                    # Root HTML document, fonts, Clerk provider, Halo wayfinding
│   ├── page.tsx                      # Root route (splash vs signed-in command center)
│   ├── mycountry/                    # Single-page executive command suite (/mycountry/*)
│   ├── dashboard/                    # Signed-in executive overview & feed hub
│   ├── vault/                        # IxVault (cards, packs, marketplace, credits)
│   ├── thinkpages/                   # Social knowledge sharing & ThinkShare messaging
│   ├── maps/                         # Interactive IxWorld map viewer (also maps.ixwiki.com)
│   ├── countries/                    # Public Factbook country profiles (/countries/[slug])
│   ├── builder/                      # Nation creation & editing wizard
│   ├── labs/                         # Experimental suites (Onoma, Vexel)
│   └── admin/                        # 50+ admin CMS interfaces (RBAC guarded)
├── components/                       # Shared UI and domain presentation components
│   ├── ui/                           # Base design primitives (buttons, dialogs, badges)
│   ├── facet-ui/                     # Facet design system primitives (cards, tabs, containers)
│   ├── mycountry/                    # MyCountry single-page hub & domain tabs
│   ├── maps/                         # MapLibre GL core, editors, and vector overlays
│   └── modals/                       # Standardized drill-down modals (BaseMetricDetailsModal)
└── hooks/                            # Domain state, tRPC data queries, and sync engines
```

### Root Layout Providers (`src/app/layout.tsx`)
1. **`ClerkProvider`**: Multi-tenant authentication context (optional in development demo mode).
2. **`TRPCReactProvider`**: Client-side query client and cache manager wrapping tRPC hooks (`src/trpc/react.tsx`).
3. **`FacetThemeProvider`**: Theme context (dark/light, flag-ambient glow injection).
4. **`HaloWayfinding`**: Global navigation overlay (`<Halo />`) providing contextual shortcuts and system status.

---

## 2. The 4-Layer Modular Component Pattern

To enforce maintainability and performance across 750+ components, complex views (>500 lines) are decomposed into four strict layers:

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
1. **Business Logic Layer (`src/lib/*.ts`)**: Pure functions (e.g. `synergy-calculator.ts`, `wiki/bridge.ts`, `ixtime.ts`). Never import React or UI elements.
2. **State Management Layer (`src/hooks/*.ts`)**: Custom hooks that query tRPC, manage optimistic updates, and wrap timers (e.g. `useUnifiedFlags.ts`, `useNationalIdentityState.ts`).
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

### Active Hub Routers:
| Router | Location | Sub-Sections |
| :--- | :--- | :--- |
| **`MyCountryRouter`** | [`src/components/mycountry/MyCountryRouter.tsx`](file:///home/jxsig/projects/ixstats/src/components/mycountry/MyCountryRouter.tsx) | Overview, Executive, Diplomacy, Intelligence, Defense, Politics |
| **`VaultRouter`** | [`src/components/vault/VaultRouter.tsx`](file:///home/jxsig/projects/ixstats/src/components/vault/VaultRouter.tsx) | Dashboard, Binder, Packs, Marketplace, Crafting |
| **`ThinkPagesRouter`**| [`src/components/thinkpages/ThinkPagesRouter.tsx`](file:///home/jxsig/projects/ixstats/src/components/thinkpages/ThinkPagesRouter.tsx) | Feed, ThinkTanks, ThinkShare Messaging, Polls |
| **`DashboardRouter`** | [`src/components/dashboard/DashboardRouter.tsx`](file:///home/jxsig/projects/ixstats/src/components/dashboard/DashboardRouter.tsx) | Briefing, Feed, Diplomacy Telemetry, Trends |

---

## 4. Facet Design System & Styling Rules

The platform UI is built on **Facet** — a tactile, refraction-based design language:

```
┌─────────────────────────────────────────────────────────────┐
│                    FACET DEPTH HIERARCHY                    │
├─────────┬───────────────────┬───────────────────────────────┤
│ Depth 1 │ Surface Base      │ Flat cards, subtle borders    │
│ Depth 2 │ Raised Widget     │ Interactive cards, metrics    │
│ Depth 3 │ Floated Overlay   │ Dropdowns, tooltips, popovers │
│ Depth 4 │ Modal / Dialog    │ High blur, prominent shadow   │
└─────────┴───────────────────┴───────────────────────────────┘
```

### Key UI Primitives:
- **`FacetCard`** (`src/components/facet-ui/FacetCard.tsx`): Container with depth levels (`depth={1..4}`), subtle refraction borders, and optional flag ambient glow.
- **`FacetTabs`** (`src/components/facet-ui/FacetTabs.tsx`): Spring-physics tab bar with sliding sheen indicator (`tone: "neutral" | "accent" | "mycountry" | "forum" | "sdi"`).
- **`BaseMetricDetailsModal`** (`src/components/modals/metric-details/BaseMetricDetailsModal.tsx`): Universal 4-tab drilldown modal (Overview, Trends, Comparison, Details).

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
- **Flags**: `useFlag`, `useUnifiedFlags` (`src/hooks/useUnifiedFlags.ts`) — single source of truth for country flag URLs and SVG badge rendering.
- **Auto-Sync**: `useGenericAutoSync` (`src/hooks/useGenericAutoSync.ts`) — universal debounced autosave engine.
- **Notifications**: `useNotify` (`src/hooks/useNotify.ts`) — standardized toast and status messages.
- **Media / Wiki**: `useWikiProfile` (`src/hooks/useWikiProfile.ts`) — cached MediaWiki infobox extraction.
