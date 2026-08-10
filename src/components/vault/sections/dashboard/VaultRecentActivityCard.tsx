"use client";

import React from "react";
import { History, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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

export function VaultRecentActivityCard({
  loading,
  activities,
}: VaultRecentActivityCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 border-t-white/20 dark:bg-black/60 dark:border-white/12 dark:border-t-white/25"
      )}
    >
      <TextureOverlay texture="dots" opacity={0.03} />

      <div className="relative z-10 mb-4 flex items-center gap-2.5 border-b border-white/10 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/15 border border-slate-500/30 text-slate-300 shadow-sm backdrop-blur-md">
          <History className="h-4.5 w-4.5 text-slate-300" />
        </div>
        <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
          Recent Activity
        </span>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <p className="py-8 text-center text-xs italic text-slate-400">
          No transactions recorded
        </p>
      ) : (
        <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
          {activities.slice(0, 8).map((activity) => {
            const isEarn = activity.amount > 0;
            return (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs backdrop-blur-md transition-all hover:bg-white/10 active:scale-[0.985] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border shadow-sm backdrop-blur-md",
                      isEarn
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : "border-rose-500/30 bg-rose-500/15 text-rose-400"
                    )}
                  >
                    {isEarn ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-white tracking-tight">
                      {activity.source.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-mono text-sm font-bold tracking-tight",
                    isEarn ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]" : "text-rose-400"
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
    </div>
  );
}
