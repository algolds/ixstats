# External Player Onboarding & Maps Gatekeeping Design Spec

**Date:** July 20, 2026  
**Status:** Approved by User  
**Target Release:** Platform Launch Prep

This specification outlines the changes required to prepare the platform for its first external players/countries. The goal is to ensure a smooth, clear onboarding process, prevent information overload in the country builder, gatekeep the maps system cleanly, and update relevant help documentation with human-written, straightforward language (no AI buzzwords).

---

## 1. Maps Viewport Gatekeeping Alert

External players should have read-only access to the map but must be informed that plotting their own nations is not yet supported.

### Changes
* **Component:** Modify [src/components/maps/core/MapContainer.tsx](file:///home/jxsig/projects/ixstats/src/components/maps/core/MapContainer.tsx).
* **Behavior:** 
  * Check the user's role using `useIsStaff` from [src/hooks/usePermissions.ts](file:///home/jxsig/projects/ixstats/src/hooks/usePermissions.ts).
  * If `isStaff` is `false` (meaning the user is a standard external player, level 100), display a dismissible warning card in the viewport.
  * If `isStaff` is `true`, hide the warning completely.
* **UI Style:** A floating glassmorphism card styled with the Facet design system (`backdrop-blur-md bg-amber-500/10 border-amber-500/20`), an amber warning indicator, and a close button `[x]`.
* **Copy:** 
  > **Maps Private Beta**  
  > External country integration and interactive plotting are under active development. You can freely explore the world map, topography, and other nations, but adding your own borders or claiming territory is not yet open to external players.

---

## 2. Builder Information Density Control

Casual users need a simplified country building process, while power users want granular control.

### Changes
* **Builder State Context:** Modify [src/app/builder/components/builder-filter-context.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/builder-filter-context.tsx) or builder state to track `viewMode` (`'standard' | 'expert'`).
* **Segmented Toggle:** Add a "Standard" vs "Expert" toggle inside [src/app/builder/components/BuilderNotchBar.tsx](file:///home/jxsig/projects/ixstats/src/app/builder/components/BuilderNotchBar.tsx).
* **View Filtering (Standard vs. Expert):**
  * **Government Step:** In standard mode, hide the "Departments" and "Budget Allocations" sub-tabs entirely. Automatically set balanced default budget allocations based on the country's starting archetype.
  * **Economics Step:** In standard mode, hide precise demographic sliders and tax-bracket customizers. Show only the 4 core inputs: *Total Population*, *Average Tax Rate*, *Agriculture/Industry/Services Sector Mix*, and *Global Trade Openness*.
* **Inline Help Tooltips:**
  * Add subtle hover tooltips next to complex inputs: *Nominal GDP*, *Gini Coefficient*, *Tax Revenue GDP %*, and *Inflation Rate*.
  * Write clear, plain-language explanations of what each metric is and how it impacts the simulation.

---

## 3. Onboarding Setup Slide Expansion

Introduce key simulation concepts before the user enters the platform.

### Changes
* **Setup Steps:** Modify `setupIntroSteps` in [src/app/setup/page.tsx](file:///home/jxsig/projects/ixstats/src/app/setup/page.tsx) to append three slides:
  1. **IxTime (The World Clock):** Explain the 2x speed clock. one real hour is two hours in-game; growth and crisis deadlines happen twice as fast.
  2. **IxnayID (Account Linking):** Explain how to link Discord, Wiki, and Forum accounts.
  3. **IxCredits & Vault:** Explain earning credits through achievements/login and opening card packs in the Vault.

---

## 4. Help Documentation Updates & New IxnayID Guide

Keep documentation clean, accurate, and completely free of AI slop language (no "delve", "testament", "tapestry", "leverage", etc.).

### Changes
* **New Article:** Create [src/app/help/getting-started/ixnayid/page.tsx](file:///home/jxsig/projects/ixstats/src/app/help/getting-started/ixnayid/page.tsx).
  * Document how IxnayID connects wiki accounts (verification page check), forum profiles (username mapping), and Discord accounts (auth/sync), allowing seamless SSO.
* **Register Article:** Add the `ixnayid` metadata under the "Start Here" (`getting-started`) category in [src/app/help/page.tsx](file:///home/jxsig/projects/ixstats/src/app/help/page.tsx).
* **Audit Guides:** Review existing [ixtime](file:///home/jxsig/projects/ixstats/src/app/help/getting-started/ixtime/page.tsx) and [ixcredits](file:///home/jxsig/projects/ixstats/src/app/help/vault/ixcredits/page.tsx) pages to clean up any confusing terminology and ensure accuracy.

---

## Verification Plan

### Manual Verification
1. Log in as a standard user (`role: user`, level 100) and verify that:
   * The `/maps` page displays the private beta warning banner.
   * Dismissing the banner hides it for the session.
2. Visit `/builder` and verify that:
   * The Standard/Expert toggle shifts the UI.
   * Standard mode hides departmental allocations and granular demographics.
   * Hovering tooltips display plain-english explanations of GDP, Gini, inflation, and tax rate.
3. Access `/setup` (when onboarding) and verify the 5 welcome slides load correctly.
4. Go to `/help` and verify the IxnayID page is listed and readable.

### Automated Tests
* Run `bun run typecheck` to verify no compilation or type regressions.
