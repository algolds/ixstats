"use client";

import React from "react";
import { useIxMedia } from "~/hooks/useIxMedia";
import { FacetCard } from "~/components/ui/facet-container";
import { Play, Trash2, XCircle } from "lucide-react";

export function QueuePanel() {
  const { queue, currentIndex, playTrack, removeFromQueue, clearQueue } = useIxMedia();

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider uppercase opacity-70">Up Next</h3>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors font-medium"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear Queue
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg border-black/10 dark:border-white/10">
          Queue is empty
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
          {queue.map((track, idx) => {
            const isActive = idx === currentIndex;

            return (
              <FacetCard
                key={`${track.id}-${idx}`}
                className={`p-3 flex items-center justify-between gap-3 border ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-black/5 dark:border-white/5"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {track.coverArt && (
                    <img
                      src={track.coverArt}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                      alt={track.title}
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-xs font-bold truncate ${isActive ? "text-primary" : ""}`}
                    >
                      {track.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {track.subtitle || "No artist"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatTime(track.duration)}
                  </span>

                  {!isActive && (
                    <button
                      onClick={() => playTrack(track)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      title="Play now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => removeFromQueue(track.id)}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
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
