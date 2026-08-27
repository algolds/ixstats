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
import { cn } from "~/lib/utils";

const CabinetPanel = dynamic(
  () =>
    import("~/components/executive/politics/CabinetPanel").then((m) => ({
      default: m.CabinetPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const PartyManager = dynamic(
  () =>
    import("~/components/executive/politics/PartyManager").then((m) => ({
      default: m.PartyManager,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const LegislaturePanel = dynamic(
  () =>
    import("~/components/executive/politics/LegislaturePanel").then((m) => ({
      default: m.LegislaturePanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const BillsPanel = dynamic(
  () =>
    import("~/components/executive/politics/BillsPanel").then((m) => ({
      default: m.BillsPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
);

const PowerBrokersPanel = dynamic(
  () =>
    import("~/components/executive/politics/PowerBrokersPanel").then((m) => ({
      default: m.PowerBrokersPanel,
    })),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" /> }
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
      <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 shrink-0 text-purple-400" />
          <div>
            <span className="text-foreground font-extrabold">Executive Fiat Mode</span>
            <p className="text-muted-foreground text-[11px]">
              Political structure, party seats, cabinet posts, and legislative rules are 100% player
              configurable.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
          Player Fiat Enabled
        </span>
      </div>

      {/* Facet Segmented Sub-Tab Switcher */}
      <div className="border-border/30 flex scrollbar-none items-center gap-1.5 overflow-x-auto border-b pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all active:scale-95",
              activeTab === id
                ? "border border-purple-500/40 bg-purple-500/20 text-purple-400 shadow-sm"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "cabinet" && <CabinetPanel countryId={countryId} />}
      {activeTab === "parties" && <PartyManager countryId={countryId} />}
      {activeTab === "legislature" && <LegislaturePanel countryId={countryId} />}
      {activeTab === "bills" && <BillsPanel countryId={countryId} />}
      {activeTab === "power" && <PowerBrokersPanel countryId={countryId} />}
    </div>
  );
}

export const PoliticsDrillDown = React.memo(PoliticsDrillDownComponent);
