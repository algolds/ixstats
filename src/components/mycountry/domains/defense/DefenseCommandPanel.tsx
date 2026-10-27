"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Shield,
  Archery as Target,
  Cart,
  Compass,
  FireFlame as Flame,
  Group,
  Community as Users,
} from "iconoir-react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { Skeleton } from "~/components/ui/skeleton";
import { useDefenseOverview } from "~/hooks/useDefenseConsole";
import { RedactedDefenseView } from "~/components/mycountry/domains/defense/RedactedDefenseView";

function PanelSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// Lazy-load heavy panels per active tab
const OverviewPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/OverviewPanel").then((m) => ({
      default: m.OverviewPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const PolicyPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/PolicyPanel").then((m) => ({
      default: m.PolicyPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const BranchesPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/branches/BranchesPanel").then((m) => ({
      default: m.BranchesPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const ProcurementPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/procurement/ProcurementPanel").then((m) => ({
      default: m.ProcurementPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const BorderThreatPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/BorderThreatPanel").then((m) => ({
      default: m.BorderThreatPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const OperationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/OperationsPanel").then((m) => ({
      default: m.OperationsPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

const StabilityPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/StabilityPanel").then((m) => ({
      default: m.StabilityPanel,
    })),
  {
    ssr: false,
    loading: PanelSkeleton,
  }
);

interface DefenseCommandPanelProps {
  countryId: string;
}

const DEFENSE_TABS = [
  "overview",
  "policy",
  "branches",
  "procurement",
  "threats",
  "operations",
  "stability",
] as const;
type DefenseTab = (typeof DEFENSE_TABS)[number];

const isDefenseTab = (value: string | null | undefined): value is DefenseTab =>
  (DEFENSE_TABS as readonly string[]).includes(value ?? "");

const TABS = [
  { id: "overview" as const, label: "Overview", icon: Shield },
  { id: "policy" as const, label: "Budget and posture", icon: Compass },
  { id: "branches" as const, label: "Branches", icon: Group },
  { id: "procurement" as const, label: "Procurement", icon: Cart },
  { id: "threats" as const, label: "Threats", icon: Target },
  { id: "operations" as const, label: "Operations", icon: Flame },
  { id: "stability" as const, label: "Internal stability", icon: Users },
];

/**
 * The Defense page. The owner gets the console (overview, levers, branches, procurement, threats, operations,
 * stability); anyone else sees the nation's public order of battle.
 */
export function DefenseCommandPanel({ countryId }: DefenseCommandPanelProps) {
  // `?tab=operations` (a PvP challenge notification) opens on that tab.
  const requestedTab = useSearchParams()?.get("tab");
  const [activeTab, setActiveTab] = useState<DefenseTab>(() =>
    isDefenseTab(requestedTab) ? requestedTab : "overview"
  );
  const { redacted, isLoading } = useDefenseOverview(countryId);

  if (isLoading) return <PanelSkeleton />;
  if (redacted) return <RedactedDefenseView view={redacted} />;

  return (
    <div className="space-y-4">
      <SectionTabBar
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        aria-label="Defense sections"
      />

      {activeTab === "overview" && <OverviewPanel countryId={countryId} />}
      {activeTab === "policy" && <PolicyPanel countryId={countryId} />}
      {activeTab === "branches" && <BranchesPanel countryId={countryId} />}
      {activeTab === "procurement" && <ProcurementPanel countryId={countryId} />}
      {activeTab === "threats" && <BorderThreatPanel countryId={countryId} />}
      {activeTab === "operations" && <OperationsPanel countryId={countryId} />}
      {activeTab === "stability" && <StabilityPanel countryId={countryId} />}
    </div>
  );
}
