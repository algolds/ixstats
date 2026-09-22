"use client";

/**
 * Shared Synergy Display
 *
 * Displays discovered synergies (bonuses) and conflicts (penalties) between components.
 * Replaces domain-specific duplicates with a clean, semantic token-driven UI.
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Flash as Zap, WarningTriangle as AlertTriangle, StatUp as TrendingUp } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface SynergyItem {
  id?: string;
  comp1Name: string;
  comp2Name: string;
  bonus?: number | string;
  penalty?: number | string;
  description?: string;
  type?: "synergy" | "conflict";
}

export interface SynergyDisplayProps {
  synergies: SynergyItem[];
  conflicts: SynergyItem[];
  className?: string;
}

export const SynergyDisplay = React.memo(function SynergyDisplay({
  synergies,
  conflicts,
  className,
}: SynergyDisplayProps) {
  const hasSynergies = synergies.length > 0;
  const hasConflicts = conflicts.length > 0;

  if (!hasSynergies && !hasConflicts) {
    return (
      <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-8 px-4 text-center", className)}>
        <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
        <p className="text-xs font-semibold text-foreground">
          No synergies or conflicts detected yet
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground max-w-xs">
          Select complementary components to unlock compounding synergies, and watch out for conflicting doctrines.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Active Synergies Section */}
      {hasSynergies && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <Zap className="h-4 w-4" />
            <span>Active Synergies ({synergies.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {synergies.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 shadow-xs"
              >
                <div className="rounded-md bg-emerald-500/15 p-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="truncate text-xs font-bold text-foreground">
                      {item.comp1Name} + {item.comp2Name}
                    </h5>
                    {item.bonus && (
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-none text-[10px] px-1 py-0 font-semibold">
                        +{item.bonus}%
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Conflicts Section */}
      {hasConflicts && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span>Active Conflicts ({conflicts.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {conflicts.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/5 p-3 shadow-xs"
              >
                <div className="rounded-md bg-red-500/15 p-1.5 text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="truncate text-xs font-bold text-foreground">
                      {item.comp1Name} ↔ {item.comp2Name}
                    </h5>
                    {item.penalty && (
                      <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-none text-[10px] px-1 py-0 font-semibold">
                        -{item.penalty}%
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
