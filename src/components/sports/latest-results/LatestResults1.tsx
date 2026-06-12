"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";

interface MatchEvent {
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
}

interface LatestResults1Props {
  matches: MatchEvent[];
  title?: string;
  onTeamClick?: (teamId: string) => void;
  className?: string;
}

export default function LatestResults1({
  matches,
  title = "Latest Results",
  onTeamClick,
  className,
}: LatestResults1Props) {
  // Filter only completed matches
  const completedMatches = matches.filter((m) => m.status === "completed");

  if (completedMatches.length === 0) {
    return (
      <div className={cn("mx-auto w-full px-5 text-center py-8 text-muted-foreground", className)}>
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

  return (
    <div className={cn("mx-auto w-full px-2 sm:w-[500px]", className)}>
      <FacetCard
        depth={2}
        interactive="hover"
        className="rounded-3xl border border-border/40 bg-card/90 shadow-xl overflow-hidden p-6"
      >
        <div className="mb-4">
          <h3 className="text-lg font-extrabold text-foreground">
            {title}
          </h3>
        </div>
        <div className="overflow-hidden rounded-2xl flex flex-col gap-4">
          {sortedMatchDays.slice(0, 3).map((matchDay) => (
            <div
              key={matchDay}
              className="rounded-2xl bg-muted/30 border border-border/20 dark:bg-slate-950/20 overflow-hidden"
            >
              <h4 className="bg-muted/50 dark:bg-slate-900/40 px-5 py-3 text-center text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Matchday {matchDay}
              </h4>
              <div className="bg-transparent divide-y divide-border/20">
                {groupedByMatchDay[matchDay].map((match) => {
                  const hScore = match.homeScore ?? 0;
                  const aScore = match.awayScore ?? 0;
                  const homeOutcome = hScore > aScore ? "win" : hScore < aScore ? "loss" : "draw";
                  const awayOutcome = aScore > hScore ? "win" : aScore < hScore ? "loss" : "draw";

                  const homeColor = match.homeColor ?? "#3b82f6";
                  const awayColor = match.awayColor ?? "#ef4444";

                  return (
                    <div
                      key={match.id}
                      className="grid grid-cols-2 gap-x-4 px-5 py-3.5 hover:bg-muted/40 dark:hover:bg-slate-900/20 transition-colors"
                    >
                      {/* Home Team */}
                      <div className="flex items-center justify-between min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => onTeamClick?.(match.homeTeamId)}
                          className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer group"
                        >
                          <svg
                            viewBox="0 0 420 420"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                            style={{ color: homeColor }}
                          >
                            <path
                              d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                              fill="currentColor"
                            />
                          </svg>
                          <div className="truncate text-xs font-bold text-foreground">
                            <span className="hidden sm:inline">{match.homeTeamName}</span>
                            <span className="inline sm:hidden">{match.homeShortName ?? match.homeTeamName.slice(0, 3).toUpperCase()}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground shrink-0 ml-1">
                          {homeOutcome === "win" && (
                            <div className="h-0 w-0 border-[4px] border-custom-blue border-y-transparent border-e-0"></div>
                          )}
                          <span className={cn(homeOutcome !== "win" && "opacity-75 font-semibold")}>{hScore}</span>
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center justify-between min-w-0 pl-2 flex-row-reverse border-l border-border/20">
                        <button
                          type="button"
                          onClick={() => onTeamClick?.(match.awayTeamId)}
                          className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer group flex-row-reverse"
                        >
                          <svg
                            viewBox="0 0 420 420"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110"
                            style={{ color: awayColor }}
                          >
                            <path
                              d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                              fill="currentColor"
                            />
                          </svg>
                          <div className="truncate text-xs font-bold text-foreground">
                            <span className="hidden sm:inline">{match.awayTeamName}</span>
                            <span className="inline sm:hidden">{match.awayShortName ?? match.awayTeamName.slice(0, 3).toUpperCase()}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground shrink-0 mr-1 flex-row-reverse">
                          {awayOutcome === "win" && (
                            <div className="h-0 w-0 border-[4px] border-custom-blue border-y-transparent border-s-0"></div>
                          )}
                          <span className={cn(awayOutcome !== "win" && "opacity-75 font-semibold")}>{aScore}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </FacetCard>
    </div>
  );
}
