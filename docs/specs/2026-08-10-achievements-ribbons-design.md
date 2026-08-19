# Design Specification: Achievements & Ribbons Suite

**Date**: 2026-08-10  
**Status**: Approved  
**Aesthetic Framework**: Apple Design Foundations & Emil Kowalski Design Engineering

---

## 1. Overview & Vision

The `/achievements` suite is redesigned into a streamlined, high-contrast, dual-tab experience. The design enforces a strict separation of concerns between **In-Character Country Gameplay** and **Out-of-Character User Account Honors**:

1. **Achievements** = **Country-Bound (`countryId`)**: In-Character gameplay actions (Economy, Diplomacy, Military, Governance).
2. **Ribbons** = **User-Bound (`userId`)**: Out-of-Character community accomplishments (WikiOS authoring, Forum participation, Atlas cartography, Platform tenure).

Quest Trees are deprecated to ensure an ultra-clean, intuitive interface.

---

## 2. Page Architecture & Routing

- **Route**: `/achievements`
- **Tab Controller**: `VaultSubTabNav`
- **Sub-Tabs**:
  - `country` (Default): Country Achievements Catalog
  - `ribbons`: User Account Ribbon Rack & Signature Shelf
- **URL Parameter Sync**: `?tab=country` | `?tab=ribbons`

---

## 3. Detailed Component Specification

### 3.1 Tab 1 — Country Achievements (`tab=country`)

- **Profile Header Card**:
  - Country Flag & Name (`EnhancedCountryFlag`).
  - Animated Master Completion Ring & Progress Bar (`NumberFlow`).
  - Key Metrics: `Achievements Unlocked`, `Gameplay Points (pts)`, and direct link to `Global Leaderboards (/leaderboards)`.
- **Filter Toolbar**:
  - Category Pills: `All`, `Economic`, `Diplomatic`, `Military`, `Governance`.
  - Rarity Filter: `All`, `Core`, `Rare`, `Epic`, `Legendary`.
  - Search Input with clear button.
  - View Toggle: Grid View (Steam Badges style) vs. List View (Detailed rows).
- **Achievement Cards / Rows**:
  - **List View**: Horizontal rows with status indicator bar, icon badge, rarity tag, secret reveal eye toggle, points chip (`+50 pts`), and unlock date.
  - **Grid View**: Frosted glass cards (`bg-slate-950/70 backdrop-blur-2xl`) with hover tilt physics, icon pedestal, points chip, and description.

### 3.2 Tab 2 — User Account Ribbons (`tab=ribbons`)

- **Profile Header Card**:
  - User Avatar & Username.
  - Account Tenure Pill (*"Platform Veteran • Member since 2024"*).
  - Total Ribbons Counter (`3 / 5 Ribbons Granted`).
  - Link to `WikiOS Lorewards (/wiki/lorewards)`.
- **Pinned Signature Shelf**:
  - Interactive 3-slot shelf allowing users to pin up to 3 ribbons to feature on their public profile badge across IxStates.
- **Community Honor Ribbon Rack**:
  - High-density ribbon rack featuring OOC ribbons (*WikiOS Archivist*, *Forum Pioneer*, *Master Cartographer*, *Platform Veteran*, *Canon Historian*).
  - Built with silk moiré stripe patterns, gold foil borders, active press feedback, and decree tooltips.

---

## 4. Technical Requirements & Verification

- **Package Manager**: `bun`
- **Styling**: Tailwind CSS v4, Motion (Framer Motion) springs (`stiffness: 350, damping: 25`), Facet design system tokens, `TextureOverlay`.
- **Hydration Safety**: Mount check (`isMounted`) gating client-side storage & profile reads to prevent SSR hydration mismatches.
- **Typecheck Commands**: `bun run typecheck:ui`
