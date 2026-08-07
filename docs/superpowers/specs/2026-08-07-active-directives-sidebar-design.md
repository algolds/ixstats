# Design Specification: Active Directives Sidebar Rail

**Date:** 2026-08-07  
**Status:** Approved  
**Target File:** `src/components/mycountry/v2/V2Agenda.tsx`

## Overview

Refactor the right sidebar card previously titled **"Your Agenda"** into **"Active Directives"**. This eliminates title ambiguity with the main **Unified Executive Agenda** (`V2MyAgenda.tsx`) while providing a dedicated executive steering rail equipped with a live capacity meter and quick-declare action button.

---

## Component Features: `V2Agenda.tsx`

### 1. Header & Capacity Telemetry
- **Title**: `Active Directives` (replaced `Your Agenda`).
- **Icon**: `Command` icon with `text-amber-500`.
- **Capacity Badge**: Real-time directives utilization pill (`api.intent.getStatus`), showing `X / Y Slots` (e.g. `2 / 3 Slots`).

### 2. Directive Rollout Cards
- **Intent Items**: Renders root intents from `api.intent.getTree`.
- **Tier & Status Badges**: High-contrast theme-adaptive pills for intent tiers (`MEASURED`, `MODERATE`, `EXTREME`) and statuses (`ACTIVE`, `PROPOSED`, `COMPLETED`).
- **Follow-up Indicators**: Sub-intent counter (e.g., `2 follow-ups`).
- **Click Action**: Opens intent details / intent tree viewer (`onOpenIntent`).

### 3. Quick Action Button
- **Declare Action**: Prominent `+ Declare Directive` button at the bottom of the card (`onDeclare?.()`) opening the `IntentComposer` modal.

---

## Theme & Design Compliance
- **Theme Adaptive**: Full light mode & dark mode support (`bg-card/40 dark:bg-card/30 border-border/80 dark:border-white/10`).
- **Facet Depth**: `FacetCard depth={1}` with glass translucency and micro-interactions.
- **Apple Design Motion**: Interactive press scaling (`active:scale-[0.98]`) on directive items and action buttons.
