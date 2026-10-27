"use client";

import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Card } from "~/components/ui/card";

interface StorylineTimelineProps {
  pins: Array<{
    id: string;
    title: string;
    ixTimeYear: number | null;
    eraLabel: string | null;
    category: string;
  }>;
  currentPinId: string;
  storylineTitle: string;
  storylineColor: string | null;
  onNavigate?: (pinId: string) => void;
}

export function StorylineTimeline({
  pins,
  currentPinId,
  storylineTitle,
  storylineColor,
  onNavigate,
}: StorylineTimelineProps) {
  // Storyline colour is authored map data; fall back to the maps accent token.
  const color = storylineColor ?? "var(--color-blue-500)";
  const currentIdx = pins.findIndex((p) => p.id === currentPinId);

  return (
    <Card className="p-4">
      <Eyebrow className="mb-3 block">{storylineTitle}</Eyebrow>
      <div className="relative space-y-0">
        {pins.map((pin, i) => {
          const isCurrent = pin.id === currentPinId;
          return (
            <div key={pin.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {i < pins.length - 1 && (
                <div
                  className="absolute top-4 left-[7px] h-full w-0.5"
                  style={{
                    backgroundColor: color,
                    opacity: isCurrent || i < currentIdx ? 1 : 0.2,
                  }}
                />
              )}
              <div
                className={`relative z-10 mt-0.5 shrink-0 rounded-full border-2 ${isCurrent ? "h-4 w-4" : "h-3 w-3"}`}
                style={{
                  borderColor: color,
                  backgroundColor: isCurrent || i <= currentIdx ? color : "transparent",
                }}
              />
              <button
                onClick={() => !isCurrent && onNavigate?.(pin.id)}
                disabled={isCurrent}
                className={`min-w-0 text-left transition-colors ${
                  isCurrent ? "cursor-default" : "hover:text-label cursor-pointer"
                }`}
              >
                <p
                  className={`text-footnote truncate leading-tight ${isCurrent ? "text-label font-semibold" : "text-label-secondary"}`}
                >
                  {pin.title}
                </p>
                {pin.ixTimeYear != null && (
                  <p className="text-label-secondary text-footnote">
                    Year {pin.ixTimeYear}
                    {pin.eraLabel ? ` · ${pin.eraLabel}` : ""}
                  </p>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {pins.length > 1 && (
        <p className="text-label-secondary text-footnote mt-2">
          Event {currentIdx + 1} of {pins.length}
        </p>
      )}
    </Card>
  );
}
