"use client";

import React, { useRef } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Airplane, Home } from "iconoir-react";

export interface MatchdayTapeItem {
  id: string;
  matchDay?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  homeTeam: {
    id: string;
    name: string;
    shortName?: string | null;
    logo?: string | null;
    color?: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName?: string | null;
    logo?: string | null;
    color?: string | null;
  };
}

interface MatchdayTapeProps {
  matches: MatchdayTapeItem[];
  matchDay?: number | null;
  onMatchClick: (matchId: string) => void;
  className?: string;
}

export function MatchdayTape({ matches, matchDay, onMatchClick, className }: MatchdayTapeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (matches.length === 0) {
    return null;
  }

  const handleCardClick = (matchId: string) => {
    onMatchClick(matchId);
  };

  return (
    <div
      className={cn(
        "rounded-card border-separator bg-surface shadow-card relative overflow-hidden border p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-eyebrow text-label-secondary">Round matches</span>
          {matchDay && (
            <Badge
              variant="outline"
              className="border-separator text-footnote px-2 py-0 font-semibold"
            >
              Round {matchDay}
            </Badge>
          )}
        </div>
        <span className="text-footnote text-label-secondary font-semibold">
          {matches.length} Matches
        </span>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex scrollbar-none items-center gap-3 overflow-x-auto pb-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {matches.map((match) => {
          const isCompleted = match.status === "completed";
          const isScheduled = match.status === "scheduled";

          return (
            <div
              key={match.id}
              onClick={() => handleCardClick(match.id)}
              className={cn(
                "group rounded-row border-separator bg-surface text-footnote shadow-card hover:border-tint/50 hover:bg-fill-4 flex min-w-[200px] shrink-0 cursor-pointer items-center justify-between border px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-[0.98]",
                "snap-start"
              )}
            >
              {/* Home Team */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="rounded-control border-separator bg-fill-3 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border">
                  {match.homeTeam.logo ? (
                    <img src={match.homeTeam.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
                <span className="text-label text-footnote truncate font-semibold">
                  {match.homeTeam.shortName ?? match.homeTeam.name}
                </span>
              </div>

              {/* Score / Status */}
              <div className="mx-2 flex shrink-0 flex-col items-center justify-center">
                {isCompleted ? (
                  <div className="text-footnote text-label bg-fill-3 rounded-control-sm flex items-center gap-1 px-2 py-0.5 font-semibold tabular-nums">
                    <span>{match.homeScore ?? 0}</span>
                    <span className="text-label-tertiary">:</span>
                    <span>{match.awayScore ?? 0}</span>
                  </div>
                ) : (
                  <span className="text-eyebrow text-label-secondary">VS</span>
                )}
                <span
                  className={cn(
                    "text-eyebrow mt-0.5",
                    isCompleted ? "text-green" : isScheduled ? "text-blue" : "text-yellow"
                  )}
                >
                  {isCompleted ? "FT" : isScheduled ? "SCHED" : "LIVE"}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                <span className="text-label text-footnote truncate font-semibold">
                  {match.awayTeam.shortName ?? match.awayTeam.name}
                </span>
                <div className="rounded-control border-separator bg-fill-3 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border">
                  {match.awayTeam.logo ? (
                    <img src={match.awayTeam.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Airplane className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
