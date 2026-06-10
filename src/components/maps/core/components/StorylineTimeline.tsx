"use client";

import React from "react";

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
  const color = storylineColor ?? "#6366f1";
  const currentIdx = pins.findIndex((p) => p.id === currentPinId);

  return (
    <div className="border-border/50 bg-card/50 rounded-xl border p-4">
      <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
        {storylineTitle}
      </h4>
      <div className="relative space-y-0">
        {pins.map((pin, i) => {
          const isCurrent = pin.id === currentPinId;
          return (
            <div key={pin.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {/* Vertical line */}
              {i < pins.length - 1 && (
                <div
                  className="absolute top-4 left-[7px] h-full w-0.5"
                  style={{ backgroundColor: isCurrent || i < currentIdx ? color : `${color}33` }}
                />
              )}
              {/* Dot */}
              <div
                className={`relative z-10 mt-0.5 shrink-0 rounded-full border-2 ${isCurrent ? "h-4 w-4" : "h-3 w-3"}`}
                style={{
                  borderColor: color,
                  backgroundColor: isCurrent || i <= currentIdx ? color : "transparent",
                }}
              />
              {/* Content */}
              <button
                onClick={() => !isCurrent && onNavigate?.(pin.id)}
                disabled={isCurrent}
                className={`min-w-0 text-left transition-colors ${
                  isCurrent ? "cursor-default" : "hover:text-foreground cursor-pointer"
                }`}
              >
                <p
                  className={`truncate text-xs leading-tight ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {pin.title}
                </p>
                {pin.ixTimeYear != null && (
                  <p className="text-muted-foreground/70 text-[10px]">
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
        <p className="text-muted-foreground/60 mt-2 text-[10px]">
          Event {currentIdx + 1} of {pins.length}
        </p>
      )}
    </div>
  );
}
