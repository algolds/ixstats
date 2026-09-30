"use client";

import React from "react";
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
    <button
      type="button"
      onClick={() => onNavigate?.(pin.id)}
      className="border-border bg-card hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon
        className="text-muted-foreground h-4 w-4 shrink-0"
        style={color ? { color } : undefined}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-medium">{pin.title}</p>
        {pin.ixTimeYear != null && (
          <p className="text-muted-foreground text-xs">Year {pin.ixTimeYear}</p>
        )}
      </div>
    </button>
  );
}
