"use client";

import React, { useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import Link from "next/link";
import { BookOpen } from "lucide-react";

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
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeWikiSlug?: string | null;
  awayWikiSlug?: string | null;
}

interface LatestResults1Props {
  matches: MatchEvent[];
  title?: string;
  onTeamClick?: (teamId: string) => void;
  onMatchClick?: (matchId: string) => void;
  className?: string;
}

export default function LatestResults1({
  matches,
  title = "Latest Results",
  onTeamClick,
  onMatchClick,
  className,
}: LatestResults1Props) {
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
          <h3 className="text-foreground text-muted-foreground text-sm font-extrabold tracking-wider uppercase">
            {title}
          </h3>
          <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase select-none">
            Swipe Up/Down
          </span>
        </div>

        <div className="relative flex gap-4">
          {/* Vertical scroll-snap container */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="hide-scrollbar flex h-[250px] flex-1 snap-y snap-mandatory flex-col gap-0 overflow-y-auto scroll-smooth"
          >
            {visibleMatchDays.map((matchDay) => (
              <div
                key={matchDay}
                className="bg-muted/20 border-border/10 flex h-[250px] w-full shrink-0 snap-start snap-always flex-col overflow-hidden rounded-2xl border dark:bg-slate-950/20"
              >
                <h4 className="bg-muted/50 text-muted-foreground border-border/10 shrink-0 border-b px-4 py-2.5 text-center text-xs font-bold tracking-wider uppercase dark:bg-slate-900/40">
                  Matchday {matchDay}
                </h4>

                <div className="divide-border/10 thin-scrollbar flex-1 divide-y overflow-y-auto bg-transparent">
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
                        onClick={() => onMatchClick?.(match.id)}
                        className={cn(
                          "grid grid-cols-2 gap-x-4 px-4 py-3 text-xs transition-colors hover:bg-white/5",
                          onMatchClick && "cursor-pointer"
                        )}
                      >
                        {/* Home Team */}
                        <div className="flex min-w-0 items-center justify-between pr-2">
                          <div className="flex min-w-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTeamClick?.(match.homeTeamId);
                              }}
                              className="group flex min-w-0 cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left outline-none hover:underline"
                            >
                              {match.homeLogo ? (
                                <img
                                  src={withBasePath(match.homeLogo)}
                                  alt={match.homeTeamName}
                                  className="h-4.5 w-4.5 shrink-0 rounded-full border border-white/10 object-cover transition-transform group-hover:scale-110"
                                />
                              ) : (
                                <svg
                                  viewBox="0 0 420 420"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110"
                                  style={{ color: homeColor }}
                                >
                                  <path
                                    d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              )}
                              <div className="text-foreground truncate text-xs font-bold">
                                <span className="hidden sm:inline">{match.homeTeamName}</span>
                                <span className="inline sm:hidden">
                                  {match.homeShortName ??
                                    match.homeTeamName.slice(0, 3).toUpperCase()}
                                </span>
                              </div>
                            </button>
                            {match.homeWikiSlug && (
                              <Link
                                href={titleToWikiOSPath(match.homeWikiSlug)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex shrink-0 items-center text-cyan-400 hover:text-cyan-300"
                                title={`View ${match.homeTeamName} Wiki Article`}
                              >
                                <BookOpen className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                          <div className="text-foreground ml-1 flex shrink-0 items-center gap-1.5 text-xs font-extrabold">
                            {homeOutcome === "win" && (
                              <div className="h-0 w-0 border-[4px] border-e-0 border-purple-500 border-y-transparent"></div>
                            )}
                            <span
                              className={cn(homeOutcome !== "win" && "font-semibold opacity-70")}
                            >
                              {hScore}
                            </span>
                          </div>
                        </div>

                        {/* Away Team */}
                        <div className="border-border/10 flex min-w-0 flex-row-reverse items-center justify-between border-l pl-2">
                          <div className="flex min-w-0 flex-row-reverse items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTeamClick?.(match.awayTeamId);
                              }}
                              className="group flex min-w-0 cursor-pointer flex-row-reverse items-center gap-2 border-none bg-transparent p-0 text-left outline-none hover:underline"
                            >
                              {match.awayLogo ? (
                                <img
                                  src={withBasePath(match.awayLogo)}
                                  alt={match.awayTeamName}
                                  className="h-4.5 w-4.5 shrink-0 rounded-full border border-white/10 object-cover transition-transform group-hover:scale-110"
                                />
                              ) : (
                                <svg
                                  viewBox="0 0 420 420"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110"
                                  style={{ color: awayColor }}
                                >
                                  <path
                                    d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              )}
                              <div className="text-foreground truncate text-xs font-bold">
                                <span className="hidden sm:inline">{match.awayTeamName}</span>
                                <span className="inline sm:hidden">
                                  {match.awayShortName ??
                                    match.awayTeamName.slice(0, 3).toUpperCase()}
                                </span>
                              </div>
                            </button>
                            {match.awayWikiSlug && (
                              <Link
                                href={titleToWikiOSPath(match.awayWikiSlug)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex shrink-0 items-center text-cyan-400 hover:text-cyan-300"
                                title={`View ${match.awayTeamName} Wiki Article`}
                              >
                                <BookOpen className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                          <div className="text-foreground mr-1 flex shrink-0 flex-row-reverse items-center gap-1.5 text-xs font-extrabold">
                            {awayOutcome === "win" && (
                              <div className="h-0 w-0 border-[4px] border-s-0 border-purple-500 border-y-transparent"></div>
                            )}
                            <span
                              className={cn(awayOutcome !== "win" && "font-semibold opacity-70")}
                            >
                              {aScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Vertical Dots Navigation Indicators */}
          {visibleMatchDays.length > 1 && (
            <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 select-none">
              {visibleMatchDays.map((_, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      containerRef.current?.scrollTo({
                        top: idx * 250,
                        behavior: "smooth",
                      });
                    }}
                    className={cn(
                      "w-1.5 cursor-pointer rounded-full border-none transition-all duration-300 outline-none",
                      isActive
                        ? "h-4 bg-purple-500 shadow-lg shadow-purple-500/30"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50 h-1.5"
                    )}
                    aria-label={`Go to Matchday ${visibleMatchDays[idx]}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </FacetCard>
    </div>
  );
}
