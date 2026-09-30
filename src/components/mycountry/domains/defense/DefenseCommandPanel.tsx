"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Shield,
  Archery as Target,
  Tournament as Swords,
  FireFlame as Flame,
  Group as Users,
  SystemRestart as Loader2,
} from "iconoir-react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";

// Lazy-load heavy panels per active tab
const CommandPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/CommandPanel").then((m) => ({
      default: m.CommandPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const BorderThreatPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/BorderThreatPanel").then((m) => ({
      default: m.BorderThreatPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const AssetManager = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/AssetManager").then((m) => ({
      default: m.AssetManager,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const OperationsPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/OperationsPanel").then((m) => ({
      default: m.OperationsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const StabilityPanel = dynamic(
  () =>
    import("~/components/mycountry/domains/defense/StabilityPanel").then((m) => ({
      default: m.StabilityPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
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
    { id: "branches" as const, label: "Branches & Readiness", icon: Shield },
    { id: "threats" as const, label: "Threat Vectors", icon: Target },
    { id: "assets" as const, label: "Forces & Arsenal", icon: Swords },
    { id: "operations" as const, label: "Special Operations", icon: Flame },
    { id: "stability" as const, label: "Internal Stability", icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher (shared with the other domain sections) */}
      <SectionTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="border-red-500/40 bg-red-500/20 text-red-700 dark:text-red-400"
      />

      {activeTab === "branches" && <CommandPanel countryId={countryId} />}
      {activeTab === "threats" && <BorderThreatPanel countryId={countryId} />}
      {activeTab === "assets" && <AssetManager countryId={countryId} />}
      {activeTab === "operations" && <OperationsPanel countryId={countryId} />}
      {activeTab === "stability" && <StabilityPanel countryId={countryId} />}
    </div>
  );
}
