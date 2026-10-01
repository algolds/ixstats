"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { STORY_PIN_COLORS } from "~/lib/maps/story-pin-icons";
import { getCategoryIcon } from "~/components/maps/core/utils/story-pin-helpers";

interface RelatedPinCardProps {
  pin: {
    id: string;
    title: string;
    category: string;
    ixTimeYear: number | null;
    thumbnailUrl: string | null;
  };
  onNavigate?: (pinId: string) => void;
}

export function RelatedPinCard({ pin, onNavigate }: RelatedPinCardProps) {
  // The category colour is map data (it matches the pin drawn on the map), not chrome.
  const color = STORY_PIN_COLORS[pin.category];
  const Icon = getCategoryIcon(pin.category);
  return (
    <FacetCard
      variant="inset"
      padding="sm"
      onClick={() => onNavigate?.(pin.id)}
      className="flex w-full items-center gap-2 p-2 text-left"
    >
      <Icon
        className="text-label-secondary h-4 w-4 shrink-0"
        style={color ? { color } : undefined}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-label text-caption truncate">{pin.title}</p>
        {pin.ixTimeYear != null && (
          <p className="text-label-secondary text-footnote">Year {pin.ixTimeYear}</p>
        )}
      </div>
    </FacetCard>
  );
}
