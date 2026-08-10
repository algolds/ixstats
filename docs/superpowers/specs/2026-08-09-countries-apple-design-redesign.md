# Design Specification: Countries Profile Page Apple-Design Redesign

**Topic:** Redesigning `/countries/[slug]` using Apple Interface Guidelines (WWDC Fluid Interfaces & Spatial Principles)  
**Date:** 2026-08-09  
**Status:** Approved  

---

## 🎯 Executive Summary

The Countries Profile page (`/countries/[slug]`) is redesigned from a standard data grid into an **immersive, physical national command stage**. Combining Apple Design principles (fluid physics, translucent depth materials, origin-anchored morphing, optical typography) with strict TypeScript domain architecture (branded primitives, zero `@ts-nocheck`), the redesign elevates user engagement while enforcing clean codebase engineering.

---

## 🏗️ 1. Architecture & Component Hierarchy

Components live under `src/app/countries/[slug]/` organized by responsibility:

```
src/app/countries/[slug]/
├── _types/
│   └── index.ts                   # Branded primitives (CountrySlug, CountryId), state schemas
├── _hooks/
│   ├── useCountryPageState.ts     # State management (banner mode, toggles, active tabs)
│   └── useOriginTransform.ts      # Origin calculation for Apple morphing cards
├── _utils/
│   └── countryDataTransformers.ts   # Type-safe telemetry transformers (no @ts-nocheck)
├── _components/
│   ├── CountryHeaderStage.tsx     # Hero stage + scroll-collapsing Dynamic Island Halo Bar
│   ├── CountrySegmentedNav.tsx    # Dual-tier glass tab lens with sliding active indicator
│   ├── VitalityRingMatrix.tsx     # Radial telemetry rings with origin-anchored morph
│   ├── MorphingDetailCard.tsx     # Origin-anchored spring detail modal container
│   ├── CountryGeographyPortal.tsx # Interactive map card with rubber-band bounds
│   └── LivingActivityFeed.tsx     # Real-time activity timeline with category filtering
└── (profile)/
    ├── layout.tsx                 # Persistent route layout shell & CountryDataProvider
    ├── factbook/
    │   └── [...sections]/         # Factbook telemetry views (Economy, Labor, Geography)
    ├── dossier/page.tsx           # Wiki-synced history & native lore canvas
    └── activity/page.tsx          # Full public activity feed stream
```

---

## 💾 2. Data Flow & Type Architecture

### 2.1 Branded Domain Types
Primitive obsession is eliminated by branding country slugs and IDs at compile time:

```typescript
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type CountrySlug = Brand<string, "CountrySlug">;
export type CountryId = Brand<string, "CountryId">;

export const toCountrySlug = (slug: string): CountrySlug => slug as CountrySlug;
export const toCountryId = (id: string): CountryId => id as CountryId;
```

### 2.2 Strict Type Checking (Zero `@ts-nocheck`)
All `@ts-nocheck` directives in transformers and activity panels are removed. Data transformers enforce explicit inputs (`Pick<BaseCountryData, ...>`) and typed return interfaces (`EconomicsData`, `VitalityData`, `MetricCardData[]`).

### 2.3 State Machine & `satisfies` Validation
- **Banner Modes**: `"dynamic" | "flag" | "gradient" | "custom"` validated with `satisfies BannerOption[]`.
- **Navigation Tabs**: Tier 1 (`"overview" | "lore" | "activity"`) and Tier 2 (`"overview" | "geography" | "economy" | "labor" | "government"`) derived automatically from route pathnames.
- **Activity Filter & Windows**: Filter types (`"all" | "posts" | "economic" | "diplomatic" | "social"`) and time windows (`"7d" | "30d" | "90d"`) map directly to tRPC parameters.

---

## 🍏 3. Motion, Physics & Physicality Specifications

### 3.1 Spring Physics
- **Structural Default**: Critically damped spring (`damping: 1.0`, `response: 0.35`) for tab indicator slides and header collapse.
- **Momentum Interaction**: Under-damped spring (`damping: 0.8`, `response: 0.4`) for card morphing expansions and flick releases.

### 3.2 Origin-Anchored Morphing Cards
Clicking any radial Vitality Ring calculates its screen position via `getBoundingClientRect()`. The expanded detail modal spring-animates outwards from that specific coordinate origin (`transform-origin`). Interruption mid-motion returns cleanly to the originating ring.

### 3.3 Scroll-Collapsing Halo Capsule (Dynamic Island)
When `window.scrollY > 220px`, the hero stage smoothly shrinks and transforms into a pinned top glass capsule (`top-4 left-1/2 -translate-x-1/2`), preserving key national stats while scrolling long telemetry pages.

### 3.4 Translucent Material System
- Glass surfaces use `backdrop-filter: blur(24px) saturate(180%)` with top light-catching edge borders (`border-t border-white/25`).
- Buttons and badges implement 1:1 direct tactile press feedback (`active:scale-[0.96] transition-transform duration-100 ease-out`).

---

## 🛡️ 4. Edge Cases & Accessibility

- **Fallback Imagery**: Dynamic Unsplash photography gracefully falls back to flag-derived ambient color gradient washes if rate limited.
- **Null Safety**: Population and GDP formatters strictly protect against `null`, `undefined`, and `0` without rendering `$NaN`.
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce` by replacing spring transforms with 150ms opacity cross-fades.
- **Reduced Transparency**: Supports `prefers-reduced-transparency: reduce` by raising background opacity to 95% and disabling heavy blurs.
