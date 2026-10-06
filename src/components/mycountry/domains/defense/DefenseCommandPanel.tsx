"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Shield,
  Archery as Target,
  Tournament as Swords,
  FireFlame as Flame,
  Group as Users,
} from "iconoir-react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { Skeleton } from "~/components/ui/skeleton";

function PanelSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// Lazy-load heavy panels per active tab
const CommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/CommandPanel").then((m) => ({
      default: m.CommandPanel,
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

const ArsenalPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/forces/ArsenalPanel").then((m) => ({
      default: m.ArsenalPanel,
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

export function DefenseCommandPanel({ countryId }: DefenseCommandPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "branches" | "threats" | "assets" | "operations" | "stability"
  >("branches");

  const tabs = [
    { id: "branches" as const, label: "Branches & readiness", icon: Shield },
    { id: "threats" as const, label: "Threat vectors", icon: Target },
    { id: "assets" as const, label: "Forces & arsenal", icon: Swords },
    { id: "operations" as const, label: "Special operations", icon: Flame },
    { id: "stability" as const, label: "Internal stability", icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher (shared with the other domain sections) */}
      <SectionTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="text-red"
      />

      {activeTab === "branches" && <CommandPanel countryId={countryId} />}
      {activeTab === "threats" && <BorderThreatPanel countryId={countryId} />}
      {activeTab === "assets" && <ArsenalPanel countryId={countryId} />}
      {activeTab === "operations" && <OperationsPanel countryId={countryId} />}
      {activeTab === "stability" && <StabilityPanel countryId={countryId} />}
    </div>
  );
}
