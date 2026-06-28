"use client";

import React, { useState } from "react";
import { useIxMedia } from "~/hooks/useIxMedia";
import { FacetContainer } from "~/components/ui/facet-container";
import { Play, Pause, SkipForward, Maximize2 } from "lucide-react";
import { FullPlayer } from "./FullPlayer";

export function MiniPlayer() {
  const { activeTrack, isPlaying, currentTime, duration, pauseTrack, resumeTrack, skipNext } =
    useIxMedia();
  const [isFullOpen, setIsFullOpen] = useState(false);

  // WikiOS narration has its own floating Halo pill (WikiOSNarratorPlayer); don't
  // double up at the bottom of the screen.
  if (!activeTrack || activeTrack.isDynamicTts) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div className="fixed right-4 bottom-4 left-4 z-40 md:right-4 md:left-auto md:w-96">
        <FacetContainer
          variant="base"
          depth={3}
          interactive="hover"
          className="relative flex items-center justify-between gap-4 overflow-hidden border border-black/10 p-3 shadow-lg backdrop-blur-md dark:border-white/10"
        >
          {/* Top edge progress bar */}
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-black/5 dark:bg-white/5">
            <div
              className="bg-primary h-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            onClick={() => setIsFullOpen(true)}
            className="group flex min-w-0 cursor-pointer items-center gap-3"
          >
            {activeTrack.coverArt && (
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                <img
                  src={activeTrack.coverArt}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  alt="Art"
                />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="group-hover:text-primary truncate text-xs font-bold transition-colors">
                {activeTrack.title}
              </span>
              <span className="text-muted-foreground truncate text-[10px]">
                {activeTrack.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPlaying ? (
              <button
                onClick={pauseTrack}
                className="rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={resumeTrack}
                className="rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={skipNext}
              className="rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullOpen(true)}
              className="text-muted-foreground hover:text-foreground rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </FacetContainer>
      </div>

      <FullPlayer isOpen={isFullOpen} onClose={() => setIsFullOpen(false)} />
    </>
  );
}
