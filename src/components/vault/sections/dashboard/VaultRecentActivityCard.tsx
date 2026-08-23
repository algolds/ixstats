"use client";

import React from "react";
import { ClockRotateRight as History, ArrowUp, ArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

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
    <FacetCard
      depth={2}
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 shadow-xl backdrop-blur-2xl transition-all duration-300"
      )}
    >
      <TextureOverlay texture="dots" opacity={0.03} />

      <div className="border-border/40 relative z-10 mb-4 flex items-center gap-2.5 border-b pb-4">
        <div className="text-muted-foreground flex h-8 w-8 items-center justify-center rounded-xl border border-slate-500/30 bg-slate-500/15 shadow-sm backdrop-blur-md">
          <History className="text-muted-foreground h-4.5 w-4.5" />
        </div>
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Recent Activity
        </span>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="bg-muted/40 h-12 w-full rounded-2xl" />
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-xs italic">
          No transactions recorded
        </p>
      ) : (
        <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
          {activities.slice(0, 8).map((activity) => {
            const isEarn = activity.amount > 0;
            return (
              <div
                key={activity.id}
                className="border-border/40 bg-muted/30 hover:bg-muted/60 flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-xs backdrop-blur-md transition-all active:scale-[0.985] dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border shadow-sm backdrop-blur-md",
                      isEarn
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {isEarn ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="text-foreground font-bold tracking-tight">
                      {activity.source.replace(/_/g, " ")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-mono text-sm font-bold tracking-tight",
                    isEarn
                      ? "text-emerald-600 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)] dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {isEarn ? "+" : "-"}
                  <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                  {Math.abs(activity.amount).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </FacetCard>
  );
}
