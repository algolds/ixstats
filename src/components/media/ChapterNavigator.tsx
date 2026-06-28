"use client";

import React from "react";
import { useIxMedia } from "~/hooks/useIxMedia";
import { FacetCard } from "~/components/ui/facet-container";

export function ChapterNavigator() {
  const { activeTrack, currentTime, seekTrack } = useIxMedia();

  if (!activeTrack?.chapters || activeTrack.chapters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-black/5 pt-4 dark:border-white/5">
      <span className="text-muted-foreground px-1 text-[10px] font-bold tracking-wider uppercase">
        Chapters
      </span>
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        {activeTrack.chapters.map((chap, idx) => {
          const isActive = currentTime >= chap.startTime && currentTime < chap.endTime;
          return (
            <FacetCard
              key={idx}
              className={`flex cursor-pointer items-center justify-between rounded p-2 text-xs ${isActive ? "bg-primary/10 border-primary/20 text-primary font-medium" : "text-foreground"}`}
              onClick={() => seekTrack(chap.startTime)}
            >
              <span>{chap.title}</span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {Math.floor(chap.startTime / 60)}:{Math.floor(chap.startTime % 60).toString().padStart(2, "0")}
              </span>
            </FacetCard>
          );
        })}
      </div>
    </div>
  );
}
