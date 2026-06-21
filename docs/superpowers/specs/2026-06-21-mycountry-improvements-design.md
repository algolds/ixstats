# MyCountry & Platform Improvements Design Spec

This spec outlines the design and architecture for six improvements and bug fixes across MyCountry Editor, Builder Notch, Countries Page, Map Hero, and Diplomacy.

## 1. National Identity Editor Default Tab
- **Goal:** In edit mode, National Identity defaults to the "Basic Info" tab (`basic`) instead of "Archetype/Preset" (`archetype`), since presets are primarily for creation.
- **Files to Modify:**
  - `src/app/builder/hooks/useBuilderState.ts`: Default `activeIdentitySubTab` to `"basic"` instead of `"archetype"` when `mode === "edit"`.
  - `src/app/builder/components/BuilderRouter.tsx`: Ensure fallback for `activeIdentitySubTab` is `"basic"` when `mode === "edit"`.

## 2. Builder Notch Reverse Scroll Animation
- **Goal:** Hide the builder notch when scrolling down, but animate it up from the bottom as a footer notch when the user hits the exact bottom of the page.
- **Files to Modify:**
  - `src/app/builder/components/BuilderNotchBar.tsx`:
    - Add state variable `isAtBottomState` to track if the user has scrolled to the bottom.
    - Update `handleScroll` to detect page bottom (`window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 15`).
    - If at bottom, set `isAtBottomState(true)`, clear translation/fade-out styles on `containerRef`, and enable pointer events.
    - Conditionally position `motion.div` as `fixed bottom-[20px] left-0 right-0` and animate it up from `y: 80` (slide-in from bottom) when `isAtBottomState` is true.

## 3. Tab to Search on Countries Page
- **Goal:** Restore the "Press Tab to search & filter" header on the `/countries` page and wire it to toggle the Dynamic Island countries search plugin.
- **Files to Modify:**
  - `src/app/countries/_components/CountriesPageModular.tsx`: Mount `CountriesHeader` right above `CountriesStats` and pass an `onOpenCommandPalette` callback that dispatches the `ix:switch-di-mode` custom event with detail `{ mode: "plugin:countries" }`.

## 4. Map Hero Region Borders
- **Goal:** Render region/subdivision borders in the map hero widget.
- **Files to Modify:**
  - `src/components/dashboard/DashboardRouter.tsx`: Set `showSubdivisions={true}` on `CountryMapEmbed` in `DashboardHero`.
  - `src/components/mycountry/OverviewHero.tsx`: Set `showSubdivisions={true}` on `CountryMapEmbed` in `OverviewHero`.

## 5. Setup Checklist Armed Forces Text Replacement
- **Goal:** Remove the "Armed Forces" phrasing from MyCountry's "Get Started" checklist and replace it with a national defense/security theme.
- **Files to Modify:**
  - `src/components/mycountry/SetupChecklist.tsx`: Update the `"military"` checklist item:
    - Change `label` from `"Build your armed forces"` to `"Develop national defense"`.
    - Change `hint` from `"Stand up a military branch to secure your nation."` to `"Establish defense branches to secure your borders."`.
    - Change `cta` from `"Build"` to `"Develop"`.

## 6. Diplomacy Embassy Count & Relations Synchronization
- **Goal:** Count active embassies as diplomatic relations in the UI statistics boxes if no explicit `DiplomaticRelation` DB record exists yet, avoiding a "0 relations" display when active embassies exist.
- **Files to Modify:**
  - `src/components/diplomacy/DiplomacyOverview.tsx`
  - `src/components/diplomacy/EmbassiesAndRelationsPanel.tsx`
  - `src/components/mycountry/sidebar-widgets/DiplomacySidebarWidget.tsx`
  - `src/components/mycountry/PillarCards.tsx`
  - **Adjustment:** In all four components, compute `totalRelations` by checking for active embassies and including their partner countries if they are not already present in the relationships array.
