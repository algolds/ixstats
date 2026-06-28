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

  if (!activeTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:w-96">
        <FacetContainer
          variant="base"
          depth={3}
          interactive="hover"
          className="relative overflow-hidden flex items-center justify-between gap-4 p-3 border border-black/10 dark:border-white/10 shadow-lg backdrop-blur-md"
        >
          {/* Top edge progress bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-black/5 dark:bg-white/5">
            <div
              className="h-full bg-primary transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            onClick={() => setIsFullOpen(true)}
            className="flex items-center gap-3 min-w-0 cursor-pointer group"
          >
            {activeTrack.coverArt && (
              <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <img
                  src={activeTrack.coverArt}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  alt="Art"
                />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                {activeTrack.title}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {activeTrack.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPlaying ? (
              <button
                onClick={pauseTrack}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={resumeTrack}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={skipNext}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullOpen(true)}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
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
