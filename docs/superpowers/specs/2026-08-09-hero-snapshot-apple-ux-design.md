# Design Spec — 4-Tab Apple UX Hero Snapshot & Executive Agenda

**Date**: 2026-08-09  
**Status**: Approved  
**Target File**: `src/components/dashboard/hero/HeroSnapshotPanels.tsx`, `src/components/dashboard/hero/DashboardHero.tsx`

---

## 1. Overview

Transform the Dashboard Hero Snapshot into a 4-tab Apple-inspired control surface (`Overview`, `Agenda`, `Diplomacy`, `Defense`). Eliminate raw percentage numbers across all indicators in favor of human-readable qualitative ratings (*Optimal*, *Strong*, *Ironclad Alliance*, *Combat Ready*). Upgrade the `Agenda` tab into an Apple Calendar & Reminders-style chronological timeline widget.

---

## 2. Architecture & Tab Structure

### Consolidated 4 Tabs
1. **Overview**: National stats (GDP per cap, population, land area) and 4 National Health rings with qualitative labels (*Optimal*, *Strong*, *Stable*, *Moderate*, *Vulnerable*).
2. **Agenda** *(Replaces Executive)*: Apple Calendar & Reminders-style chronological mini agenda surfacing:
   - **Urgent Issue**: Priority national issue requiring executive action (Red/Amber indicator).
   - **Cabinet Session**: Scheduled cabinet meeting or briefing topic (Blue indicator).
   - **Policy Action**: Draft directive or policy awaiting signature (Emerald indicator).
3. **Diplomacy**: Key diplomatic ties with `UnifiedCountryFlag` thumbnail flags and qualitative stance badges (*Ironclad Alliance*, *Strong Ties*, *Warm Relations*, *Neutral Stance*, *Strained Ties*).
4. **Defense**: Combined security domain & force readiness panel with qualitative readiness badges (*Combat Ready*, *Operational*, *Refitting*, *Standby*).

---

## 3. Apple Design Guidelines (`/apple-design`)

- **Translucent Glass Surface**: `backdrop-blur-2xl bg-white/[0.05] dark:bg-black/35 border border-white/15 dark:border-white/10 shadow-xl shadow-black/10 rounded-2xl`.
- **Calendar/Reminders Agenda Cards**:
  - Vertical accent color pill on left edge (`w-1 rounded-full`).
  - Event title with `font-bold tracking-tight text-[10px] text-foreground/90`.
  - Right-aligned status pill (`bg-white/[0.06] border border-white/10 px-1.5 py-0.5 text-[8px] font-semibold`).
- **Tactile Feedback**: Snappy physical spring press scaling (`active:scale-[0.97] transition-all duration-150 ease-out`).
- **Typography**: Optical sizing, tight tracking on headings, positive tracking on micro-caps headers (`tracking-wider text-[8px] font-bold uppercase opacity-75`).

---

## 4. Qualitative Indicator Mapping (No Hard Percentages)

- **National Health**:
  - ≥ 80: "Optimal"
  - ≥ 65: "Strong"
  - ≥ 45: "Stable"
  - ≥ 30: "Moderate"
  - < 30: "Vulnerable"
- **Diplomatic Ties**:
  - ≥ 80: "Ironclad Alliance"
  - ≥ 65: "Strong Ties"
  - ≥ 45: "Warm Relations"
  - ≥ 25: "Neutral Stance"
  - < 25: "Strained Ties"
- **Force Readiness**:
  - ≥ 75: "Combat Ready"
  - ≥ 50: "Operational"
  - ≥ 30: "Refitting"
  - < 30: "Standby"

---

## 5. Verification Plan

1. Test local dev build on `localhost:3000/dashboard`.
2. Cycle through all 4 hero tabs (`Overview`, `Agenda`, `Diplomacy`, `Defense`).
3. Verify Agenda renders chronological items with Apple Calendar/Reminders visual styling.
4. Verify Diplomacy tab renders `UnifiedCountryFlag` next to target country names.
5. Verify no hard percentages are present across any of the 4 tabs.
