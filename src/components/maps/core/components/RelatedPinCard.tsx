"use client";

import React from "react";
import { STORY_PIN_COLORS } from "~/lib/maps/story-pin-icons";
import { CATEGORY_ICONS } from "~/components/maps/core/utils/story-pin-helpers";

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
  const color = STORY_PIN_COLORS[pin.category] ?? "#6b7280";
  return (
    <button
      onClick={() => onNavigate?.(pin.id)}
      className="border-border/30 bg-card/30 hover:bg-card/60 flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {CATEGORY_ICONS[pin.category] ?? "📌"}
      </div>
      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-medium">{pin.title}</p>
        {pin.ixTimeYear != null && (
          <p className="text-muted-foreground text-[10px]">Year {pin.ixTimeYear}</p>
        )}
      </div>
    </button>
  );
}
