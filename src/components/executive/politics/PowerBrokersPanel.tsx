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
  technocrats: "text-blue-ink bg-blue/10 border-blue/20",
  party: "text-indigo-ink bg-indigo/10 border-indigo/20",
  generals: "text-red-ink bg-red/10 border-red/20",
  magnates: "text-yellow-ink bg-yellow/10 border-yellow/20",
  clergy: "text-green-ink bg-green/10 border-green/20",
};

export function PowerBrokersPanel({ countryId }: PowerBrokersPanelProps) {
  const { data: brokers, isLoading } = api.elections.getPowerBrokers.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="text-label-secondary text-footnote flex h-40 items-center justify-center">
        Loading power brokers...
      </div>
    );
  }

  const activeBrokers = brokers?.filter((b) => b.unlocked) || [];

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h3 className="text-eyebrow opacity-70">Power Brokers</h3>
        <p className="text-label-secondary text-footnote">
          Internal interest groups unlocked by your country structure and budget allocation
        </p>
      </div>

      {activeBrokers.length === 0 ? (
        <div className="text-label-secondary rounded-control border-separator text-footnote flex flex-col items-center justify-center border border-dashed py-8 text-center">
          <AlertCircle className="mb-2 h-6 w-6 opacity-30" />
          No Power Brokers are currently active.
          <span className="text-footnote mt-1 opacity-75">
            Select government components in the editor to summon interest groups.
          </span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeBrokers.map((broker) => {
            const Icon = BROKER_ICONS[broker.id] || Compass;
            const colorClass =
              BROKER_COLORS[broker.id] || "text-label-secondary bg-fill-4 border-separator";
            const percent =
              broker.requiredSpend > 0
                ? Math.min(100, (broker.currentSpend / broker.requiredSpend) * 100)
                : 100;

            return (
              <FacetCard
                key={broker.id}
                className={`hover:border-separator flex flex-col justify-between border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                  broker.satisfied ? "border-green/25 bg-green/5" : "border-separator"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-control-sm border p-1 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-caption font-semibold">{broker.name}</span>
                    </div>
                    <span
                      className={`text-eyebrow rounded-control-sm px-2 py-0.5 ${
                        broker.satisfied
                          ? "bg-green/10 text-green-ink"
                          : "bg-yellow/10 text-yellow-ink"
                      }`}
                    >
                      {broker.satisfied ? "Satisfied" : "Neglected"}
                    </span>
                  </div>

                  <p className="text-label-secondary text-footnote leading-relaxed">
                    {broker.description}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {/* Budget allocation satisfaction bar */}
                  <div className="space-y-1">
                    <div className="text-label-secondary text-caption flex justify-between">
                      <span>Favored Budget Allocation</span>
                      <span>
                        {broker.currentSpend}% / {broker.requiredSpend}%
                      </span>
                    </div>
                    <div className="bg-fill-3 h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${
                          broker.satisfied ? "bg-green" : "bg-yellow"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-separator border-t pt-2">
                    <p className="text-label-secondary text-caption font-semibold">
                      ACTIVE EFFECT:
                    </p>
                    <p
                      className={`text-caption mt-0.5 ${
                        broker.satisfied ? "text-label" : "text-label-secondary"
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
