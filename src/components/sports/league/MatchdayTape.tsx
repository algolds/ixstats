"use client";

import React, { useRef } from "react";
import { soundEffects } from "~/lib/sound/cuelume";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

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

export interface MatchdayTapeProps {
  matches: MatchdayTapeItem[];
  matchDay?: number | null;
  onMatchClick: (matchId: string) => void;
  className?: string;
}

export function MatchdayTape({
  matches,
  matchDay,
  onMatchClick,
  className,
}: MatchdayTapeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (matches.length === 0) {
    return null;
  }

  const handleCardClick = (matchId: string) => {
    soundEffects.press();
    onMatchClick(matchId);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl p-3 shadow-md", className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Round Matches
          </span>
          {matchDay && (
            <Badge variant="outline" className="border-border/50 text-[9px] font-bold px-1.5 py-0">
              Round {matchDay}
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-semibold">
          {matches.length} Matches
        </span>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {matches.map((match) => {
          const isCompleted = match.status === "completed";
          const isScheduled = match.status === "scheduled";

          return (
            <div
              key={match.id}
              onClick={() => handleCardClick(match.id)}
              data-cuelume-press="subtle"
              className={cn(
                "group flex min-w-[200px] shrink-0 items-center justify-between rounded-xl border border-border/40 bg-card/70 px-3 py-2 text-xs shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-muted/30 cursor-pointer active:scale-[0.98]",
                "snap-start"
              )}
            >
              {/* Home Team */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="h-6 w-6 rounded-lg overflow-hidden border border-border/30 bg-muted/40 shrink-0 flex items-center justify-center">
                  {match.homeTeam.logo ? (
                    <img src={match.homeTeam.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold">🏠</span>
                  )}
                </div>
                <span className="font-bold text-foreground truncate text-[11px]">
                  {match.homeTeam.shortName ?? match.homeTeam.name}
                </span>
              </div>

              {/* Score / Status */}
              <div className="mx-2 flex flex-col items-center justify-center shrink-0">
                {isCompleted ? (
                  <div className="flex items-center gap-1 font-mono font-black text-xs text-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
                    <span>{match.homeScore ?? 0}</span>
                    <span className="text-muted-foreground/50">:</span>
                    <span>{match.awayScore ?? 0}</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                    VS
                  </span>
                )}
                <span
                  className={cn(
                    "text-[8px] font-extrabold uppercase tracking-tighter mt-0.5",
                    isCompleted ? "text-emerald-400" : isScheduled ? "text-blue-400" : "text-amber-400"
                  )}
                >
                  {isCompleted ? "FT" : isScheduled ? "SCHED" : "LIVE"}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                <span className="font-bold text-foreground truncate text-[11px]">
                  {match.awayTeam.shortName ?? match.awayTeam.name}
                </span>
                <div className="h-6 w-6 rounded-lg overflow-hidden border border-border/30 bg-muted/40 shrink-0 flex items-center justify-center">
                  {match.awayTeam.logo ? (
                    <img src={match.awayTeam.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold">✈️</span>
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

export default MatchdayTape;
