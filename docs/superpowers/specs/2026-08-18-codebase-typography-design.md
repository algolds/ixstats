# Specification: Global Typography & Typeface Harmonization

**Date:** 2026-08-18  
**Status:** Approved for Phased Execution (Option A)  
**Architecture Pillar:** Facet Design System & Platform Foundation  
**Design Standards:** Apple Design (§15 Optical Sizing & Hierarchy Sets) · Emil Kowalski UI Polish  

---

## 1. Executive Summary

This specification establishes a strict, canonical **4-Tier Semantic Typography System** across all 750+ UI components in IxStates. It eliminates weight sprawl (retiring `font-black` 900 and `font-extrabold` 800 from standard UI elements), remedies inverted optical tracking on uppercase microcopy, standardizes discrete pixel sizing (retiring fractional subpixel steps), corrects hardcoded canvas font measuring strings to match the platform font stack (`Geist` sans / `Playfair` editorial serif), and unifies pill badge corner radiuses and text transformations.

Execution is partitioned into **4 sequential, domain-scoped phases**:
1. **Phase 1: MyCountry Executive Command Suite, Economy & Government Modules**
2. **Phase 2: IxVault, Cards, Collections & Marketplace**
3. **Phase 3: Thinkpages, Messages & Sports Simulation**
4. **Phase 4: WikiOS, Maps, Diplomatic & Core Primitives**

---

## 2. Global 4-Tier Semantic Type Scale

Every UI component in IxStates must adhere strictly to the following 4-tier semantic type hierarchy:

| Tier | Semantic Role | Font Size (Tailwind) | Font Weight | Letter Spacing (Tracking) | Line Height | Case / Format |
|---|---|---|---|---|---|---|
| **Tier 1: Display & Headers** | Page Titles, Large Numbers | `text-base` to `text-4xl`<br>(16px – 36px) | `font-bold` (700) | `tracking-tight`<br>(-0.02em to -0.01em) | `leading-tight`<br>(1.1 – 1.25) | Title Case or `tabular-nums` |
| **Tier 2: Card Titles & Controls** | Widget Headers, Form Labels, Active Tabs | `text-xs` (12px) or `text-sm` (14px) | `font-semibold` (600) | `tracking-tight`<br>(-0.015em) | `leading-snug`<br>(1.3) | Title Case |
| **Tier 3: List Items & Body Text** | Feed Posts, Article Snippets, Table Rows | `text-[11px]` to `text-sm`<br>(11px – 14px) | `font-normal` (400) or `font-medium` (500) | `tracking-normal`<br>(0em) | `leading-relaxed`<br>(1.5 – 1.6) | Sentence case / Prose |
| **Tier 4: Micro-Badges & Telemetry** | Eyebrows, Status Badges, Timestamps | `text-[8px]` to `text-[10px]`<br>(8px – 10px) | `font-medium` (500) or `font-semibold` (600) | `tracking-wider`<br>(+0.05em to +0.08em) | `leading-none`<br>(1.0) | UPPERCASE + `rounded-full` or `tabular-nums` |

---

## 3. Core Typographic Rules & Anti-Patterns

1. **Retirement of `font-black` (900):**
   - `font-black` is prohibited on standard buttons, card titles, article links, badges, and body copy.
   - Large hero numbers (e.g. `$14.2B`, `116,503`) must use `font-bold` (700) with `tabular-nums`.
2. **Apple Optical Tracking Law:**
   - **Small Text ($\le 11\text{px}$) & All-Caps Microcopy:** Must use positive tracking (`tracking-wider` or `tracking-widest`). Never use `tracking-tight` on small uppercase text.
   - **Large Headings ($\ge 16\text{px}$):** Must use negative tracking (`tracking-tight` or `tracking-tighter`) to prevent optical looseness.
   - **Standard Body (12px–14px):** Must use `tracking-normal` (0 tracking).
3. **No Fractional Subpixel Font Sizes:**
   - Permitted discrete scale: `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px), `text-3xl` (30px), `text-4xl` (36px).
   - Banned: `text-[8.5px]`, `text-[9.5px]`, `text-[10.5px]`, `text-[12.5px]`.
4. **Pill Badge Standardization:**
   - Shape: `rounded-full` across all widget badges (retiring `rounded-md` on parallel widgets).
   - Text: `text-[8px]` or `text-[9px] font-medium uppercase tracking-wider` or `font-semibold`.
5. **Canvas & PreText Measurement Parity:**
   - PreText components measuring text on canvas must strictly use `"12px Geist, -apple-system, sans-serif"`, matching Next.js `--font-geist-sans`.

---

## 4. Phase 1 Scope & Target Components

### Domain: MyCountry Executive Command Suite & Telemetry
- `src/components/mycountry/`
  - `DomainSurface.tsx`
  - `SmartStack.tsx`
  - `ExecutiveAgenda.tsx`
  - `CommitmentsAgendaRail.tsx`
  - `CommandBriefingHero.tsx`
  - `ExecutiveOpportunityHero.tsx`
  - `FiscalPolicyConsole.tsx`
  - `TradeCommerceConsole.tsx`
  - `EconomyDrillDown.tsx`
  - `PoliticsDrillDown.tsx`
  - `RealtimePulseWidget.tsx`
  - `DomainContextRail.tsx`
  - `ThinkPagesShareModal.tsx`
  - `primitives/IntentComposer.tsx`
  - `primitives/composer/DirectiveDiffPreview.tsx`
  - `primitives/composer/DirectiveTuningControls.tsx`
  - `primitives/composer/DirectivePresetsCatalog.tsx`
  - `sidebar-widgets/OverviewSidebarWidget.tsx`
- `src/components/government/`
  - `BudgetManagementDashboard.tsx`
  - `atomic/MetricsPanel.tsx`
  - `atomic/AtomicWelcomeModal.tsx`
  - `atoms/AtomicGovernmentComponents.tsx`
  - `atoms/BudgetAllocationForm.tsx`
  - `atoms/RevenueSourceForm.tsx`
- `src/components/economy/`
  - `atomic/MetricsPanel.tsx`
  - `atomic/EconomicWelcomeModal.tsx`
  - `atoms/AtomicEconomicComponents.tsx`
- `src/components/modals/metric-details/`
  - `BaseMetricDetailsModal.tsx`
  - `GdpDetailsModal.tsx`
  - `PopulationDetailsModal.tsx`
  - `DebtDetailsModal.tsx`
  - `LaborForceDetailsModal.tsx`
  - `GovernmentSpendingDetailsModal.tsx`
  - `DemographicsHealthDetailsModal.tsx`
