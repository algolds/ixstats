"use client";

import { cn } from "~/lib/utils";
import React from "react";
import { useIxMedia } from "./MediaContext";
import { Card } from "~/components/ui/card";

export function ChapterNavigator() {
  const { activeTrack, currentTime, seekTrack } = useIxMedia();

  if (!activeTrack?.chapters || activeTrack.chapters.length === 0) {
    return null;
  }

  return (
    <div className="border-separator flex flex-col gap-2 border-t pt-4">
      <span className="text-subhead text-label-secondary px-1">Chapters</span>
      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
        {activeTrack.chapters.map((chap, idx) => {
          const isActive = currentTime >= chap.startTime && currentTime < chap.endTime;
          return (
            <Card
              key={idx}
              className={cn(
                "rounded-control text-footnote flex cursor-pointer items-center justify-between p-2",
                isActive ? "border-tint/20 bg-tint-fill text-tint font-medium" : "text-label"
              )}
              onClick={() => seekTrack(chap.startTime)}
              interactive
            >
              <span>{chap.title}</span>
              <span className="text-label-secondary text-footnote tabular-nums">
                {Math.floor(chap.startTime / 60)}:
                {Math.floor(chap.startTime % 60)
                  .toString()
                  .padStart(2, "0")}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
