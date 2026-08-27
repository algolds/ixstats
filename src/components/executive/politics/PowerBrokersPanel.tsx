"use client";

import React from "react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Shield,
  Bank as Landmark,
  City as Building2,
  Group as Users2,
  Compass,
  WarningCircle as AlertCircle,
} from "iconoir-react";

interface PowerBrokersPanelProps {
  countryId: string;
}

const BROKER_ICONS: Record<string, React.ComponentType<any>> = {
  technocrats: Compass,
  party: Users2,
  generals: Shield,
  magnates: Building2,
  clergy: Landmark,
};

const BROKER_COLORS: Record<string, string> = {
  technocrats: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  party: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  generals: "text-red-500 bg-red-500/10 border-red-500/20",
  magnates: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  clergy: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
};

export function PowerBrokersPanel({ countryId }: PowerBrokersPanelProps) {
  const { data: brokers, isLoading } = api.elections.getPowerBrokers.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-xs">
        Loading power brokers...
      </div>
    );
  }

  const activeBrokers = brokers?.filter((b) => b.unlocked) || [];

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h3 className="text-xs font-bold tracking-wider uppercase opacity-70">Power Brokers</h3>
        <p className="text-muted-foreground text-[10px]">
          Internal interest groups unlocked by your country structure and budget allocation
        </p>
      </div>

      {activeBrokers.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed border-black/10 py-8 text-center text-xs dark:border-white/10">
          <AlertCircle className="mb-2 h-6 w-6 opacity-30" />
          No Power Brokers are currently active.
          <span className="mt-1 text-[10px] opacity-75">
            Select government components in the editor to summon interest groups.
          </span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeBrokers.map((broker) => {
            const Icon = BROKER_ICONS[broker.id] || Compass;
            const colorClass =
              BROKER_COLORS[broker.id] || "text-slate-500 bg-slate-500/10 border-slate-500/20";
            const percent =
              broker.requiredSpend > 0
                ? Math.min(100, (broker.currentSpend / broker.requiredSpend) * 100)
                : 100;

            return (
              <FacetCard
                key={broker.id}
                className={`flex flex-col justify-between border p-3.5 transition-all hover:border-black/25 dark:hover:border-white/25 ${
                  broker.satisfied
                    ? "border-emerald-500/25 bg-emerald-500/[0.02]"
                    : "border-black/5 dark:border-white/5"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded border p-1 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold">{broker.name}</span>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        broker.satisfied
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                      }`}
                    >
                      {broker.satisfied ? "Satisfied" : "Neglected"}
                    </span>
                  </div>

                  <p className="text-muted-foreground text-[10px] leading-relaxed">
                    {broker.description}
                  </p>
                </div>

                <div className="mt-4 space-y-2.5">
                  {/* Budget allocation satisfaction bar */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground flex justify-between text-[9px] font-medium">
                      <span>Favored Budget Allocation</span>
                      <span>
                        {broker.currentSpend}% / {broker.requiredSpend}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                      <div
                        className={`h-full transition-all duration-300 ${
                          broker.satisfied ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-black/5 pt-2 dark:border-white/5">
                    <p className="text-muted-foreground text-[9px] font-semibold">ACTIVE EFFECT:</p>
                    <p
                      className={`mt-0.5 text-[10px] font-medium ${
                        broker.satisfied ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {broker.satisfied
                        ? broker.bonusDescription
                        : "Inactive (satisfy budget requirement to activate)"}
                    </p>
                  </div>
                </div>
              </FacetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
