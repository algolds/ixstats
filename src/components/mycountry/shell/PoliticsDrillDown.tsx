"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Group as Users,
  ScaleFrameEnlarge as Scale,
  City as Building2,
  Page as FileText,
  Crown,
} from "iconoir-react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { Skeleton } from "~/components/ui/skeleton";

const CabinetPanel = dynamic(
  () =>
    import("~/components/executive/politics/CabinetPanel").then((m) => ({
      default: m.CabinetPanel,
    })),
  { loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);

const PartyManager = dynamic(
  () =>
    import("~/components/executive/politics/PartyManager").then((m) => ({
      default: m.PartyManager,
    })),
  { loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);

const LegislaturePanel = dynamic(
  () =>
    import("~/components/executive/politics/LegislaturePanel").then((m) => ({
      default: m.LegislaturePanel,
    })),
  { loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);

const BillsPanel = dynamic(
  () =>
    import("~/components/executive/politics/BillsPanel").then((m) => ({
      default: m.BillsPanel,
    })),
  { loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);

const ElectionStatusCard = dynamic(
  () =>
    import("~/components/executive/politics/ElectionStatusCard").then((m) => ({
      default: m.ElectionStatusCard,
    })),
  { loading: () => <Skeleton className="h-20 rounded-2xl" /> }
);

const PowerBrokersPanel = dynamic(
  () =>
    import("~/components/executive/politics/PowerBrokersPanel").then((m) => ({
      default: m.PowerBrokersPanel,
    })),
  { loading: () => <Skeleton className="h-64 rounded-2xl" /> }
);

export interface PoliticsDrillDownProps {
  countryId: string;
}

/**
 * Politics drill-down — cabinet / parties / legislature / bills / power brokers (player fiat).
 * Shared between the v2 right-side drill sheet and the full-page politics surface.
 * (v2 Design Bible §6: Politics is 100% player fiat; sim informs but never overrides)
 */
function PoliticsDrillDownComponent({ countryId }: PoliticsDrillDownProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "cabinet" | "parties" | "legislature" | "bills" | "power"
  >("cabinet");

  const tabs = useMemo(
    () => [
      { id: "cabinet" as const, label: "Cabinet", icon: Users },
      { id: "parties" as const, label: "Parties", icon: Scale },
      { id: "legislature" as const, label: "Legislature", icon: Building2 },
      { id: "bills" as const, label: "Bills & Reforms", icon: FileText },
      { id: "power" as const, label: "Power Brokers", icon: Crown },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Player Fiat Banner */}
      <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <div>
            <span className="text-foreground font-extrabold">Executive Fiat Mode</span>
            <p className="text-muted-foreground text-xs">
              Political structure, parties, cabinet posts, and legislative rules are player
              configurable. Legislative seats are won at elections.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-indigo-500/40 bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:text-indigo-300">
          Player Fiat Enabled
        </span>
      </div>

      {/* Election lifecycle: first election date, results, seated chamber (MC-2) */}
      <ElectionStatusCard countryId={countryId} />

      {/* Sub-tab switcher (shared with the other domain sections) */}
      <SectionTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        activeClassName="border-indigo-500/40 bg-indigo-500/20 text-indigo-900 dark:text-indigo-300"
      />

      {activeTab === "cabinet" && <CabinetPanel countryId={countryId} />}
      {activeTab === "parties" && <PartyManager countryId={countryId} />}
      {activeTab === "legislature" && <LegislaturePanel countryId={countryId} />}
      {activeTab === "bills" && <BillsPanel countryId={countryId} />}
      {activeTab === "power" && <PowerBrokersPanel countryId={countryId} />}
    </div>
  );
}

export const PoliticsDrillDown = React.memo(PoliticsDrillDownComponent);
