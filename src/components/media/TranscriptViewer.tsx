"use client";

import React, { useRef } from "react";
import { useIxMedia } from "~/hooks/useIxMedia";

export function TranscriptViewer() {
  const { activeTrack, currentTime, seekTrack } = useIxMedia();
  const containerRef = useRef<HTMLDivElement>(null);

  if (!activeTrack?.transcript || activeTrack.transcript.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-black/5 pt-4 dark:border-white/5">
      <span className="text-muted-foreground px-1 text-[10px] font-bold tracking-wider uppercase">
        Synchronized Transcript
      </span>
      <div
        ref={containerRef}
        className="flex max-h-48 flex-col gap-1 overflow-y-auto p-0.5 scroll-smooth"
      >
        {activeTrack.transcript.map((seg, idx) => {
          const isActive = currentTime >= seg.startTime && currentTime < seg.endTime;
          return (
            <p
              key={idx}
              ref={isActive ? (el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" }) : null}
              onClick={() => seekTrack(seg.startTime)}
              className={`text-xs leading-relaxed cursor-pointer transition-all duration-300 rounded p-1.5 ${
                isActive
                  ? "bg-primary/10 border-l-2 border-primary pl-2 font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {seg.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
