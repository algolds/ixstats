"use client";

import { useState } from "react";
import { useIxMedia } from "./MediaContext";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { Play, Pause, FastArrowRight as SkipForward, Expand as Maximize2 } from "iconoir-react";
import { FullPlayer } from "./FullPlayer";

export function MiniPlayer() {
  const { activeTrack, isPlaying, currentTime, duration, pauseTrack, resumeTrack, skipNext } =
    useIxMedia();
  const [isFullOpen, setIsFullOpen] = useState(false);

  // WikiOS narration is controlled from the Halo (Dynamic Island → Wiki → Now Playing),
  // not this media bar — don't surface it here.
  if (!activeTrack || activeTrack.isDynamicTts) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div className="z-chrome fixed right-4 bottom-[calc(var(--shell-tabbar-height)+1rem)] left-4 md:right-4 md:left-auto md:w-96">
        <FacetMaterial
          material="regular"
          className="rounded-card shadow-floating relative flex items-center justify-between gap-4 overflow-hidden p-3"
        >
          {/* Top edge progress bar */}
          <div className="bg-fill-3 absolute top-0 right-0 left-0 h-0.5">
            <div className="bg-tint h-full" style={{ width: `${progress}%` }} />
          </div>

          <button
            type="button"
            onClick={() => setIsFullOpen(true)}
            className="group flex min-w-0 cursor-pointer items-center gap-3 text-left"
          >
            {activeTrack.coverArt && (
              <span className="rounded-control-sm relative size-10 flex-shrink-0 overflow-hidden">
                <img src={activeTrack.coverArt} className="h-full w-full object-cover" alt="" />
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-headline text-label duration-fast group-hover:text-tint truncate transition-colors">
                {activeTrack.title}
              </span>
              <span className="text-footnote text-label-secondary truncate">
                {activeTrack.subtitle}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={isPlaying ? pauseTrack : resumeTrack}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={skipNext}
              aria-label="Next"
            >
              <SkipForward aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-label-secondary rounded-full"
              onClick={() => setIsFullOpen(true)}
              title="Maximize"
              aria-label="Maximize"
            >
              <Maximize2 aria-hidden="true" />
            </Button>
          </div>
        </FacetMaterial>
      </div>

      <FullPlayer isOpen={isFullOpen} onClose={() => setIsFullOpen(false)} />
    </>
  );
}
