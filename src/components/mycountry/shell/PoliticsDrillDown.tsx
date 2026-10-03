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
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

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
function PoliticsDrillDownComponent({ countryId }: PoliticsDrillDownProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "cabinet" | "parties" | "legislature" | "bills" | "power"
  >("cabinet");

  const tabs = useMemo(
    () => [
      { id: "cabinet" as const, label: "Cabinet", icon: Users },
      { id: "parties" as const, label: "Parties", icon: Scale },
      { id: "legislature" as const, label: "Legislature", icon: Building2 },
      { id: "bills" as const, label: "Bills & reforms", icon: FileText },
      { id: "power" as const, label: "Power brokers", icon: Crown },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Player fiat notice */}
      <Card className="rounded-card flex items-start justify-between gap-3 p-3">
        <div className="flex min-w-0 items-start gap-2">
          <Crown aria-hidden="true" className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-label text-headline">Executive fiat mode</p>
            <p className="text-label-secondary text-footnote leading-relaxed">
              Political structure, parties, cabinet posts, and legislative rules are player
              configurable. Legislative seats are won at elections.
            </p>
          </div>
        </div>
        <Badge variant="default" className="shrink-0">
          Player fiat
        </Badge>
      </Card>

      {/* Election lifecycle: first election date, results, seated chamber (MC-2) */}
      <ElectionStatusCard countryId={countryId} />

      {/* Sub-tab switcher (shared with the other domain sections) */}
      <SectionTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "cabinet" && <CabinetPanel countryId={countryId} />}
      {activeTab === "parties" && <PartyManager countryId={countryId} />}
      {activeTab === "legislature" && <LegislaturePanel countryId={countryId} />}
      {activeTab === "bills" && <BillsPanel countryId={countryId} />}
      {activeTab === "power" && <PowerBrokersPanel countryId={countryId} />}
    </div>
  );
}

export const PoliticsDrillDown = React.memo(PoliticsDrillDownComponent);
