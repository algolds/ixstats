"use client";

import React, { useRef, useEffect } from "react";
import { useIxMedia } from "~/hooks/useIxMedia";
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
    <div className="flex flex-col gap-2 border-t border-black/5 pt-4 dark:border-white/5">
      <span className="text-muted-foreground px-1 text-[10px] font-bold tracking-wider uppercase">
        Synchronized Transcript
      </span>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto scroll-smooth p-0.5">
        {transcript.map((seg, idx) => {
          const isActive = idx === activeIndex;
          return (
            <FacetCard
              key={idx}
              ref={isActive ? activeRef : null}
              onClick={() => seekTrack(seg.startTime)}
              className={`cursor-pointer rounded border p-1.5 text-xs leading-relaxed transition-all duration-300 ${
                isActive
                  ? "bg-primary/10 border-primary/20 text-primary pl-2 font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {seg.text}
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
}
