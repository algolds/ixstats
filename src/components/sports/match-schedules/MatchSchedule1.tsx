"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";

export interface ScheduleMatch {
  id: string;
  homeTeam: {
    id: string;
    name: string;
    color: string;
    logo?: string | null;
    wikiSlug?: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    color: string;
    logo?: string | null;
    wikiSlug?: string | null;
  };
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  time?: string;
  date?: string;
}

interface MatchSchedule1Props {
  matchday: number;
  matches: ScheduleMatch[];
  title?: string;
  onTeamClick?: (teamId: string) => void;
  expandedMatchId?: string | null;
  onMatchClick?: (matchId: string) => void;
  renderMatchExtension?: (match: ScheduleMatch) => React.ReactNode;
  className?: string;
}

export default function MatchSchedule1({
  matchday,
  matches,
  title = "Match Schedule",
  onTeamClick,
  expandedMatchId,
  onMatchClick,
  renderMatchExtension,
  className,
}: MatchSchedule1Props) {
  if (!matches || matches.length === 0) {
    return (
      <div className={cn("text-muted-foreground mx-auto w-full py-8 text-center", className)}>
        No matches scheduled for this round.
      </div>
    );
  }

  return (
    <FacetCard
      depth={2}
      interactive="hover"
      className={cn(
        "border-border/40 bg-card/90 mx-auto w-full max-w-[550px] overflow-hidden rounded-3xl border p-6 shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-foreground text-lg font-extrabold">{title}</h3>
        <span className="bg-muted border-border/20 text-muted-foreground rounded-full border px-3 py-1 text-xs font-bold uppercase">
          Matchday {matchday}
        </span>
      </div>

      {/* Match Rows */}
      <div className="space-y-3">
        {matches.map((match) => {
          const isCompleted = match.status === "completed";
          const homeColor = match.homeTeam.color ?? "#3b82f6";
          const awayColor = match.awayTeam.color ?? "#ef4444";

          const hScore = match.homeScore ?? 0;
          const aScore = match.awayScore ?? 0;
          const homeOutcome = isCompleted
            ? hScore > aScore
              ? "win"
              : hScore < aScore
                ? "loss"
                : "draw"
            : null;
          const awayOutcome = isCompleted
            ? aScore > hScore
              ? "win"
              : aScore < hScore
                ? "loss"
                : "draw"
            : null;
          const isExpanded = expandedMatchId === match.id;

          return (
            <div key={match.id} className="space-y-1">
              <div
                className={cn(
                  "bg-muted/30 border-border/10 grid grid-cols-[1fr_80px_1fr] items-center gap-4 rounded-2xl border px-4 py-3 transition-colors dark:bg-slate-950/20",
                  isCompleted ? "hover:bg-muted/40 cursor-pointer dark:hover:bg-slate-900/20" : ""
                )}
                onClick={() => {
                  if (isCompleted) {
                    onMatchClick?.(match.id);
                  }
                }}
              >
                {/* Home Team */}
                <div className="flex min-w-0 items-center justify-start gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTeamClick?.(match.homeTeam.id);
                    }}
                    className="group flex min-w-0 cursor-pointer items-center justify-start gap-2 text-left hover:underline"
                  >
                    <div className="border-border/40 bg-background flex aspect-square w-6 shrink-0 items-center justify-center rounded-full border p-0.5 shadow-xs">
                      {match.homeTeam.logo ? (
                        <img
                          src={withBasePath(match.homeTeam.logo)}
                          alt={match.homeTeam.name}
                          className="h-full w-full rounded-full object-contain"
                        />
                      ) : (
                        <svg
                          viewBox="0 0 420 420"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-full w-full transition-transform group-hover:scale-110"
                          style={{ color: homeColor }}
                        >
                          <path
                            d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-foreground truncate text-xs font-bold">
                      {match.homeTeam.name}
                    </span>
                  </button>
                  {match.homeTeam.wikiSlug && (
                    <Link
                      href={titleToWikiOSPath(match.homeTeam.wikiSlug)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex shrink-0 items-center text-cyan-400 hover:text-cyan-300"
                      title={`View ${match.homeTeam.name} Wiki Article`}
                    >
                      <BookOpen className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {/* Center Match State / Score */}
                <div className="flex flex-col items-center justify-center">
                  {isCompleted ? (
                    <div className="bg-muted border-border/20 text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-extrabold tabular-nums">
                      <span className={cn(homeOutcome !== "win" && "font-semibold opacity-75")}>
                        {hScore}
                      </span>
                      <span className="opacity-40">-</span>
                      <span className={cn(awayOutcome !== "win" && "font-semibold opacity-75")}>
                        {aScore}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-muted-foreground text-[10px] font-black tracking-wider uppercase">
                        {match.time ?? "TBD"}
                      </span>
                      {match.date && (
                        <span className="text-muted-foreground mt-0.5 text-[9px] font-semibold whitespace-nowrap">
                          {match.date}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex min-w-0 items-center justify-end gap-1">
                  {match.awayTeam.wikiSlug && (
                    <Link
                      href={titleToWikiOSPath(match.awayTeam.wikiSlug)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex shrink-0 items-center text-cyan-400 hover:text-cyan-300"
                      title={`View ${match.awayTeam.name} Wiki Article`}
                    >
                      <BookOpen className="h-3 w-3" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTeamClick?.(match.awayTeam.id);
                    }}
                    className="group flex min-w-0 cursor-pointer flex-row-reverse items-center justify-end gap-2 text-left hover:underline"
                  >
                    <div className="border-border/40 bg-background flex aspect-square w-6 shrink-0 items-center justify-center rounded-full border p-0.5 shadow-xs">
                      {match.awayTeam.logo ? (
                        <img
                          src={withBasePath(match.awayTeam.logo)}
                          alt={match.awayTeam.name}
                          className="h-full w-full rounded-full object-contain"
                        />
                      ) : (
                        <svg
                          viewBox="0 0 420 420"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-full w-full transition-transform group-hover:scale-110"
                          style={{ color: awayColor }}
                        >
                          <path
                            d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-foreground truncate text-right text-xs font-bold">
                      {match.awayTeam.name}
                    </span>
                  </button>
                </div>
              </div>
              {isExpanded && renderMatchExtension?.(match)}
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}
