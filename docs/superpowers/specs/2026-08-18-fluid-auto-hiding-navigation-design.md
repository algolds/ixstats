# Design Specification: Fluid Auto-Hiding Navigation Architecture

## Overview
This specification details the transition from an arbitrary page-whitelisted "headless" navigation model to an Apple-grade, fluid auto-hiding navigation system. The new architecture provides full viewport focus to page content during downward reading/scrolling while ensuring instant, interruptible spring reveal on upward scrolling anywhere on the page, with zero visual collisions or layout jitter.

---

## 1. Problem Statement & Root Cause
In previous revisions:
1. Non-whitelisted pages (`/countries`, `/thinkpages`, `/wiki/*`, `/sports`, etc.) were forced into `data-headless-nav="true"`.
2. This forced `body:has([data-headless-nav]) main { padding-top: 0 !important; }`, which pushed page headers right against the top of the viewport.
3. The floating Dynamic Island (Halo) still floated at `top: 10px`, directly colliding with page search bars, filters, and titles.
4. When the user revealed the navbar, the 64px fixed bar dropped on top of page content, occluding buttons and headings.
5. Upward scroll gesture detection only worked at `window.scrollY <= 0`, making the navigation feel frozen or unresponsive when scrolled down.

---

## 2. Target Architecture & Principles (Apple Design Aligned)

### 2.1 Unified Floating Translucent Chrome
- **Initial State (`scrollY < 50px`)**:
  - The navigation bar is anchored at `top: 0` with `backdrop-filter: blur(20px)` and subtle border.
  - `main` has standardized safe top padding (`pt-14` / `56px` on mobile, `pt-16` / `64px` on desktop $\ge 1024\text{px}$).
  - Dynamic Island (Halo) sits harmoniously inline between left and right desktop nav wings.
- **Scroll Down (`deltaY > 10px`, `scrollY >= 50px`)**:
  - The navigation bar translates smoothly up off-screen (`translateY(-100%)`).
  - The Halo translates up off-screen in unison (`y = -100px`), maximizing screen real estate for content.
- **Scroll Up (`deltaY < -15px`)**:
  - Both navigation bar and Halo instantly spring back into view (`translateY(0)` / `y = 8px`).
  - Uses critically damped Apple spring physics (`damping: 32`, `stiffness: 350`, `mass: 1`).
  - Gesture is fully interruptible: reversing direction mid-flight immediately redirects motion without velocity discontinuity.
- **Interaction Locking**:
  - When the Halo is expanded (search open, notification center active, settings panel open) or the mobile navigation drawer is open (`mobileMenuOpen = true`), chrome visibility is locked to `isNavVisible = true` to avoid accidental dismissal during interaction.
- **Immersive / Full-Bleed Opt-Outs**:
  - Dedicated canvas and map pages (`/builder` via `data-builder-headless`, `/maps` via `data-maps-page`) explicitly opt out of standard top padding to preserve their specialized full-bleed viewports.

---

## 3. Component & State Breakdown

### 3.1 `src/hooks/useNavigationScroll.ts`
Manages scroll telemetry, velocity tracking, and visibility state:
```typescript
export interface NavigationScrollState {
  scrollY: number;
  isSticky: boolean;
  isNavVisible: boolean;
  scrollDirection: "up" | "down" | "idle";
}
```
- Listens to `window` scroll with `requestAnimationFrame` interpolation.
- Employs hysteresis:
  - Downward threshold: `deltaY > 10px` beyond 50px scroll position $\rightarrow$ `isNavVisible = false`.
  - Upward threshold: `deltaY < -15px` $\rightarrow$ `isNavVisible = true`.
  - Top threshold: `scrollY < 50px` $\rightarrow$ `isNavVisible = true`.
- Clamps negative values (protects against iOS/Safari bounce rubber-banding).
- Ignores wheel/scroll events that originate inside modal dialogs or isolated editor panes (`[role="dialog"]`, `[data-radix-portal]`, `.monaco-editor`, `.plate-editor`).

### 3.2 `src/app/_components/navigation.tsx`
- Replaces `isCriticalPage` whitelist and `useHeadlessNav` with the unified `useNavigationScroll` hook.
- Controls navbar translation and synchronization with `CommandPalette`.
- Passes `isNavVisible` down or applies motion styles to the fixed `<nav>` element.
- Enforces visibility lock when `mobileMenuOpen` or Halo interaction is active.

### 3.3 `src/components/halo/index.tsx` (CommandPalette)
- Coordinates its Y-translation with `isNavVisible`:
  - When `isNavVisible = true`: `y = activeIsSticky ? 8 : Math.max(0, 10 - activeScrollY)`
  - When `isNavVisible = false`: `y = -100` (off-screen)
- Preserves smooth spring physics and expansion logic.

### 3.4 `src/styles/layout/navigation.css`
- Normalizes `main` top padding:
  - Standard: `padding-top: 56px` (`lg:padding-top: 64px`).
  - Immersive override: `body:has([data-builder-headless]) main, body:has([data-maps-page]) main { padding-top: 0 !important; }`.
- Simplifies CSS transition rules and eliminates stale `data-headless-nav` overrides.

### 3.5 Page Cleanups
- **`src/app/countries/_components/CountriesHeader.tsx`**:
  - Remove manual `pt-12` compensatory padding.
  - Set sticky header to `sticky top-0 z-30 mb-2 pb-2` so it pins cleanly when chrome recedes and sits beneath chrome when chrome appears.

---

## 4. Accessibility & Reduced Motion
- Uses `@media (prefers-reduced-motion: reduce)` to replace spring/slide translations with 200ms opacity fades (`opacity: 1` $\leftrightarrow$ `opacity: 0`).
- Touch hit-targets on mobile navbar buttons maintain $\ge 44\text{px} \times 44\text{px}$ dimension.
- Full ARIA compliance on mobile drawer (`role="dialog"`, `aria-modal="true"`, `aria-expanded`).

---

## 5. Verification Matrix
| Test Case | Scenario | Expected Outcome |
|:---|:---|:---|
| **Initial Top Layout** | Visit `/countries`, `/thinkpages`, `/dashboard`, `/wiki/Main_Page` at `scrollY = 0` | Navbar visible, Halo centered, page titles & search inputs have clear margin below nav |
| **Scroll Down** | Scroll down $> 50\text{px}$ on any content page | Chrome glides up off-screen smoothly; full screen dedicated to page content |
| **Scroll Up Mid-Page** | Scroll down to $500\text{px}$, scroll up by $20\text{px}$ | Chrome immediately glides down into view with critically damped spring motion |
| **Top Return** | Scroll all the way back to top | Chrome remains visible and locks to top position without fluttering |
| **Interaction Lock** | Open Halo search or mobile drawer and scroll | Chrome remains visible; scroll does not close or translate navigation |
| **Immersive Pages** | Visit `/builder` and `/maps` | Viewport starts full-bleed with `padding-top: 0` as intended |
| **Modal / Inner Scroll** | Scroll inside dialog / dropdown | Navigation visibility does not falsely toggle |
