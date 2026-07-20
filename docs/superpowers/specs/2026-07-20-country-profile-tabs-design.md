# Country Profile Tabs Integration & Alt Profile System Design Spec

**Date:** 2026-07-20  
**Status:** Approved (Approach 1)

## Goal

Modernize the public country profile page by replacing the static inline sections under the **Overview** tab with the interactive, sliding sub-tabs from the `MyCountry` dashboard (Overview, Economy, Government, Geography). We will ensure the components are rendered in a **public read-only** format, and introduce a graceful alternative layout for countries lacking Map or Wiki integrations.

---

## Proposed Architecture

### 1. Public Read-Only Context

We will add a boolean flag `isPublicReadOnly` to the `CountryDataProvider` and its context. When `isPublicReadOnly` is active:
- The provider will bypass logged-in user profile checks (`userProfile`) and country ownership checks.
- It will still fetch the country's public statistics and simulated economic data.
- The context value `isPublicReadOnly` will be accessible to all child components via `useCountryData()`.

### 2. Read-Only Component Adaptation

We will modify the tab components to conditionally hide all interactive settings and modification tools:
- **`MyCountryTabSystem`**:
  - Hides the `CardImageUploadModal` and the premium `UpgradeTeaser`.
- **`EconomyTab`**, **`LaborTab`**, **`GovernmentTab`**:
  - Hides the "Open Editor" buttons that link to `/mycountry/editor`.
  - Sets `showEditButton` to `false` on the background image widgets.
- **`GeographyContent`**:
  - Hides the "Edit" button for cities, subdivisions, and points of interest.
  - Hides the "Populate from Wiki" triggers.
  - Hides the "Rollup settings" modal trigger/button.
  - Hides the `GeoCompliancePanel`.

### 3. Graceful Alt Country Profile System

For countries that lack active map linkages or wiki integrations, the page will dynamically adapt:
- **Missing Wiki (No Lore/Infobox)**:
  - The main Dossier page's **Dossier (Wiki) Tab** will display a premium placeholder alert:
    > **Dossier Pending**
    > There is no active WikiOS database entry for `[Country]`. Under standard diplomatic protocols, a public dossier is generated once a wiki article is initialized.
    > [Create page on WikiOS] (button linking to `/wiki/[slug]`)
- **Missing Map (No Coordinates/Geometry)**:
  - **Sidebar Map**: The `CountryOverviewPanel` will detect if `hasGeometry` is false and hide the Map Card entirely. The Vitality Rings and Recent Activity widgets will scale up to fill the space.
  - **Geography Tab**: The Geography sub-tab will check `!bundle.geometry`. If false, it will disable the `getCountryGeoProfile` query (preventing TRPC console errors) and show a premium placeholder:
    > **Map Integration Required**
    > This nation has not yet established map coordinates. Map feature linkage is required to define cities, subdivisions, and points of interest.

---

## Detailed Component Changes

### Component 1: `CountryDataProvider`
- Add `isPublicReadOnly?: boolean` to the provider props and context type.
- Skip unauthenticated checks and early-returns for `!userProfile` or unassigned countries when `isPublicReadOnly` is true.

### Component 2: `MyCountryTabSystem`
- Disable `UpgradeTeaser` and `CardImageUploadModal` if context has `isPublicReadOnly` active.

### Component 3: `EconomyTab`, `LaborTab`, `GovernmentTab`
- Hide navigation links to `/mycountry/editor` when `isPublicReadOnly` is true.
- Disable custom background image uploads.

### Component 4: `GeographyContent`
- Hide compliance panel, rollup modals, and subdivision/city editor triggers in read-only mode.
- Render "Map Integration Required" card when `!bundle.geometry` and skip calling `getCountryGeoProfile`.

### Component 5: `WikiIntelligenceTab`
- Display "Dossier Pending" banner and a WikiOS page-creation CTA button when active wiki sections are empty.

### Component 6: `CountryOverviewPanel`
- Replace left column contents with the `CountryDataProvider` + `MyCountryTabSystem`.
- Call `useCountryMapEmbed` to detect map geometry presence; hide the map embed card in the right column if geometry is missing.

---

## Verification Plan

### Automated Tests
- Run `bun run test` to verify no regressions in existing components.

### Manual Verification
- View `/countries/[slug]` for a fully-featured country (e.g. Burgundie, Pax). Confirm sub-tabs display, metric toggles work, and no edit controls appear.
- View a test country that has **no geometry** and **no wiki page**. Confirm the map card is hidden, the Dossier tab shows the pending state with a WikiOS button, and the Geography tab shows the linkage warning.
