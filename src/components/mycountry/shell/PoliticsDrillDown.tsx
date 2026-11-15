"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";
import { Skeleton } from "~/components/ui/skeleton";

const StateRepresentationPanel = dynamic(
  () =>
    import("~/components/executive/politics/StateRepresentationPanel").then((m) => ({
      default: m.StateRepresentationPanel,
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

const TABS = [
  { id: "state" as const, label: "State & representation" },
  { id: "bills" as const, label: "Bills & reforms" },
  { id: "power" as const, label: "Power brokers" },
];

/**
 * Politics drill-down: read-only state & representation summary (configured in `/mycountry/editor`),
 * live bills & reforms, and power brokers.
 */
export function PoliticsDrillDown({ countryId }: PoliticsDrillDownProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"state" | "bills" | "power">("state");

  return (
    <div className="space-y-4">
      <SectionTabBar
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        aria-label="Politics sections"
      />

      <ElectionStatusCard countryId={countryId} />

      {activeTab === "state" && <StateRepresentationPanel countryId={countryId} />}
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
