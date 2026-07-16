# Spec: Sidebar Story Feed Integration (Overview News Feed Redesign)

Refine and replace the existing flat news log inside the Overview Sidebar with the rich chronological **story card timeline** from the labs preview, adopting the **Facet Design System**.

## User Review Required

> [!IMPORTANT]
> The rich story feed replaces the default `SectionContextWidget` layout in [OverviewSidebarWidget.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/sidebar-widgets/OverviewSidebarWidget.tsx). The stats header remains visible, but is styled with premium glass indicators.

## Proposed Changes

### 1. Overview Sidebar Redesign
Modify [OverviewSidebarWidget.tsx](file:///home/jxsig/projects/ixstats/src/components/mycountry/sidebar-widgets/OverviewSidebarWidget.tsx):
- Remove `SectionContextWidget` render block.
- Render a custom flex grid representing:
  - **Quick Stats Block**: High-contrast glass status cells showing active policies, embassies, and parties.
  - **Scrollable Feed**: A scrollable vertical column of `FacetCard` items (`depth={2}`) fetching data from `api.mycountry.getCanonFeed`.
- **Feed Card Visual Spec**:
  - Gradient badge icon and styled glyph matching source channels:
    - `"decision"` -> Government channel (amber gradient, `◉` glyph)
    - `"diplomacy"` -> World channel (purple gradient, `◇` glyph)
    - Defaults -> Press channel (slate gradient, `▦` glyph)
  - Relative time ago calculations (`fmtTime` helper).
  - Headline titles displayed in clean 11px font sizes with appropriate spacing.

---

## Verification Plan

### Automated Checks
- Run ESLint to ensure no syntax, formatting, or unused import errors:
  ```bash
  npx eslint src/components/mycountry/sidebar-widgets/OverviewSidebarWidget.tsx
  ```

### Manual Verification
1. Navigate to `/mycountry/v2`.
2. Inspect the left/right sidebar layout: verify the stats block is rendered with glass indicators.
3. Verify the scrollable **News Feed** items display with custom gradient icons (Government, World, Press), relative times (e.g. `Xm ago`), and full headline titles inside Facet cards.
