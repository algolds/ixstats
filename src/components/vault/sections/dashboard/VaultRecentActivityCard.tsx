"use client";

import React from "react";
import { ClockRotateRight as History, ArrowUp, ArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { Card } from "~/components/ui/card";

export interface ActivityEntry {
  id: string;
  type: string;
  amount: number;
  source: string;
  createdAt: Date;
}

export interface VaultRecentActivityCardProps {
  loading: boolean;
  activities?: ActivityEntry[];
}

export function VaultRecentActivityCard({ loading, activities }: VaultRecentActivityCardProps) {
  return (
    // A ledger list: opaque (Facet 3.1 dense data), with v2's dot texture and tinted shadow.
    <Card padding="lg" className="overflow-hidden">
      <div className="border-separator mb-4 flex items-center gap-2 border-b pb-4">
        <div className="text-label-secondary rounded-row border-separator bg-fill-3 shadow-card flex h-8 w-8 items-center justify-center border">
          <History aria-hidden className="text-label-secondary h-4.5 w-4.5" />
        </div>
        <span className="text-label-secondary text-eyebrow">Recent activity</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="bg-fill-3 rounded-card h-12 w-full" />
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <p className="text-label-secondary text-footnote py-8 text-center italic">
          No transactions recorded
        </p>
      ) : (
        <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
          {activities.slice(0, 8).map((activity) => {
            const isEarn = activity.amount > 0;
            return (
              <div
                key={activity.id}
                // A ledger row, not a control: no hover wash or press (Facet 3.1 HIG).
                className="border-separator bg-fill-4 rounded-card text-footnote flex items-center justify-between border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden
                    className={cn(
                      "shadow-card flex h-7 w-7 items-center justify-center rounded-full border",
                      isEarn
                        ? "border-green/30 bg-green/15 text-green"
                        : "border-red/30 bg-red/15 text-red"
                    )}
                  >
                    {isEarn ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="text-label font-semibold">{activity.source.replace(/_/g, " ")}</p>
                    <p className="text-label-secondary text-footnote mt-0.5">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-body font-data flex items-center gap-0.5 font-semibold tabular-nums",
                    isEarn ? "text-green-ink" : "text-red-ink"
                  )}
                >
                  {isEarn ? "+" : "-"}
                  <IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                  {Math.abs(activity.amount).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
