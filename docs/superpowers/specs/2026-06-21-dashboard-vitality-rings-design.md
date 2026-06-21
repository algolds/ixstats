# Dashboard Vitality Rings Integration — "National Health" Design Spec

Replace the "Momentum & Standing" vertical list in the Dashboard Hero Overview snapshot with a row of interactive vitality rings representing the nation's core health metrics.

## Proposed Changes

### Dashboard Hero Component
#### [MODIFY] [DashboardRouter.tsx](file:///ixwiki/public/projects/ixstats/src/components/dashboard/DashboardRouter.tsx)
* Import `HealthRing` from `~/components/ui/health-ring`.
* Import dynamic-modal components dynamically:
  * `GdpDetailsModal` from `~/components/modals/GdpDetailsModal`
  * `PopulationDetailsModal` from `~/components/modals/PopulationDetailsModal`
  * `GovernmentSpendingModal` from `~/components/modals/metric-details/GovernmentSpendingModal`
* Wire up `api.countries.getActivityRingsData.useQuery({ countryId })` to load the four national health metrics (Economy, Population, Diplomacy, Government).
* Replace `DetailList` with title "Momentum & Standing" with a new `DetailList` titled **"National Health"**.
* Implement a 4-column grid row inside "National Health" displaying:
  * **Economy**: values from `activityRingsData.economicVitality`.
  * **Pop.**: values from `activityRingsData.populationWellbeing`.
  * **Diplo.**: values from `activityRingsData.diplomaticStanding`.
  * **Gov.**: values from `activityRingsData.governmentalEfficiency`.
* Render each ring with:
  * `size={48}`
  * `hideValue={true}`
  * Hover tooltip with detailed stats or name.
  * Interactivity: clicking:
    * **Economy** -> triggers `setActiveModal("gdp")`
    * **Pop.** -> triggers `setActiveModal("population")`
    * **Diplo.** -> triggers `setActiveSection("Diplomacy")` (Dashboard Hero tab switch)
    * **Gov.** -> triggers `setActiveModal("government")`
* Render the dynamically-loaded modals at the root of `DashboardRouter`'s return statement.

## Color & Label Classes
Reuse helper functions for coloring the rings and their labels:
* `getMetricColor(val)`:
  * `< 35`: `#ef4444` (Red)
  * `< 60`: `#f97316` (Orange)
  * `< 80`: `#eab308` (Yellow)
  * `Default`: `#10b981` (Green)
* `getMetricLabelClass(val)`:
  * `< 35`: `text-red-600 dark:text-red-400`
  * `< 60`: `text-orange-600 dark:text-orange-400`
  * `< 80`: `text-yellow-600 dark:text-yellow-400`
  * `Default`: `text-green-600 dark:text-green-400`

## Verification Plan
### Automated Tests
* Validate compile state: `bun run build`

### Manual Verification
* Access the main dashboard hero page at `/dashboard`.
* Verify that the "National Health" section shows 4 animated health rings.
* Hover over the rings and confirm hover states and labels with percentages.
* Click each ring and verify the respective actions:
  * Economy -> GdpDetailsModal opens.
  * Pop. -> PopulationDetailsModal opens.
  * Diplo. -> switches current active tab to Diplomacy.
  * Gov. -> GovernmentSpendingModal opens.
