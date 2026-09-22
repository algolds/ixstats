"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Globe, CheckCircle, InfoCircle as Info } from "iconoir-react";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import {
  getComplexityColor,
  getArchetypeIcon,
  getArchetypeColors,
} from "./archetypeTheme";

interface ArchetypeCardProps {
  archetype: EconomicArchetype;
  isSelected: boolean;
  showSelectButton?: boolean;
  onSelect: (archetype: EconomicArchetype) => void;
  onOpenDetails: (archetype: EconomicArchetype) => void;
}

export const ArchetypeCard = React.memo(function ArchetypeCard({
  archetype,
  isSelected,
  showSelectButton = false,
  onSelect,
  onOpenDetails,
}: ArchetypeCardProps) {
  const IconComponent = getArchetypeIcon(archetype.id);
  const colors = getArchetypeColors(archetype.id);

  return (
    <div className="group relative">
      <div
        className={cn(
          "flex h-full flex-col justify-between gap-4 rounded-xl border p-5 transition-all duration-300",
          isSelected
            ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50 dark:bg-emerald-500/10"
            : "border-border bg-card/40 hover:border-emerald-500/30 hover:bg-emerald-500/[0.01] hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/[0.03]"
        )}
      >
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted/50 border-border shrink-0 rounded-lg border p-2.5">
              <IconComponent className={cn("h-5 w-5", colors.text)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-foreground truncate text-sm leading-tight font-bold">
                  {archetype.name}
                </h4>
                {isSelected && (
                  <Badge
                    variant="default"
                    className="border-emerald-500/20 bg-emerald-500/15 px-1.5 py-0 text-[9px] font-semibold text-emerald-400"
                  >
                    Active Preset
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <Globe className="text-muted-foreground/75 h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{archetype.region}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Badge
              className={cn(
                getComplexityColor(archetype.implementationComplexity),
                "shrink-0 px-2 py-0.5 text-[10px] font-medium capitalize"
              )}
            >
              {archetype.implementationComplexity}
            </Badge>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Innovation: {archetype.growthMetrics.innovationIndex}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-border/50 flex items-center gap-2 border-t pt-2.5">
          {showSelectButton && (
            <Button
              onClick={() => {
                if (!isSelected) {
                  onSelect(archetype);
                }
              }}
              disabled={isSelected}
              className={cn(
                "h-8 flex-1 cursor-pointer text-xs font-semibold transition-all",
                isSelected
                  ? "cursor-default border border-emerald-500/30 bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              )}
              size="sm"
            >
              <CheckCircle
                className={cn(
                  "mr-1.5 h-3.5 w-3.5",
                  isSelected ? "text-emerald-400" : "text-white"
                )}
              />
              {isSelected ? "Selected" : "Select"}
            </Button>
          )}
          <Button
            onClick={() => onOpenDetails(archetype)}
            variant="outline"
            className="border-border hover:bg-accent hover:text-accent-foreground h-8 flex-1 cursor-pointer text-xs"
            size="sm"
          >
            <Info className="mr-1.5 h-3.5 w-3.5" />
            Details
          </Button>
        </div>
      </div>
    </div>
  );
});
