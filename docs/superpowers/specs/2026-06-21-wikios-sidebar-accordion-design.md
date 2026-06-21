# Design Document: WikiOS Sidebar Accordion Expansion & Tooltip Removal

## Purpose
This change improves the user experience and visual flow of the collapsible WikiOS rail sidebar. We are:
1. Removing the custom text hover tooltips when the sidebar is collapsed (keeps the UI cleaner).
2. Implementing an "accordion-like" cascading wave expansion where the hovered icon row expands its text label instantly, and neighbor rows expand their labels with a staggered delay based on their distance from the hovered row.
3. Removing the 250ms hover delay for the rail variant, making the sidebar expansion trigger instantly on hover.

---

## Technical Details

### 1. Removing Hover Tooltips
* **File:** `src/components/wiki-os/shared/WikiOSUnifiedSidebar.tsx`
* **Changes:** Delete the `AnimatePresence` and `motion.div` tooltip block inside the `FisheyeIcon` component.

### 2. Instant Hover Response
* **File:** `src/components/dashboard/sidebar/DashboardSidebarLayout.tsx`
* **Changes:**
  * Update the hover delay `useEffect` to bypass the 250ms timer if `variant === "rail"`.
  * If `variant === "rail"`, set `isHoveredDelayed` instantly to `isHovered` without any setTimeout.

### 3. Cascading Wave (Accordion) Expansion
* **File:** `src/components/wiki-os/shared/WikiOSUnifiedSidebar.tsx`
* **Changes:**
  * Track `hoveredIndex` state inside `WikiOSUnifiedSidebar` (`useState<number | null>(null)`).
  * Assign sequential `index` numbers to each row (0 for profile, 1 for search, 2-4 for nav group, 5-7 for library/tools, etc.).
  * On mouse enter of each row wrapper, trigger `setHoveredIndex(index)`. On mouse leave of the entire sidebar container, trigger `setHoveredIndex(null)`.
  * In the row text label (`span`), calculate a dynamic transition style:
    * When expanded: `transitionDuration: "300ms"`, `transitionDelay: Math.abs(index - hoveredIndex) * 45 + "ms"`.
    * When collapsed: `transitionDuration: "150ms"`, `transitionDelay: "0ms"`.
  * This creates a cascading propagation animation starting from the hovered row outward to all other rows!
