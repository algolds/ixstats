# Dashboard Vitality Rings (National Health) Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate interactive vitality rings (National Health) into the Dashboard Hero Overview snapshot.

**Architecture:** Fetch the rings data dynamically via `getActivityRingsData` and render 4 interactive `HealthRing` instances in a grid row under Overview. Dynamic modals are dynamically imported to avoid chunk weight.

**Tech Stack:** React 19, Next.js 16, tRPC, Framer Motion

## Global Constraints
* Do not run typecheck commands during execution.
* Package manager is `bun` (never npm/yarn/pnpm).

---

### Task 1: Wire Up Vitality Query & Modals in Dashboard Router

**Files:**
* Modify: [DashboardRouter.tsx](file:///ixwiki/public/projects/ixstats/src/components/dashboard/DashboardRouter.tsx)

**Interfaces:**
* Consumes: `api.countries.getActivityRingsData` query, `HealthRing` component.
* Produces: Interactive modal rendering states and state trigger handlers.

- [ ] **Step 1: Add dynamic imports for the details modals**
  Add the following imports at the top of the file around line 88:
  ```tsx
  const GdpDetailsModal = dynamic(
    () => import("~/components/modals/GdpDetailsModal").then((m) => ({ default: m.GdpDetailsModal })),
    { ssr: false }
  );

  const PopulationDetailsModal = dynamic(
    () => import("~/components/modals/PopulationDetailsModal").then((m) => ({ default: m.PopulationDetailsModal })),
    { ssr: false }
  );

  const GovernmentSpendingModal = dynamic(
    () => import("~/components/modals/metric-details/GovernmentSpendingModal").then((m) => ({ default: m.GovernmentSpendingModal })),
    { ssr: false }
  );
  ```

- [ ] **Step 2: Import HealthRing and PreText**
  Import them from their locations around line 54:
  ```tsx
  import { HealthRing } from "~/components/ui/health-ring";
  import { PreText } from "~/components/ui/pretext";
  ```

- [ ] **Step 3: Define active modal state**
  Inside the `DashboardHero` component, around line 234:
  ```tsx
  const [activeModal, setActiveModal] = useState<"gdp" | "population" | "government" | null>(null);
  ```

- [ ] **Step 4: Fetch Activity Rings data**
  Around line 249, fetch the rings data:
  ```tsx
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  ```

- [ ] **Step 5: Define color and label CSS helpers**
  Before `renderOverviewSnapshot` or at module level, add the helpers:
  ```tsx
  const getMetricColor = (val: number) => {
    if (val < 35) return "#ef4444";
    if (val < 60) return "#f97316";
    if (val < 80) return "#eab308";
    return "#10b981";
  };

  const getMetricLabelClass = (val: number) => {
    if (val < 35) return "text-red-600 dark:text-red-400";
    if (val < 60) return "text-orange-600 dark:text-orange-400";
    if (val < 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };
  ```

- [ ] **Step 6: Update `renderOverviewSnapshot` with vitality rings row**
  Replace lines 511-538 in `DashboardRouter.tsx` with:
  ```tsx
  <DetailList title="National Health">
    {activityRingsData ? (
      <div className="grid grid-cols-4 gap-2 py-1">
        {[
          {
            value: activityRingsData.economicVitality || 0,
            label: "Economy",
            onClick: () => setActiveModal("gdp"),
            tooltip: "Economic health and performance index",
          },
          {
            value: activityRingsData.populationWellbeing || 0,
            label: "Pop.",
            onClick: () => setActiveModal("population"),
            tooltip: "Quality of life and population wellbeing index",
          },
          {
            value: activityRingsData.diplomaticStanding || 0,
            label: "Diplo.",
            onClick: () => setActiveSection("Diplomacy"),
            tooltip: "International relations and diplomatic standing index",
          },
          {
            value: activityRingsData.governmentalEfficiency || 0,
            label: "Gov.",
            onClick: () => setActiveModal("government"),
            tooltip: "Governance effectiveness and efficiency index",
          },
        ].map((ring) => (
          <div key={ring.label} className="flex flex-col items-center gap-0.5">
            <HealthRing
              value={ring.value}
              size={48}
              color={getMetricColor(ring.value)}
              label={ring.label}
              tooltip={ring.tooltip}
              hideValue={true}
              onClick={ring.onClick}
              isClickable={true}
            />
            <PreText
              className={cn("text-[9px] font-medium transition-colors hover:text-foreground/90", getMetricLabelClass(ring.value))}
              whiteSpace="nowrap"
            >
              {ring.label}: {ring.value}%
            </PreText>
          </div>
        ))}
      </div>
    ) : (
      <div className="h-16 flex items-center justify-center text-xs text-muted-foreground animate-pulse">
        Loading health indicators...
      </div>
    )}
  </DetailList>
  ```

- [ ] **Step 7: Render details modals at bottom of DashboardHero**
  At the end of the `DashboardHero` JSX return block (just before the final outer `</div>` closing tag):
  ```tsx
  {activeModal === "gdp" && (
    <GdpDetailsModal
      isOpen={true}
      onClose={() => setActiveModal(null)}
      countryId={countryId}
      countryName={stats.countryName}
    />
  )}
  {activeModal === "population" && (
    <PopulationDetailsModal
      isOpen={true}
      onClose={() => setActiveModal(null)}
      countryId={countryId}
      countryName={stats.countryName}
    />
  )}
  {activeModal === "government" && (
    <GovernmentSpendingModal
      isOpen={true}
      onClose={() => setActiveModal(null)}
      countryId={countryId}
      countryName={stats.countryName}
    />
  )}
  ```

- [ ] **Step 8: Run check to verify build**
  Run: `bun run build`
  Expected: Production build passes successfully without errors.
