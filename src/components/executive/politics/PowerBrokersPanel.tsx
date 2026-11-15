"use client";

import React from "react";
import { api } from "~/trpc/react";
import {
  Shield,
  Bank as Landmark,
  City as Building2,
  Group as Users2,
  Compass,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Progress } from "~/components/ui/progress";

interface PowerBrokersPanelProps {
  countryId: string;
}

const BROKER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  technocrats: Compass,
  party: Users2,
  generals: Shield,
  magnates: Building2,
  clergy: Landmark,
};

export function PowerBrokersPanel({ countryId }: PowerBrokersPanelProps) {
  const { data: brokers, isLoading } = api.elections.getPowerBrokers.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="text-label-secondary text-footnote flex h-40 items-center justify-center">
        Loading power brokers
      </div>
    );
  }

  const activeBrokers = brokers?.filter((b) => b.unlocked) || [];

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-label-secondary text-footnote">
        Interest groups unlocked by your government structure and budget.
      </p>

      {activeBrokers.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<AlertCircle />}
            title="No power brokers are active"
            message="Add government components in the editor to bring in interest groups."
          />
        </Card>
      ) : (
        <Card content="data" padding="none">
          <div className="divide-separator/60 grid grid-cols-1 divide-y sm:grid-cols-2 sm:[&>*:nth-child(even)]:border-l sm:[&>*:nth-child(even)]:border-separator/60">
            {activeBrokers.map((broker) => {
              const Icon = BROKER_ICONS[broker.id] || Compass;
              const percent =
                broker.requiredSpend > 0
                  ? Math.min(100, (broker.currentSpend / broker.requiredSpend) * 100)
                  : 100;

              return (
                <div key={broker.id} className="flex flex-col justify-between p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="text-label-secondary h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="text-label text-headline truncate">{broker.name}</span>
                      </div>
                      <Badge variant={broker.satisfied ? "success" : "secondary"}>
                        {broker.satisfied ? "Satisfied" : "Neglected"}
                      </Badge>
                    </div>

                    <p className="text-label-secondary text-footnote leading-relaxed">
                      {broker.description}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="space-y-1">
                      <div className="text-label-secondary text-footnote flex justify-between">
                        <span>Favored budget allocation</span>
                        <span className="text-label tabular-nums">
                          {broker.currentSpend}% / {broker.requiredSpend}%
                        </span>
                      </div>
                      <Progress
                        value={percent}
                        tone={broker.satisfied ? "success" : "neutral"}
                        className="h-1.5"
                        aria-label={`${broker.name} budget allocation`}
                      />
                    </div>

                    <div className="border-separator/60 border-t pt-2">
                      <p className="text-label-secondary text-footnote">Active effect</p>
                      <p
                        className={`text-footnote mt-0.5 ${
                          broker.satisfied ? "text-label font-medium" : "text-label-secondary"
                        }`}
                      >
                        {broker.satisfied
                          ? broker.bonusDescription
                          : "Inactive until the budget requirement is met"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
