# Spec: Metric Modals Facet UI Layout Redesign

**Date**: June 21, 2026  
**Status**: Pending Review  
**Topic**: Complete redesign of the core national and metric details modals layout utilizing Facet UI asymmetric grids, dynamic color-themed styles, and custom glass charts.

---

## 1. Problem Statement & Goals

The metric details modals currently render simple grids and standard cards. To elevate the user experience to the **Facet UI** standard (premium glass physics, clear content hierarchy, and dynamic micro-animations), we need to:
- Move from symmetrical grids to a responsive, asymmetric **Split Content Grid** (2/3 width main content area, 1/3 width key-summary side panel).
- Replace plain cards with a unified, reusable layout system (`MetricModalLayout.tsx`) that enforces proper nested card sheens and borders.
- Add dynamic metric-specific color-theming (Gold for Economy, Blue/Teal for Social/Demographics/Labor, etc.) mapped directly to active tab items and chart lines.
- Redesign historical line and area charts with curved volumetric gradient fills and custom glass tooltips.

---

## 2. Architecture & Components

We will introduce a new reusable layout component [MetricModalLayout.tsx](file:///ixwiki/public/projects/ixstats/src/components/modals/metric-details/MetricModalLayout.tsx) that exports:

### 2.1 Reusable Layout Components
- **`MetricModalLayout`**: The main container component. Takes a `variant` prop (`"economy" | "social" | "demographics" | "labor" | "default"`) and wraps children in a responsive grid container (`grid grid-cols-1 lg:grid-cols-3 gap-6`).
- **`MetricModalLayout.MainArea`**: Takes `lg:col-span-2`. Styled with a deep glass depth to present primary charts, tables, and comparative graphs.
- **`MetricModalLayout.Sidebar`**: Takes `lg:col-span-1`. Styled with a secondary glass outline card, ideal for quick summary cards, wiki descriptions, and recommendations.
- **`MetricModalLayout.StatCard`**: Renders individual stats. Features:
  - An icon aligned to the theme color.
  - A label and numeric value using `<NumberFlowDisplay>`.
  - A small, clean micro-trend badge (showing positive/negative percentage change with a color-coded indicator).
- **`MetricModalLayout.Chart`**: An abstraction for Recharts that pre-configures:
  - A `<linearGradient>` with the specific theme colors fading from `0.2` opacity to `0`.
  - Thin, semi-transparent Cartesian grid lines (`rgba(255, 255, 255, 0.03)`).
  - A custom floating glass tooltip component (`facet-floating facet-refraction p-3 rounded-lg border border-white/10`).

---

## 3. Dynamic Color Theming

The `variant` prop maps to specific Tailwind classes and color configurations:

| Variant | Target Modals | Theme Class | Active Tab Highlight | Chart Fill Colors |
|---|---|---|---|---|
| `economy` | GDP, GDP per Capita, Government Spending, Debt | `facet-mycountry` | Gold (`#fbbf24`) | Gold gradient fill |
| `social` | Population, Demographics & Health | `facet-global` | Teal/Cyan (`#06b6d4`) | Cyan/Teal gradient fill |
| `labor` | Labor Details | `facet-global` | Blue/Cyan (`#3b82f6`) | Blue gradient fill |
| `default` | General / fallback | `facet-modal` | Primary highlight | Primary fallback |

---

## 4. Verification Plan

### Manual Verification
1. Run `bun run dev` and trigger each details modal.
2. Confirm the modal renders the horizontal glass tab list at the top and the asymmetric split columns below.
3. Confirm that resizing the browser stacks the columns correctly on mobile/tablet.
4. Verify that hover/focus sheens are visible on cards, and that charts render theme-colored gradients and glass tooltips.
