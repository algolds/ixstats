"use client";

import React, { useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import Link from "next/link";
import { OpenBook as BookOpen } from "iconoir-react";

export interface MatchEvent {
  id: string;
  matchDay: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  homeColor?: string;
  awayColor?: string;
  homeShortName?: string | null;
  awayShortName?: string | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeWikiSlug?: string | null;
  awayWikiSlug?: string | null;
}

export interface LatestResultsProps {
  matches: MatchEvent[];
  title?: string;
  onTeamClick?: (teamId: string) => void;
  onMatchClick?: (matchId: string) => void;
  className?: string;
}

export function LatestResults({
  matches,
  title = "Latest Results",
  onTeamClick,
  onMatchClick,
  className,
}: LatestResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter only completed matches
  const completedMatches = matches.filter((m) => m.status === "completed");

  if (completedMatches.length === 0) {
    return (
      <div className={cn("text-muted-foreground mx-auto w-full px-5 py-8 text-center", className)}>
        No results simulated yet.
      </div>
    );
  }

  // Group matches by matchDay
  const groupedByMatchDay = completedMatches.reduce<Record<number, MatchEvent[]>>((acc, match) => {
    if (!acc[match.matchDay]) {
      acc[match.matchDay] = [];
    }
    acc[match.matchDay].push(match);
    return acc;
  }, {});

  // Sort matchDays descending to show latest first
  const sortedMatchDays = Object.keys(groupedByMatchDay)
    .map(Number)
    .sort((a, b) => b - a);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, clientHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    }
  };

  const visibleMatchDays = sortedMatchDays.slice(0, 10); // Show up to latest 10 matchdays

  return (
    <div className={cn("mx-auto w-full px-2 sm:w-[500px]", className)}>
      <FacetCard
        depth={2}
        interactive="hover"
        className="border-border/40 bg-card/90 relative overflow-hidden rounded-3xl border p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {title}
          </h3>
          <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase select-none">
            Swipe Up/Down
          </span>
        </div>

        {/* Scrollable Container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="no-scrollbar h-[380px] snap-y snap-mandatory overflow-y-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {visibleMatchDays.map((matchDay) => {
            const dayMatches = groupedByMatchDay[matchDay] || [];
            return (
              <div
                key={matchDay}
                className="flex h-[380px] snap-start flex-col justify-between py-2"
              >
                {/* Match Day Indicator */}
                <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-foreground text-sm font-bold tracking-tight">
                    Matchday {matchDay}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {dayMatches.length} Matches
                  </span>
                </div>

                {/* Match List for this Day */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {dayMatches.map((match) => {
                    const homeColor = match.homeColor || "#3b82f6";
                    const awayColor = match.awayColor || "#ef4444";
                    const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);
                    const awayWon = (match.awayScore ?? 0) > (match.homeScore ?? 0);

                    return (
                      <div
                        key={match.id}
                        onClick={() => onMatchClick?.(match.id)}
                        className={cn(
                          "bg-muted/40 hover:bg-muted/70 flex items-center justify-between rounded-xl p-2.5 transition-colors",
                          onMatchClick && "cursor-pointer"
                        )}
                      >
                        {/* Home Team */}
                        <div className="flex flex-1 items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTeamClick?.(match.homeTeamId);
                            }}
                            className="group flex items-center gap-2 text-left hover:underline"
                          >
                            <div className="border-border/40 bg-background flex aspect-square w-7 shrink-0 items-center justify-center rounded-full border p-0.5 shadow-sm">
                              {match.homeLogo ? (
                                <img
                                  src={withBasePath(match.homeLogo)}
                                  alt={match.homeTeamName}
                                  className="h-full w-full rounded-full object-contain"
                                />
                              ) : (
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: homeColor }}
                                />
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-semibold tracking-tight",
                                homeWon ? "text-foreground font-bold" : "text-muted-foreground"
                              )}
                            >
                              {match.homeShortName || match.homeTeamName}
                            </span>
                          </button>
                          {match.homeWikiSlug && (
                            <Link
                              href={titleToWikiOSPath(match.homeWikiSlug)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground opacity-60 transition-opacity hover:opacity-100"
                              title={`Wiki: ${match.homeTeamName}`}
                            >
                              <BookOpen className="h-3 w-3" />
                            </Link>
                          )}
                        </div>

                        {/* Scores */}
                        <div className="bg-background/80 border-border/30 mx-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 shadow-inner">
                          <span
                            className={cn(
                              "text-xs font-bold tabular-nums",
                              homeWon ? "text-foreground font-extrabold" : "text-muted-foreground"
                            )}
                          >
                            {match.homeScore ?? "-"}
                          </span>
                          <span className="text-muted-foreground/40 text-[10px]">:</span>
                          <span
                            className={cn(
                              "text-xs font-bold tabular-nums",
                              awayWon ? "text-foreground font-extrabold" : "text-muted-foreground"
                            )}
                          >
                            {match.awayScore ?? "-"}
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-1 items-center justify-end gap-2">
                          {match.awayWikiSlug && (
                            <Link
                              href={titleToWikiOSPath(match.awayWikiSlug)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground opacity-60 transition-opacity hover:opacity-100"
                              title={`Wiki: ${match.awayTeamName}`}
                            >
                              <BookOpen className="h-3 w-3" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTeamClick?.(match.awayTeamId);
                            }}
                            className="group flex items-center gap-2 text-right hover:underline"
                          >
                            <span
                              className={cn(
                                "text-xs font-semibold tracking-tight",
                                awayWon ? "text-foreground font-bold" : "text-muted-foreground"
                              )}
                            >
                              {match.awayShortName || match.awayTeamName}
                            </span>
                            <div className="border-border/40 bg-background flex aspect-square w-7 shrink-0 items-center justify-center rounded-full border p-0.5 shadow-sm">
                              {match.awayLogo ? (
                                <img
                                  src={withBasePath(match.awayLogo)}
                                  alt={match.awayTeamName}
                                  className="h-full w-full rounded-full object-contain"
                                />
                              ) : (
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: awayColor }}
                                />
                              )}
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Swipe Pagination Dots */}
        {visibleMatchDays.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {visibleMatchDays.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  activeIndex === idx ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5"
                )}
              />
            ))}
          </div>
        )}
      </FacetCard>
    </div>
  );
}

export default LatestResults;
