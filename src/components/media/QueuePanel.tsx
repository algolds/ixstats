"use client";

import React from "react";
import { useIxMedia } from "./MediaContext";
import { FacetCard } from "~/components/ui/facet-container";
import { Play, Trash as Trash2, XmarkCircle as XCircle } from "iconoir-react";

export function QueuePanel() {
  const { queue, currentIndex, playTrack, removeFromQueue, clearQueue } = useIxMedia();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider uppercase opacity-70">Up Next</h3>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="flex items-center gap-1 text-xs font-medium text-red-500 transition-colors hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear Queue
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed border-black/10 py-8 text-center text-sm dark:border-white/10">
          Queue is empty
        </div>
      ) : (
        <div className="flex max-h-[250px] flex-col gap-2 overflow-y-auto pr-1">
          {queue.map((track, idx) => {
            const isActive = idx === currentIndex;

            return (
              <FacetCard
                key={`${track.id}-${idx}`}
                className={`flex items-center justify-between gap-3 border p-3 ${
                  isActive ? "border-primary/40 bg-primary/5" : "border-black/5 dark:border-white/5"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {track.coverArt && (
                    <img
                      src={track.coverArt}
                      className="h-10 w-10 flex-shrink-0 rounded object-cover"
                      alt={track.title}
                    />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`truncate text-xs font-bold ${isActive ? "text-primary" : ""}`}
                    >
                      {track.title}
                    </span>
                    <span className="text-muted-foreground truncate text-[10px]">
                      {track.subtitle || "No artist"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {formatTime(track.duration)}
                  </span>

                  {!isActive && (
                    <button
                      onClick={() => playTrack(track)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                      title="Play now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="text-muted-foreground p-1 transition-colors hover:text-red-500"
                    title="Remove from queue"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </FacetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
