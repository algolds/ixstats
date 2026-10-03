"use client";

import React, { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Trophy,
  Play,
  SystemRestart as Loader2,
  Activity,
  FireFlame as Flame,
  Calendar,
  ArrowRight,
  Shield,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { NextMatchCountdown } from "~/components/sports/league/NextMatchCountdown";
import { LatestResults, type MatchEvent } from "~/components/sports/LatestResults";
import { StandingsTable, type StandingsRow } from "~/components/sports/StandingsTable";
import type { SportsNavSection } from "~/components/sports/core/SportsSidebarNav";
import { cn } from "~/lib/utils";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Card } from "~/components/ui/card";

interface StandingLeader {
  teamId: string;
  position?: number | null;
  wins: number;
  losses: number;
  draws?: number | null;
  points: number;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  team: {
    id: string;
    name: string;
    logo?: string | null;
    color?: string | null;
  };
}

interface LeagueOverviewTabProps {
  leagueId: string;
  activeSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
  } | null;
  latestSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
    champion?: {
      id: string;
      name: string;
    } | null;
  } | null;
  standings?: StandingLeader[];
  standingsLoading?: boolean;
  latestResultsMatches: MatchEvent[];
  nextMatchDay?: number | null;
  nextMatchIxTime?: number | null;
  onNavigate: (section: SportsNavSection) => void;
  onTeamClick: (teamId: string) => void;
  onMatchClick: (matchId: string) => void;
  onSimulateMatchDay: (seasonId: string, matchDay: number) => void;
  isSimulatingMatchDay?: boolean;
  onTransitionSeason?: (seasonId: string) => void;
  isTransitioningSeason?: boolean;
  onStartSeason?: (leagueId: string) => void;
  isStartingSeason?: boolean;
}

export function LeagueOverviewTab({
  leagueId,
  activeSeason,
  latestSeason,
  standings,
  standingsLoading,
  latestResultsMatches,
  nextMatchDay,
  nextMatchIxTime,
  onNavigate,
  onTeamClick,
  onMatchClick,
  onSimulateMatchDay,
  isSimulatingMatchDay,
  onTransitionSeason,
  isTransitioningSeason,
  onStartSeason,
  isStartingSeason,
}: LeagueOverviewTabProps) {
  const topContenders = standings?.slice(0, 3) ?? [];
  const leaderPoints = topContenders[0]?.points ?? 0;

  const standingsRows: StandingsRow[] = useMemo(() => {
    return (standings ?? []).map((s, idx) => ({
      id: s.teamId,
      teamId: s.teamId,
      teamName: s.team.name,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws ?? 0,
      points: s.points,
      pointsFor: s.pointsFor ?? 0,
      pointsAgainst: s.pointsAgainst ?? 0,
      rank: s.position ?? idx + 1,
      color: s.team.color ?? undefined,
      logo: s.team.logo,
    }));
  }, [standings]);

  const handleSimulate = () => {
    if (!activeSeason || !nextMatchDay) return;
    onSimulateMatchDay(activeSeason.id, nextMatchDay);
  };

  return (
    <div className="space-y-8">
      {/* SPLIT COCKPIT (OPTION A) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3 Column: Standings Table */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-subhead text-label-secondary flex items-center gap-2">
              <Trophy className="text-yellow size-4" aria-hidden />
              Standings
            </h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("standings")}>
              <span>Full table</span>
              <ArrowRight />
            </Button>
          </div>

          {standingsLoading ? (
            <Card padding="lg" className="space-y-2">
              <Skeleton className="rounded-row h-8 w-full" />
              <Skeleton className="rounded-row h-8 w-full" />
              <Skeleton className="rounded-row h-8 w-full" />
              <Skeleton className="rounded-row h-8 w-full" />
              <Skeleton className="rounded-row h-8 w-full" />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <StandingsTable standings={standingsRows.slice(0, 8)} onTeamClick={onTeamClick} />
            </Card>
          )}
        </div>

        {/* Right 1/3 Column: Next Round & Top Teams */}
        <div className="space-y-6">
          {/* Next Up / Simulation Card */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Next round</Eyebrow>
              <Badge variant={activeSeason ? "success" : "default"}>
                {activeSeason ? `Round ${nextMatchDay ?? 1}` : "Completed"}
              </Badge>
            </div>

            {activeSeason ? (
              <div className="space-y-3">
                <h3 className="text-headline text-label">
                  {nextMatchDay ? `Round ${nextMatchDay}` : "Championship"}
                </h3>
                <p className="text-callout text-label-secondary">
                  Simulate matches for this round to update standings and results.
                </p>

                {nextMatchIxTime && (
                  <div className="pt-1">
                    <NextMatchCountdown targetIxTime={nextMatchIxTime} />
                  </div>
                )}

                <Button
                  onClick={handleSimulate}
                  disabled={isSimulatingMatchDay}
                  size="lg"
                  className="w-full"
                >
                  {isSimulatingMatchDay ? (
                    <>
                      <Loader2 className="animate-spin" />
                      <span>Simulating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="fill-current" />
                      <span>Simulate Round (Space)</span>
                    </>
                  )}
                </Button>
              </div>
            ) : latestSeason?.status === "completed" ? (
              <div className="space-y-3">
                <div className="text-headline text-yellow flex items-center gap-2">
                  <Trophy className="size-4 shrink-0" aria-hidden />
                  <span>Season {latestSeason.seasonNumber} Completed</span>
                </div>
                <p className="text-footnote text-label-secondary">
                  Won by {latestSeason.champion?.name ?? "Champion"}. Advance to start the next
                  season.
                </p>
                {onTransitionSeason && (
                  <Button
                    onClick={() => onTransitionSeason(latestSeason.id)}
                    disabled={isTransitioningSeason}
                    className="w-full"
                  >
                    {isTransitioningSeason ? (
                      <>
                        <Loader2 className="animate-spin" />
                        <span>Starting Season...</span>
                      </>
                    ) : (
                      <span>Start next season</span>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-footnote text-label-secondary">
                  Start Season 1 to generate the schedule and standings.
                </p>
                {onStartSeason && (
                  <Button
                    onClick={() => onStartSeason(leagueId)}
                    disabled={isStartingSeason}
                    className="w-full"
                  >
                    {isStartingSeason ? (
                      <>
                        <Loader2 className="animate-spin" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Play className="fill-current" />
                        <span>Start Season 1</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Top Teams */}
          {topContenders.length > 0 && (
            <Card padding="md" className="space-y-3">
              <h3 className="text-subhead text-label-secondary flex items-center gap-2">
                <Flame className="text-orange size-4" aria-hidden />
                Top teams
              </h3>

              <FacetListSection variant="plain" aria-label="Top teams">
                {topContenders.map((contender, idx) => {
                  const ptsGap = contender.points - leaderPoints;
                  return (
                    <FacetRow
                      key={contender.team.id}
                      onClick={() => onTeamClick(contender.teamId)}
                      itemClassName={cn("rounded-row overflow-hidden", idx === 0 && "bg-yellow/10")}
                      leading={
                        <span className="flex items-center gap-2">
                          <span className="text-footnote text-label-secondary w-4 text-center font-semibold tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="border-separator bg-surface rounded-control-sm flex size-7 shrink-0 items-center justify-center overflow-hidden border">
                            {contender.team.logo ? (
                              <img
                                src={withBasePath(contender.team.logo)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Shield className="text-label-secondary size-3.5" aria-hidden />
                            )}
                          </span>
                        </span>
                      }
                      title={
                        <span className="text-footnote block truncate font-medium">
                          {contender.team.name}
                        </span>
                      }
                      trailing={
                        <span className="shrink-0 text-right">
                          <span className="text-footnote text-label block font-semibold tabular-nums">
                            {contender.points} pts
                          </span>
                          {idx > 0 && (
                            <span className="text-footnote text-label-secondary block tabular-nums">
                              {ptsGap} pts
                            </span>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </FacetListSection>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Results */}
      <section className="border-separator space-y-4 border-t pt-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-subhead text-label-secondary flex items-center gap-2">
            <Activity className="size-4" aria-hidden />
            Recent results
          </h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("schedule")}>
            <span>Full schedule</span>
            <ArrowRight />
          </Button>
        </div>

        {latestResultsMatches.length > 0 ? (
          <LatestResults
            matches={latestResultsMatches}
            onTeamClick={onTeamClick}
            onMatchClick={onMatchClick}
          />
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Calendar />}
              title="No matches played yet"
              message="Simulate a round above to view match results."
            />
          </Card>
        )}
      </section>
    </div>
  );
}
