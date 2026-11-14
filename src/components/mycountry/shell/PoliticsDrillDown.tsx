"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { Skeleton } from "~/components/ui/skeleton";

const CabinetPanel = dynamic(
  () =>
    import("~/components/executive/politics/CabinetPanel").then((m) => ({
      default: m.CabinetPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const PartyManager = dynamic(
  () =>
    import("~/components/executive/politics/PartyManager").then((m) => ({
      default: m.PartyManager,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const LegislaturePanel = dynamic(
  () =>
    import("~/components/executive/politics/LegislaturePanel").then((m) => ({
      default: m.LegislaturePanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const BillsPanel = dynamic(
  () =>
    import("~/components/executive/politics/BillsPanel").then((m) => ({
      default: m.BillsPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

const ExecutivePoliciesPanel = dynamic(
  () =>
    import("~/components/executive/politics/ExecutivePoliciesPanel").then((m) => ({
      default: m.ExecutivePoliciesPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-32" /> }
);

const ElectionStatusCard = dynamic(
  () =>
    import("~/components/executive/politics/ElectionStatusCard").then((m) => ({
      default: m.ElectionStatusCard,
    })),
  { loading: () => <Skeleton className="rounded-card h-20" /> }
);

const PowerBrokersPanel = dynamic(
  () =>
    import("~/components/executive/politics/PowerBrokersPanel").then((m) => ({
      default: m.PowerBrokersPanel,
    })),
  { loading: () => <Skeleton className="rounded-card h-64" /> }
);

interface PoliticsDrillDownProps {
  countryId: string;
}

/**
 * Politics drill-down: cabinet, parties, legislature, bills and power brokers. Shared between the
 * drill sheet and the full-page politics surface. Politics is player-decided; the sim informs but
 * never overrides.
 */
const TABS = [
  { id: "cabinet" as const, label: "Cabinet" },
  { id: "parties" as const, label: "Parties" },
  { id: "legislature" as const, label: "Legislature" },
  { id: "bills" as const, label: "Bills & reforms" },
  { id: "power" as const, label: "Power brokers" },
];

/**
 * Politics drill-down: cabinet, parties, legislature, bills and power brokers. Shared between the
 * drill sheet and the full-page politics surface. Politics is player-decided; the sim informs but
 * never overrides.
 */
export function PoliticsDrillDown({ countryId }: PoliticsDrillDownProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "cabinet" | "parties" | "legislature" | "bills" | "power"
  >("cabinet");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-3 text-label">Politics</h2>
        <SectionTabBar
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
          aria-label="Politics sections"
        />
      </div>

      {/* Election lifecycle: first election date, results, seated chamber (MC-2) */}
      <ElectionStatusCard countryId={countryId} />

      {activeTab === "cabinet" && <CabinetPanel countryId={countryId} />}
      {activeTab === "parties" && <PartyManager countryId={countryId} />}
      {activeTab === "legislature" && <LegislaturePanel countryId={countryId} />}
      {activeTab === "bills" && (
        <div className="space-y-4">
          <BillsPanel countryId={countryId} />
          <ExecutivePoliciesPanel countryId={countryId} />
        </div>
      )}
      {activeTab === "power" && <PowerBrokersPanel countryId={countryId} />}
    </div>
  );
}
