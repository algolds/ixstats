"use client";

import { cn } from "~/lib/utils";
import React, { useRef, useEffect } from "react";
import { useIxMedia } from "./MediaContext";
import { FacetCard } from "~/components/ui/facet-container";

export function TranscriptViewer() {
  const { activeTrack, currentTime, seekTrack } = useIxMedia();
  const activeRef = useRef<HTMLDivElement>(null);

  const transcript = activeTrack?.transcript || [];

  // Determine the index of the currently active segment
  const activeIndex = transcript.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
  );

  // Smooth scroll to the active segment ONLY when the active index changes
  useEffect(() => {
    if (activeIndex !== -1 && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeIndex]);

  if (transcript.length === 0) {
    return null;
  }

  return (
    <div className="border-separator flex flex-col gap-2 border-t pt-4">
      <span className="text-subhead text-label-secondary px-1">Synchronized Transcript</span>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto scroll-smooth p-0.5">
        {transcript.map((seg, idx) => {
          const isActive = idx === activeIndex;
          return (
            <FacetCard
              key={idx}
              ref={isActive ? activeRef : null}
              onClick={() => seekTrack(seg.startTime)}
              className={cn(
                "rounded-control-sm text-footnote duration-fast cursor-pointer border p-1.5 leading-relaxed transition-colors",
                isActive
                  ? "border-tint/20 bg-tint-fill text-tint pl-2 font-medium"
                  : "text-label-secondary hover:bg-fill-4 hover:text-label border-transparent"
              )}
            >
              {seg.text}
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
}
