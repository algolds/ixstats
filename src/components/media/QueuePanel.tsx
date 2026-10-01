"use client";

import { cn } from "~/lib/utils";
import React from "react";
import { useIxMediaActions, useIxMediaState } from "./MediaContext";
import { FacetCard } from "~/components/ui/facet-container";
import { Play, Trash as Trash2, XmarkCircle as XCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";

export function QueuePanel() {
  const { queue, currentIndex } = useIxMediaState();
  const { playTrack, removeFromQueue, clearQueue } = useIxMediaActions();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-subhead text-label-secondary">Up Next</h3>
        {queue.length > 0 && (
          <Button
            variant="plain"
            size="sm"
            onClick={clearQueue}
            className="text-red hover:bg-red/10"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear Queue
          </Button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="text-label-secondary rounded-control border-separator text-body border border-dashed py-8 text-center">
          Queue is empty
        </div>
      ) : (
        <div className="flex max-h-[250px] flex-col gap-2 overflow-y-auto pr-1">
          {queue.map((track, idx) => {
            const isActive = idx === currentIndex;

            return (
              <FacetCard
                key={`${track.id}-${idx}`}
                className={cn(
                  "flex items-center justify-between gap-3 border p-3",
                  isActive ? "border-tint/40 bg-tint-fill" : "border-separator"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {track.coverArt && (
                    <img
                      src={track.coverArt}
                      className="rounded-control-sm size-10 flex-shrink-0 object-cover"
                      alt={track.title}
                    />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "text-headline truncate",
                        isActive ? "text-tint" : "text-label"
                      )}
                    >
                      {track.title}
                    </span>
                    <span className="text-label-secondary text-footnote truncate">
                      {track.subtitle || "No artist"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {formatTime(track.duration)}
                  </span>

                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Play now"
                      onClick={() => playTrack(track)}
                      title="Play now"
                      className="text-label-secondary"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove from queue"
                    onClick={() => removeFromQueue(idx)}
                    title="Remove from queue"
                    className="text-label-secondary hover:text-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </FacetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
