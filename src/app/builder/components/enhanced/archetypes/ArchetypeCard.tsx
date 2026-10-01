"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Globe, CheckCircle, InfoCircle as Info } from "iconoir-react";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import { FacetCard } from "~/components/ui/facet-container";
import { getComplexityBadgeVariant, getArchetypeIcon, getArchetypeColors } from "./archetypeTheme";

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
    <FacetCard
      className={cn(
        "flex h-full flex-col justify-between gap-4 p-5",
        isSelected && "border-tint ring-tint ring-1"
      )}
    >
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-control shrink-0 p-2", colors.bg)}>
            <IconComponent aria-hidden className={cn("size-5", colors.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-headline text-label truncate">{archetype.name}</h4>
              {isSelected && <Badge variant="tinted">Active Preset</Badge>}
            </div>
            <div className="text-footnote text-label-secondary mt-0.5 flex items-center gap-1">
              <Globe aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{archetype.region}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge
            variant={getComplexityBadgeVariant(archetype.implementationComplexity)}
            className="capitalize"
          >
            {archetype.implementationComplexity}
          </Badge>
          <div className="text-caption text-label-secondary tabular-nums">
            Innovation: {archetype.growthMetrics.innovationIndex}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-separator flex items-center gap-2 border-t pt-3">
        {showSelectButton && (
          <Button
            onClick={() => {
              if (!isSelected) {
                onSelect(archetype);
              }
            }}
            disabled={isSelected}
            variant={isSelected ? "tinted" : "filled"}
            className="flex-1"
            size="sm"
          >
            <CheckCircle aria-hidden />
            {isSelected ? "Selected" : "Select"}
          </Button>
        )}
        <Button
          onClick={() => onOpenDetails(archetype)}
          variant="bordered"
          className="flex-1"
          size="sm"
        >
          <Info aria-hidden />
          Details
        </Button>
      </div>
    </FacetCard>
  );
});
