"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Users, Scale, Building2, FileText, Crown } from "lucide-react";
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

/**
 * Politics drill-down — cabinet / parties / legislature / bills / power brokers (player fiat).
 * Shared between the v2 right-side drill sheet and the full-page politics surface.
 * (v2 Design Bible §6: Politics is 100% player fiat; sim informs but never overrides)
 */
export function PoliticsDrillDown({ countryId }: { countryId: string }) {
  const [activeTab, setActiveTab] = useState<
    "cabinet" | "parties" | "legislature" | "bills" | "power"
  >("cabinet");

  const tabs = [
    { id: "cabinet" as const, label: "Cabinet", icon: Users },
    { id: "parties" as const, label: "Parties", icon: Scale },
    { id: "legislature" as const, label: "Legislature", icon: Building2 },
    { id: "bills" as const, label: "Bills & Reforms", icon: FileText },
    { id: "power" as const, label: "Power Brokers", icon: Crown },
  ];

  return (
    <div className="space-y-4">
      {/* Player Fiat Banner */}
      <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-purple-400 shrink-0" />
          <div>
            <span className="font-extrabold text-foreground">Executive Fiat Mode</span>
            <p className="text-[11px] text-muted-foreground">
              Political structure, party seats, cabinet posts, and legislative rules are 100% player configurable.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
          Player Fiat Enabled
        </span>
      </div>

      {/* Facet Segmented Sub-Tab Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-border/30">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer shrink-0 active:scale-95",
              activeTab === id
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-border/30"
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
