"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import { OpenBook as BookOpen, Sparks as Sparkles } from "iconoir-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";

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
  isRivalry?: boolean;
  rivalryIntensity?: number;
}

export interface MatchScheduleProps {
  matchday: number;
  matches: ScheduleMatch[];
  title?: string;
  onTeamClick?: (teamId: string) => void;
  expandedMatchId?: string | null;
  onMatchClick?: (matchId: string) => void;
  renderMatchExtension?: (match: ScheduleMatch) => React.ReactNode;
  className?: string;
}

export function MatchSchedule({
  matchday,
  matches,
  title = "Match Schedule",
  onTeamClick,
  expandedMatchId,
  onMatchClick,
  renderMatchExtension,
  className,
}: MatchScheduleProps) {
  const { focusMatch, focusOrganization } = useSportsFocus();

  if (!matches || matches.length === 0) {
    return (
      <div className={cn("text-muted-foreground mx-auto w-full py-8 text-center text-xs font-semibold", className)}>
        No matches scheduled for this round.
      </div>
    );
  }

  const handleMatchRowClick = (matchId: string) => {
    if (onMatchClick) {
      onMatchClick(matchId);
    } else {
      focusMatch(matchId);
    }
  };

  const handleTeamClick = (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    if (onTeamClick) {
      onTeamClick(teamId);
    } else {
      focusOrganization(teamId);
    }
  };

  return (
    <FacetCard
      depth={2}
      className={cn(
        "border-border/40 bg-card/90 mx-auto w-full overflow-hidden rounded-3xl border p-6 shadow-xl backdrop-blur-xl",
        className
      )}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-foreground text-lg font-bold tracking-tight">{title}</h3>
        <span className="bg-muted border-border/30 text-muted-foreground rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider">
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
            <div key={match.id} className="space-y-2">
              <div
                onClick={() => handleMatchRowClick(match.id)}
                data-cuelume-press="subtle"
                className={cn(
                  "facet-hierarchy-child border-border/30 hover:border-border/80 bg-background/50 relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-[0.99]",
                  isExpanded && "border-primary/50 shadow-md ring-1 ring-primary/20",
                  match.isRivalry && "border-amber-500/30 bg-amber-500/5"
                )}
              >
                {/* Left: Home Team */}
                <div className="flex flex-1 items-center justify-start gap-3 min-w-0">
                  <div
                    onClick={(e) => handleTeamClick(e, match.homeTeam.id)}
                    className="flex aspect-square h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 p-0.5 shadow-sm hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${homeColor}15` }}
                  >
                    {match.homeTeam.logo ? (
                      <img
                        src={withBasePath(match.homeTeam.logo)}
                        alt={match.homeTeam.name}
                        className="h-full w-full rounded-full object-contain"
                      />
                    ) : (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: homeColor }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span
                      onClick={(e) => handleTeamClick(e, match.homeTeam.id)}
                      className={cn(
                        "text-xs font-bold tracking-tight truncate block hover:underline",
                        homeOutcome === "win"
                          ? "text-foreground font-black"
                          : homeOutcome === "loss"
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                    >
                      {match.homeTeam.name}
                    </span>
                    {match.homeTeam.wikiSlug && (
                      <Link
                        href={titleToWikiOSPath(match.homeTeam.wikiSlug)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[10px] font-semibold opacity-60 transition hover:opacity-100"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Wiki</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Center: Score / Time */}
                <div className="flex shrink-0 flex-col items-center justify-center px-4">
                  {isCompleted ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-base tabular-nums font-black",
                          homeOutcome === "win" ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {hScore}
                      </span>
                      <span className="text-muted-foreground/50 text-xs font-bold">-</span>
                      <span
                        className={cn(
                          "text-base tabular-nums font-black",
                          awayOutcome === "win" ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {aScore}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
                      VS
                    </span>
                  )}
                  {match.isRivalry && (
                    <span className="mt-1 flex items-center gap-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                      <Sparkles className="h-3 w-3" /> Derby
                    </span>
                  )}
                </div>

                {/* Right: Away Team */}
                <div className="flex flex-1 items-center justify-end gap-3 min-w-0 text-right">
                  <div className="min-w-0">
                    <span
                      onClick={(e) => handleTeamClick(e, match.awayTeam.id)}
                      className={cn(
                        "text-xs font-bold tracking-tight truncate block hover:underline",
                        awayOutcome === "win"
                          ? "text-foreground font-black"
                          : awayOutcome === "loss"
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                    >
                      {match.awayTeam.name}
                    </span>
                    {match.awayTeam.wikiSlug && (
                      <Link
                        href={titleToWikiOSPath(match.awayTeam.wikiSlug)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[10px] font-semibold opacity-60 transition hover:opacity-100 justify-end"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Wiki</span>
                      </Link>
                    )}
                  </div>
                  <div
                    onClick={(e) => handleTeamClick(e, match.awayTeam.id)}
                    className="flex aspect-square h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 p-0.5 shadow-sm hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${awayColor}15` }}
                  >
                    {match.awayTeam.logo ? (
                      <img
                        src={withBasePath(match.awayTeam.logo)}
                        alt={match.awayTeam.name}
                        className="h-full w-full rounded-full object-contain"
                      />
                    ) : (
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: awayColor }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Render Optional Extension */}
              {isExpanded && renderMatchExtension && renderMatchExtension(match)}
            </div>
          );
        })}
      </div>
    </FacetCard>
  );
}

export default MatchSchedule;
