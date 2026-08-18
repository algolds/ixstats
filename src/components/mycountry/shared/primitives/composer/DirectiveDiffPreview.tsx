"use client";

import React from "react";
import { Zap, ArrowRight, Shield, Heart, Scale, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ProjectedDiff {
  approvalDelta?: number;
  stabilityDelta?: number;
  gdpDelta?: number;
  defenseDelta?: number;
  civCapCost?: number;
  narrativeSummary?: string;
  brokerUnlocked?: boolean;
  structuralUnlocked?: boolean;
}

export interface DirectiveDiffPreviewProps {
  assembled: ProjectedDiff | null;
  loading: boolean;
  onCommit: () => void;
  committing: boolean;
}

export const DirectiveDiffPreview = React.memo(function DirectiveDiffPreview({
  assembled,
  loading,
  onCommit,
  committing,
}: DirectiveDiffPreviewProps) {
  if (loading) {
    return (
      <div className="border-border/60 bg-card/30 flex animate-pulse items-center justify-center rounded-xl border p-4 text-xs font-semibold text-amber-500">
        <Zap className="mr-2 h-4 w-4 animate-bounce" />
        <span>Calculating Statecraft Simulation Projections...</span>
      </div>
    );
  }

  if (!assembled) return null;

  return (
    <div className="animate-in fade-in space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h4 className="text-foreground text-xs font-extrabold tracking-tight">
            Projected Statecraft Outcome
          </h4>
        </div>

        {assembled.civCapCost && (
          <span className="font-mono text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
            -{assembled.civCapCost} CivCap
          </span>
        )}
      </div>

      {/* Metric Delta Badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        {assembled.approvalDelta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold",
              assembled.approvalDelta >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
            )}
          >
            <Heart className="h-3 w-3" />
            <span>
              Approval {assembled.approvalDelta >= 0 ? "+" : ""}
              {assembled.approvalDelta}%
            </span>
          </span>
        )}

        {assembled.stabilityDelta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold",
              assembled.stabilityDelta >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
            )}
          >
            <Scale className="h-3 w-3" />
            <span>
              Stability {assembled.stabilityDelta >= 0 ? "+" : ""}
              {assembled.stabilityDelta}%
            </span>
          </span>
        )}

        {assembled.gdpDelta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-bold",
              assembled.gdpDelta >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
            )}
          >
            <TrendingUp className="h-3 w-3" />
            <span>
              GDP Growth {assembled.gdpDelta >= 0 ? "+" : ""}
              {assembled.gdpDelta}%
            </span>
          </span>
        )}
      </div>

      {/* Executive Commitment Button */}
      <button
        type="button"
        disabled={committing}
        onClick={onCommit}
        className="w-full cursor-pointer rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2.5 text-xs font-bold tracking-tight text-slate-950 shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {committing ? "Enacting Executive Order..." : "Enact Executive Order"}
      </button>
    </div>
  );
});
