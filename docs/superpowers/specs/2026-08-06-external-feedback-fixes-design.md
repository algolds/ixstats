# IxStates External Tester Feedback Addressal — Design Spec

**Date**: 2026-08-06  
**Status**: Approved  
**Target Systems**: MyCountry v2 / Intent Engine, Maps Editor, Government & Fiscal UI, Daily Rewards, Vault Cosmetics

---

## 1. Executive Summary

This design document outlines technical solutions for issues identified by the first external test user of IxStates. The updates target five core areas:
1. **MyCountry v2 & Intent Engine Integration for National Issues**
2. **Maps & Geography Editor (Globe-2D transition, trash bin UX & deletion state bug, landmark toolbar)**
3. **Government, Legislature & Fiscal Settings (Vatican seat rule, public opinion ranges, unpopulated fields, currency formatting)**
4. **Daily Rewards Copy & Balance (IxCredits copy, streak card scaling)**
5. **Vault Shop Cosmetic Differentiation (Shield badge vs moderation badge clarity)**

*Note: The Forum top navigation integration is intentionally deferred per project direction and will be enabled in a future release.*

---

## 2. Component Design & Changes

### 2.1 MyCountry v2 Intent-Driven Issues Engine
- **Goal**: Transform national issues from static, isolated popups into dynamic dilemmas integrated into MyCountry v2's Intent Engine (`IntentComposer`).
- **Architecture**:
  - Tying issue generation to Intent goal commitments (`src/components/mycountry/primitives/IntentComposer.tsx`).
  - Connecting issue resolution outcomes to Broker Faction standing (`Technocrats`, `Magnates`, `Generals`, `Party`, `Clergy`) and policy intent chains.
  - Adding configurable issue cadence settings (Real-time vs Daily vs Intent-triggered).

### 2.2 Maps & Geography Editor
- **Globe to 2D Map Zoom Smoothness**:
  - Add camera interpolation cross-fade transition ($\tau = 0.35\text{s}$) in MapLibre/DeckGL canvas state to replace hard projection jump on zoom threshold.
- **Region Trash Can UX & Reactivity Bug**:
  - Update `FeatureList.tsx` / `LayerPanel.tsx` trash icon: size 1.25x, always visible (remove hover-only requirement), red accent (`text-rose-500 hover:bg-rose-500/20`).
  - Fix state synchronization bug in `useSubdivisionDraw` / `EditorMap.tsx` where deleting a region requires another action to re-render canvas. Ensure region delete calls trigger immediate state flush.
- **Landmark Toolbar Consolidation**:
  - Merge "Natural Landmarks" into POI drawer as a secondary tab (`Man-made POIs` / `Natural Landmarks`), consolidating toolbar buttons.

### 2.3 Government, Legislature & Fiscal Setup
- **Legislature Seat Cap (Vatican City Rule)**:
  - Update min seat validator in `LegislaturePanel.tsx` and Prisma backend schemas from 10 to 1 (allowing range `[1, 50000]`).
- **Public Opinion & Approval Ratings**:
  - Differentiate Faction Approval (independent 0-100%) from Vote Share (sums to 100%).
  - Allow democratic executive approval ratings to scale up to 100%.
- **Unpopulated Field Hiding**:
  - In `GovernmentTab.tsx`, conditionally render text fields so unset properties (e.g. blank Head of State name) hide the card or show an inline `+ Add Head of State` action instead of empty boxes.
- **Currency Customization**:
  - Add currency configuration options: Symbol (e.g. `$`), Plural Name (e.g. `Kittanias`), and Position (`Prefix` vs `Suffix`).

### 2.4 Daily Rewards & Vault Cosmetics
- **Daily Bonus Copy**:
  - Update `DailyBonusWidget.tsx` copy from `"1-10k credits"` to `"1 to 10,000 IxCredits"`.
- **Streak Card Rarity Scaling**:
  - Add streak tier bonuses for card pulls (7-day streak guarantees Rare+ drop, 30-day guarantees Epic/Legendary drop).
- **Diamond Shield Badge Visual Distinction**:
  - Add explicit `"Cosmetic Supporter Badge"` tooltip and visual aura framing to distinguish user cosmetic badges from official Staff/Moderator badges.

---

## 3. Verification & Testing Strategy

1. **Automated Tests**:
   - `LegislaturePanel.test.ts`: Verify seat input validation permits 1 seat.
   - `DailyBonusWidget.test.ts`: Verify copy rendering.
   - `currencyFormatter.test.ts`: Test prefix/suffix and pluralization formatting.
2. **Manual Verification**:
   - Verify region deletion in Map Editor removes region immediately from canvas without extra user inputs.
   - Verify Intent Engine proposal triggers corresponding domain issue dilemmas.
