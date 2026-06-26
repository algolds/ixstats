# Plan 044: Nest the Labor tab under Economy with an internal toggle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/mycountry/tabs src/components/mycountry/MyCountryTabSystem.tsx src/hooks/useMyCountryNavigation.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (UX / information architecture)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

The MyCountry Overview page currently has five top-level tabs (At a Glance,
Economy, Labor, Government, Geography). Economy and Labor are structurally
identical (each = 3 toggle metric cards + 3 collapsible "dossier" sections),
share the **same** `economyData` source, and Labor is conceptually a part of
economics. The decision (confirmed by the product owner) is to drop the
top-level Labor tab and reach Labor through an internal segmented toggle
*inside* the Economy tab. This reduces top-level tabs from 5 → 4 while keeping
each sub-view's distinct content and its green (economy) / red (labor) color
identity — and avoids merging both into one over-long scroll.

## Current state

Files involved:

- `src/components/mycountry/tabs/MyCountryTabsList.tsx` — the top tab strip. Has
  five entries (`overview`, `economy`, `labor`, `government`, `geography`),
  each a `FacetTabs` item object. The `labor` entry must be removed.
- `src/components/mycountry/MyCountryTabSystem.tsx` — orchestrator. Has
  `@ts-nocheck` at the top (so `tsc` will NOT type-check this file — be careful,
  there is no type safety net here). Renders a `<TabsContent value="economy">`
  and a separate `<TabsContent value="labor">`. The labor `TabsContent` must be
  removed and the economy one must render the new wrapper.
- `src/components/mycountry/tabs/EconomyTab.tsx` and
  `src/components/mycountry/tabs/LaborTab.tsx` — the two sub-views. **Do not edit
  their internals.** Both export a component with the *identical* prop shape
  (verified):
  ```ts
  {
    country: any;
    economyData: any;
    countryImageData: any;
    setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
    openMetricModalAction: (metricType: MetricType, countryId: string) => void;
    metricView: any;
    setMetricViewAction: React.Dispatch<React.SetStateAction<any>>;
  }
  ```
- `src/components/mycountry/tabs/index.ts` — barrel export for the tabs folder.
- `src/hooks/useMyCountryNavigation.ts` — owns `activeTab`, hash sync
  (`#economy`, `#labor`, …), and the slide-direction `TAB_ORDER`/`VALID_TABS`
  arrays. `#labor` deep links currently select the (soon-removed) Labor tab and
  must be redirected to Economy so old links don't break.

Relevant excerpt — `MyCountryTabSystem.tsx` (the two `TabsContent` blocks today):

```tsx
{/* Economy Tab */}
<TabsContent value="economy" className="space-y-4" id="economy">
  <EconomyTab
    country={country}
    economyData={economyData}
    countryImageData={countryImageData}
    setImageUploadModalAction={setImageUploadModal}
    openMetricModalAction={openMetricModal}
    metricView={metricView}
    setMetricViewAction={setMetricView}
  />
</TabsContent>

{/* Labor Tab */}
<TabsContent value="labor" id="labor">
  <LaborTab
    country={country}
    economyData={economyData}
    countryImageData={countryImageData}
    setImageUploadModalAction={setImageUploadModal}
    openMetricModalAction={openMetricModal}
    metricView={metricView}
    setMetricViewAction={setMetricView}
  />
</TabsContent>
```

Its imports (top of the same file):

```tsx
import {
  MyCountryTabsList,
  OverviewTab,
  EconomyTab,
  LaborTab,
  GovernmentTab,
  GeographyTab,
} from "./tabs";
```

Relevant excerpt — `MyCountryTabsList.tsx` (the labor entry to remove, lines ~63–80):

```tsx
{
  id: "labor",
  icon: Briefcase,
  label: (
    <>
      <span className="hidden sm:inline">Labor</span>
      <span className="sm:hidden">Lab</span>
    </>
  ),
  badge: 0,
  activeIndicatorClassName:
    "bg-[var(--tab-labor-bg)] border-[var(--tab-labor-primary)]/30 text-[var(--tab-labor-primary)]",
  activeTextClassName: "text-[var(--tab-labor-primary)] dark:text-[var(--tab-labor-accent)]",
  activeIconClassName: "text-[var(--tab-labor-icon)] dark:text-[var(--tab-labor-accent)]",
  glowClassName: "bg-[var(--tab-labor-primary)]/20",
},
```

Relevant excerpt — `useMyCountryNavigation.ts`:

```ts
const TAB_ORDER = ["overview","economy","labor","government","geography","demographics","analytics"];
const VALID_TABS = ["overview","economy","labor","government","geography","demographics","analytics"];
// ...
const handleHashChange = () => {
  const hash = window.location.hash.replace("#", "");
  if (hash && VALID_TABS.includes(hash)) {
    setActiveTab(hash);
  }
};
```

### Conventions to follow

- The internal toggle reuses the existing **`FacetTabs`** component (the same one
  the top strip uses), imported from `~/components/facet-ui`. Its props:
  `tabs` (array of items), `activeTab: string`, `onChange: (value: string) => void`,
  `tone`, `size`, `className`. A `FacetTabs` tab item has this shape (copy the
  field names exactly — taken from `MyCountryTabsList.tsx`):
  `{ id, icon, label, badge, activeIndicatorClassName, activeTextClassName, activeIconClassName, glowClassName }`.
- Reuse the **exact** economy/labor color class strings from
  `MyCountryTabsList.tsx` so the toggle keeps the green/red identity.
- Icons: economy uses `TrendingUp`, labor uses `Briefcase` (both from
  `lucide-react`), matching the current top strip.
- New `"use client"` components start with the `"use client";` directive (see any
  file in `src/components/mycountry/tabs/`).

## Commands you will need

| Purpose            | Command                                                                 | Expected on success        |
|--------------------|-------------------------------------------------------------------------|----------------------------|
| Typecheck new file | `bun run typecheck:file src/components/mycountry/tabs/EconomyLaborTab.tsx` | exit 0, no errors          |
| Typecheck UI       | `bun run typecheck:ui`                                                   | exit 0, no errors          |
| Lint               | `bun run lint`                                                          | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check` — per
repo rules they can crash the server.

> If `bun run typecheck:ui` errors because `tsconfig.ui.json` is missing (it is
> untracked, so it won't exist in a fresh git worktree), fall back to
> `bun run typecheck:file <path>` on each of the in-scope `.tsx`/`.ts` files
> instead.

## Scope

**In scope** (the only files you may modify or create):
- `src/components/mycountry/tabs/EconomyLaborTab.tsx` (create)
- `src/components/mycountry/tabs/index.ts` (add one export)
- `src/components/mycountry/MyCountryTabSystem.tsx` (swap economy content, remove labor block + import)
- `src/components/mycountry/tabs/MyCountryTabsList.tsx` (remove labor entry)
- `src/hooks/useMyCountryNavigation.ts` (redirect `#labor` → economy)

**Out of scope** (do NOT touch, even though they look related):
- `src/components/mycountry/tabs/EconomyTab.tsx` and `LaborTab.tsx` — their
  internals stay exactly as-is; the wrapper only renders them.
- The `builder` economy/labor tabs (`src/app/builder/**`) — a *separate* feature
  that also uses a `"labor"` id. Unrelated; leave alone.
- The metric-detail modals in `MyCountryTabSystem.tsx` (`LaborDetailsModal`
  etc.) — they key off `metricType`, not the tab, and keep working unchanged.

## Git workflow

- Branch: `advisor/001-nest-labor-under-economy` off the current branch (`v2`).
- Commit style — conventional commits (matches `git log`, e.g.
  `feat(politics): add cabinet panel...`). Suggested message:
  `refactor(mycountry): nest Labor sub-view inside Economy tab`.
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Create the EconomyLaborTab wrapper

Create `src/components/mycountry/tabs/EconomyLaborTab.tsx`. It renders a
two-item `FacetTabs` toggle (Economy / Labor) and below it the active sub-view,
forwarding the identical prop bag to whichever sub-tab is selected. It seeds the
initial sub-view from the URL hash so `#labor` deep links land on the Labor
sub-view.

```tsx
"use client";

import React from "react";
import { TrendingUp, Briefcase } from "lucide-react";
import { FacetTabs } from "~/components/facet-ui";
import { EconomyTab } from "./EconomyTab";
import { LaborTab } from "./LaborTab";
import type { CardImageType } from "../primitives";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

type SubTab = "economy" | "labor";

interface EconomyLaborTabProps {
  country: any;
  economyData: any;
  countryImageData: any;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: any;
  setMetricViewAction: React.Dispatch<React.SetStateAction<any>>;
}

/**
 * EconomyLaborTab — wraps the Economy and Labor sub-views behind an internal
 * segmented toggle. Replaces the former top-level "Labor" tab; both sub-views
 * share the same props and `economyData`. Initial sub-view is seeded from the
 * URL hash (`#labor` opens Labor) so old deep links still resolve.
 */
export function EconomyLaborTab(props: EconomyLaborTabProps) {
  const [subTab, setSubTab] = React.useState<SubTab>(() => {
    if (typeof window !== "undefined" && window.location.hash.replace("#", "") === "labor") {
      return "labor";
    }
    return "economy";
  });

  const handleChange = (value: string) => {
    const next: SubTab = value === "labor" ? "labor" : "economy";
    setSubTab(next);
    // Keep the hash shareable without triggering a full tab change.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#" + next);
    }
  };

  const tabs = [
    {
      id: "economy",
      icon: TrendingUp,
      label: "Economy",
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-economy-bg)] border-[var(--tab-economy-primary)]/30 text-[var(--tab-economy-primary)]",
      activeTextClassName:
        "text-[var(--tab-economy-primary)] dark:text-[var(--tab-economy-accent)]",
      activeIconClassName: "text-[var(--tab-economy-icon)] dark:text-[var(--tab-economy-accent)]",
      glowClassName: "bg-[var(--tab-economy-primary)]/20",
    },
    {
      id: "labor",
      icon: Briefcase,
      label: "Labor",
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-labor-bg)] border-[var(--tab-labor-primary)]/30 text-[var(--tab-labor-primary)]",
      activeTextClassName: "text-[var(--tab-labor-primary)] dark:text-[var(--tab-labor-accent)]",
      activeIconClassName: "text-[var(--tab-labor-icon)] dark:text-[var(--tab-labor-accent)]",
      glowClassName: "bg-[var(--tab-labor-primary)]/20",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto p-0.5">
        <FacetTabs
          tabs={tabs}
          activeTab={subTab}
          onChange={handleChange}
          tone="mycountry"
          size="sm"
          className="facet-surface facet-refraction w-full min-w-fit rounded-xl border border-white/5 p-1 sm:w-auto"
        />
      </div>

      {subTab === "economy" ? <EconomyTab {...props} /> : <LaborTab {...props} />}
    </div>
  );
}
```

Notes:
- If the `CardImageType` or `MetricType` import paths fail to resolve, confirm
  them against the imports at the top of `EconomyTab.tsx` (it imports
  `CardImageType` from `../primitives` and `MetricType` from
  `~/hooks/useMetricDetailsModal`) and match exactly.
- `size="sm"` keeps the inner toggle visually subordinate to the top strip
  (which is `size="md"`). If `"sm"` is not an accepted size, use `"md"`.

**Verify**: `bun run typecheck:file src/components/mycountry/tabs/EconomyLaborTab.tsx` → exit 0, no errors.

### Step 2: Export the wrapper from the tabs barrel

In `src/components/mycountry/tabs/index.ts`, add the export line. Place it after
the `EconomyTab`/`LaborTab` exports:

```ts
export { EconomyLaborTab } from "./EconomyLaborTab";
```

**Verify**: `grep -n "EconomyLaborTab" src/components/mycountry/tabs/index.ts` → one match.

### Step 3: Wire the wrapper into the tab system; remove the Labor TabsContent

In `src/components/mycountry/MyCountryTabSystem.tsx`:

1. Update the import block to import `EconomyLaborTab` and stop importing the
   now-indirect `EconomyTab` and `LaborTab`:
   ```tsx
   import {
     MyCountryTabsList,
     OverviewTab,
     EconomyLaborTab,
     GovernmentTab,
     GeographyTab,
   } from "./tabs";
   ```
2. Replace the **Economy** `TabsContent` body so it renders `EconomyLaborTab`
   (same props as before):
   ```tsx
   {/* Economy Tab (with internal Economy/Labor toggle) */}
   <TabsContent value="economy" className="space-y-4" id="economy">
     <EconomyLaborTab
       country={country}
       economyData={economyData}
       countryImageData={countryImageData}
       setImageUploadModalAction={setImageUploadModal}
       openMetricModalAction={openMetricModal}
       metricView={metricView}
       setMetricViewAction={setMetricView}
     />
   </TabsContent>
   ```
3. **Delete** the entire `{/* Labor Tab */}` `<TabsContent value="labor"> … </TabsContent>`
   block.

Note: this file has `// @ts-nocheck`, so `typecheck:ui` will not flag mistakes
here — read your edit carefully.

**Verify**:
- `grep -c "TabsContent value=\"labor\"" src/components/mycountry/MyCountryTabSystem.tsx` → `0`
- `grep -c "EconomyLaborTab" src/components/mycountry/MyCountryTabSystem.tsx` → `2` (import + usage)

### Step 4: Remove the Labor entry from the top tab strip

In `src/components/mycountry/tabs/MyCountryTabsList.tsx`, delete the `labor` tab
object (the block shown in "Current state"). After this, the `tabs` array has
four entries in order: `overview`, `economy`, `government`, `geography`.

The `Briefcase` icon import becomes unused — remove `Briefcase` from the
`lucide-react` import line to avoid a lint warning (leave `BarChart3, TrendingUp,
Building, MapPin`).

**Verify**:
- `grep -c "id: \"labor\"" src/components/mycountry/tabs/MyCountryTabsList.tsx` → `0`
- `grep -c "Briefcase" src/components/mycountry/tabs/MyCountryTabsList.tsx` → `0`

### Step 5: Redirect `#labor` deep links to the Economy tab

In `src/hooks/useMyCountryNavigation.ts`, make `#labor` resolve to the economy
tab (the `EconomyLaborTab` wrapper then auto-selects the Labor sub-view from the
same hash — see Step 1). Update `handleHashChange` to alias `labor` → `economy`:

```ts
const handleHashChange = () => {
  let hash = window.location.hash.replace("#", "");
  if (hash === "labor") hash = "economy"; // Labor is now a sub-view of Economy
  if (hash && VALID_TABS.includes(hash)) {
    setActiveTab(hash);
  }
};
```

Leave the `TAB_ORDER` and `VALID_TABS` arrays as-is (keeping `"labor"` in them is
harmless and avoids index churn in the slide-direction math). Do not remove
`"labor"` from those arrays.

**Verify**: `grep -n "Labor is now a sub-view" src/hooks/useMyCountryNavigation.ts` → one match.

### Step 6: Full UI typecheck + lint

**Verify**:
- `bun run typecheck:ui` → exit 0, no errors.
- `bun run lint` → exit 0 (pre-existing warnings elsewhere are acceptable; there
  must be **no new** errors mentioning the five in-scope files).

## Test plan

This is a UI/IA change with no existing test harness for these components
(no `*.test.tsx` under `src/components/mycountry/`). Do **not** scaffold a new
test framework. Verification is the typecheck + lint gates above plus a manual
visual check:

- Manual (non-blocking, do if a dev server is available): `bun run dev`, open
  `/mycountry`, confirm the top strip shows **four** tabs (At a Glance, Economy,
  Government, Geography); the Economy tab shows an Economy/Labor toggle; toggling
  shows the correct sub-view with green vs. red accents; visiting
  `/mycountry#labor` opens the Economy tab with the Labor sub-view active.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck:file src/components/mycountry/tabs/EconomyLaborTab.tsx` exits 0
- [ ] `bun run typecheck:ui` exits 0
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -rc "id: \"labor\"" src/components/mycountry/tabs/MyCountryTabsList.tsx` → `0`
- [ ] `grep -c "TabsContent value=\"labor\"" src/components/mycountry/MyCountryTabSystem.tsx` → `0`
- [ ] `git status --porcelain` shows only the five in-scope paths modified/created
- [ ] `plans/README.md` status row for 044 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since this plan
  was written) — especially if `EconomyTab` and `LaborTab` no longer share the
  identical prop shape.
- `FacetTabs` does not accept the `tabs` item fields used here, or its props
  differ from `{ tabs, activeTab, onChange, tone, size, className }`.
- A verification command fails twice after a reasonable fix attempt.
- Removing the Labor tab appears to break a navigation link elsewhere that you
  cannot redirect with the Step 5 alias (search `grep -rn '#labor\|"labor"' src`
  before concluding this).

## Maintenance notes

For whoever owns this next:

- If a future change re-adds Labor as its own top-level tab, reverse Steps 3–5
  and delete `EconomyLaborTab.tsx`.
- The `#labor` alias in `useMyCountryNavigation.ts` is the only thing keeping old
  deep links alive — keep it until you're sure nothing links to `#labor`.
- A reviewer should confirm the green/red color identity survives in the inner
  toggle (the `--tab-economy-*` / `--tab-labor-*` CSS vars) and that the
  `MyCountryTabSystem.tsx` `@ts-nocheck` didn't hide a prop typo (read the diff,
  don't trust the typechecker for that file).
- Deferred out of scope: persisting the chosen sub-view across full page
  navigations beyond the hash (not requested).
