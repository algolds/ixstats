# Design Specification: Unified Executive Agenda & Calendar Integration

**Date:** 2026-08-07  
**Status:** Approved  
**Target File:** `src/components/mycountry/v2/V2MyAgenda.tsx`

## Overview

This specification unifies the Halo Dynamic Island executive calendar (`CalendarView`) and the MyCountry agenda (`V2MyAgenda`) into a single, high-fidelity **Unified Executive Agenda** component located directly inside the MyCountry V2 interface. The calendar view and live activity plugin are removed from Halo Dynamic Island to eliminate domain overlap and streamline global navigation.

---

## Component Architecture: `V2MyAgenda.tsx`

### 1. Header Hero Card & StandBy IxTime Clock
- **Live IxTime Telemetry**: Driven by `useIxTimeStore` (`ixTimeTimestamp`, `gameYear`), calculating IxTime year, northern-hemisphere season, and day of year. Zero-layout-shift tabular monospace countdown clock with pulsing colon (`:`).
- **Regime-Aware WatchOS Complications**:
  - *Democracy*: Constitutional term progress (`Yr X.X / Y`).
  - *Monarchy*: Regime tenure (`X.X Years`).
  - *Dictatorship*: Regime grip percentage (`X% Grip`) with revolution risk tooltip based on democracy index and political stability.
- **Directives Slot Capacity**: Interactive badge displaying active directive utilization vs. weekly capacity (`api.intent.getStatus`).

### 2. 7-Day Horizon Strip & Category Filter Bar
- **7-Day Horizon Picker**: Today + 6 future days with illuminated dot indicators for days containing scheduled statecraft events or active directive rollouts.
- **Category Filter Chips**: Filter pills (`All`, `Directives`, `Politics`, `Diplomacy`, `Defense`, `Economy`) allowing instant filtering of timeline items.

### 3. Unified Chronological Item Feed
- **Statecraft Events & Directives**: Merges active executive directive rollouts (from `api.intent.getTree`), parliamentary budget votes, bilateral diplomatic summits, military readiness audits, and central bank tax settlements into a single day-scoped timeline.
- **Interactive Quick Action Dialog**: Clicking any item opens a high-fidelity modal detailing the event context, recommended resolution intent string (with "Declare Directive to Resolve" action), and domain drill sheet navigation ("Inspect Domain Details").

---

## Decoupling & Legacy Cleanup

### 1. Halo Dynamic Island (`src/components/DynamicIsland/`)
- Remove `CalendarView.tsx` and `plugins/CalendarLiveDIPlugin.tsx`.
- Remove `"calendar"` view mode from `types.ts`, `CompactView.tsx`, `ExpandedView.tsx`, `hooks.ts`, and `HaloTourContext.tsx`.

### 2. Legacy MyCountry Widgets (`src/components/mycountry/`)
- Remove the legacy static red iOS calendar box in `OverviewHero.tsx`.
