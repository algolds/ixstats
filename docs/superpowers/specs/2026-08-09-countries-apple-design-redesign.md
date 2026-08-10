# Design Specification: Countries Profile Page Apple-Design Redesign

**Topic:** Complete Redesign of `/countries/[slug]` using Apple Interface Guidelines (WWDC Fluid Interfaces & Spatial Principles) and Advanced TypeScript Engineering  
**Date:** 2026-08-09  
**Status:** Approved Specification  

---

## 🎯 1. Executive Summary

The Countries Profile page (`/countries/[slug]`) is redesigned from a static data layout into an **immersive, physical national command stage**. It merges Apple's interaction foundations—fluid physics, translucent depth materials, origin-anchored morphing, direct 1:1 touch response, and optical typography—with advanced TypeScript engineering patterns (branded domain primitives, custom type guards, strict return signatures, and zero `@ts-nocheck` debt).

---

## 🏗️ 2. Component Hierarchy & Module Isolation

Components live under `src/app/countries/[slug]/` separated into focused, single-purpose units that communicate through strongly-typed interfaces:

```
src/app/countries/[slug]/
├── _types/
│   └── index.ts                   # Branded domain primitives (CountrySlug, CountryId), schemas, guards
├── _hooks/
│   ├── useCountryPageState.ts     # State machine (banner mode, display toggles, active tabs)
│   └── useOriginTransform.ts      # Origin calculation & live presentation value reader for Apple morphing
├── _utils/
│   └── countryDataTransformers.ts # Type-safe telemetry transformers (no @ts-nocheck)
├── _components/
│   ├── CountryHeaderStage.tsx     # Hero stage + scroll-collapsing Dynamic Island Halo Bar
│   ├── CountrySegmentedNav.tsx    # Dual-tier glass tab lens with sliding active indicator
│   ├── VitalityRingMatrix.tsx     # Radial telemetry rings with origin-anchored morph
│   ├── MorphingDetailCard.tsx     # Origin-anchored spring detail modal container
│   ├── CountryGeographyPortal.tsx # Interactive map card with rubber-band gesture bounds
│   └── LivingActivityFeed.tsx     # Real-time activity stream with category filtering
└── (profile)/
    ├── layout.tsx                 # Persistent route layout shell & CountryDataProvider
    ├── factbook/
    │   └── [...sections]/         # Factbook telemetry views (Economy, Labor, Geography)
    ├── dossier/page.tsx           # Wiki-synced history & native lore canvas
    └── activity/page.tsx          # Full public activity feed stream
```

---

## 💻 3. Advanced TypeScript & Full-Stack Architecture (`/typescript-pro`, `/typescript-expert`, `/typescript-advanced-types`)

### 3.1 Branded Domain Primitives
Primitive obsession is eliminated by branding string identifiers at compile time to prevent parameter mix-ups between country slugs, country IDs, and user IDs:

```typescript
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type CountrySlug = Brand<string, "CountrySlug">;
export type CountryId = Brand<string, "CountryId">;

export const toCountrySlug = (slug: string): CountrySlug => slug as CountrySlug;
export const toCountryId = (id: string): CountryId => id as CountryId;
```

### 3.2 Zero `@ts-nocheck` & Strict Transformers
- All `@ts-nocheck` directives are permanently removed from `countryDataTransformers.ts` and `CountryActivityPanel.tsx`.
- Transformer functions define precise generic constraints and explicit return signatures (`EconomicsData`, `VitalityData`, `MetricCardData[]`).
- Custom mapped types and utility types are used to derive sub-models without repeating interface definitions:
```typescript
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
```

### 3.3 State Machine, Type Guards & `satisfies` Verification
- **Discriminated State Machine**: Banner modes (`"dynamic" | "flag" | "gradient" | "custom"`), navigation tabs (`"overview" | "lore" | "activity"`), and activity filters (`"all" | "posts" | "economic" | "diplomatic" | "social"`) are modeled as discriminated unions.
- **Exhaustive Type Guards**: Type predicates validate runtime state structures, with exhaustive `never` checks in switch statements to prevent unhandled cases.
- **`satisfies` Operator**: Static configuration objects (e.g., `bannerOptions`, `filterOptions`, `vitalityRings`) use `satisfies` to validate constraint matching while retaining narrow literal types.

---

## 🍏 4. Apple Design Foundations (`/apple-design`)

### 4.1 Response & Latency Elimination (WWDC 2018)
- **Immediate Feedback**: Feedback triggers on `pointerdown` (touch-down) rather than `click`/release.
- **Tactile Scale Press**: All buttons, badges, and tabs implement a subtle physical press compression (`active:scale-[0.96] transition-transform duration-100 ease-out`).

### 4.2 Spring Physics & Interruptibility
- **Structural UI Default**: Critically damped spring (`damping: 1.0`, `response: 0.35s`) for tab indicators, layout shifts, and header collapsing. Zero overshoot or distraction.
- **Momentum Interaction**: Under-damped spring (`damping: 0.8`, `response: 0.4s`) for flick releases, card morphing, and drawer pulls.
- **Interruptibility**: Animations start from the live *presentation* (on-screen transform) value, allowing users to grab and redirect moving elements mid-flight without sudden visual jumps.

### 4.3 Origin-Anchored Morphing Cards
Clicking any Vitality Ring measures its bounding rect (`getBoundingClientRect()`). The expanded detail view spring-animates outwards from that specific coordinate origin (`transform-origin`). Closing or interrupting reverses the animation along the exact same trajectory to maintain spatial consistency.

### 4.4 Scroll-Collapsing Halo Capsule (Dynamic Island)
When `window.scrollY > 220px`, the hero stage smoothly shrinks and transforms into a pinned top glass capsule (`top-4 left-1/2 -translate-x-1/2`), preserving key national stats while scrolling long telemetry pages.

### 4.5 Translucent Materials & Hierarchy (WWDC 2026 Principles)
- **Glass Surfaces**: `backdrop-filter: blur(24px) saturate(180%)` with top light-catching edge borders (`border-t border-white/25`).
- **Visual Weight**: Darker/heavier glass separates structural containers; lighter glass highlights interactive elements.
- **Optical Typography**: Headings use optical negative tracking (`letter-spacing: -0.025em`) and tight leading (`line-height: 1.05`); uppercase micro-labels use positive tracking (`text-[10px] font-black tracking-widest uppercase`).

---

## 🛡️ 5. Edge Cases, Quality Assurance & Accessibility

- **Fallback Imagery**: Dynamic Unsplash photography gracefully falls back to flag-derived ambient color gradient washes if rate limited.
- **Null Safety**: Population and GDP formatters strictly protect against `null`, `undefined`, and `0` without rendering `$NaN`.
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce` by replacing spring transforms with 150ms opacity cross-fades.
- **Reduced Transparency**: Supports `prefers-reduced-transparency: reduce` by raising background opacity to 95% and disabling heavy blurs.
- **Testing & Verification**: Unit tests verify transformer math, Vitest type tests check domain branding, and clean `bun run lint` execution confirms zero lint errors.
