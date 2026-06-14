"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { StandingsTable } from "~/components/myleague/StandingsTable";
import { ScheduleView } from "~/components/myleague/ScheduleView";
import { BracketView } from "~/components/myleague/BracketView";
import { RaceResults } from "~/components/myleague/RaceResults";
import { DraftPicksView } from "~/components/myleague/DraftPicksView";
// eslint-disable-next-line unused-imports/no-unused-imports
import { ArrowLeft, Play, FastForward, Trophy, Calendar, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface SimulationHubTabProps {
  seasonId: string;
  leagueId: string;
  sportPreset: string;
  archetype: string;
  promotionCount?: number;
  relegationCount?: number;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onSeasonTransition?: (newSeasonId: string) => void;
}

function findNextScheduledMatchDay(
  season: NonNullable<ReturnType<typeof api.sports.getSeason.useQuery>["data"]>
): number | null {
  const scheduledMatches = season.matches.filter((m) => m.status === "scheduled");
  if (scheduledMatches.length === 0) return null;
  const days = [...new Set(scheduledMatches.map((m) => m.matchDay))].sort((a, b) => a - b);
  return days[0] ?? null;
}

export function SimulationHubTab({
  seasonId,
  leagueId: _leagueId,
  sportPreset,
  archetype,
  promotionCount = 0,
  relegationCount = 0,
  hasParentLeague = false,
  hasSubLeagues = false,
  onSeasonTransition,
}: SimulationHubTabProps) {
  const utils = api.useUtils();
  const { data: season, isLoading } = api.sports.getSeason.useQuery({ id: seasonId });

  const { data: draftPicks } = api.sports.getDraftPicks.useQuery(
    { seasonId },
    { enabled: !!seasonId }
  );

  const simulateMatchDay = api.sports.simulateMatchDay.useMutation({
    onSuccess: () => {
      utils.sports.getSeason.invalidate({ id: seasonId });
    },
  });

  const simulateFullSeason = api.sports.simulateFullSeason.useMutation({
    onSuccess: () => {
      utils.sports.getSeason.invalidate({ id: seasonId });
    },
  });

  const transitionToNextSeason = api.sports.transitionToNextSeason.useMutation({
    onSuccess: (data) => {
      utils.sports.getSeason.invalidate({ id: seasonId });
      onSeasonTransition?.(data?.newSeasonId ?? "");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="mb-2 h-10 w-64" />
          <Skeleton className="mb-2 h-6 w-96" />
          <Skeleton className="mb-8 h-12 w-48" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="space-y-6">
        <Card className="mx-auto max-w-lg text-center">
          <CardContent className="py-12">
            <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-lg">Season not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = season.status === "completed";
  const isInProgress = season.status === "in_progress";

  const nextMatchDay = isInProgress ? findNextScheduledMatchDay(season) : null;

  const mappedStandings = season.standings.map((s, i) => ({
    id: s.id,
    teamId: s.teamId,
    teamName: s.team.name,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    points: s.points,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    rank: i + 1,
    division: s.division ?? undefined,
    conference: s.conference ?? undefined,
  }));

  const mappedMatches = season.matches.map((m) => ({
    id: m.id,
    matchDay: m.matchDay,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    homeScore: m.homeScore ?? undefined,
    awayScore: m.awayScore ?? undefined,
    status: m.status,
  }));

  const mappedBrackets = season.brackets.map((b) => ({
    id: b.id,
    round: b.round,
    weightClass: b.weightClass ?? undefined,
    fighter1Id: b.fighter1Id,
    fighter2Id: b.fighter2Id,
    winnerId: b.winnerId ?? undefined,
    status: b.status,
    result: b.result ?? undefined,
  }));

  const mappedRaces = season.races.map((r) => ({
    id: r.id,
    raceNumber: r.raceNumber,
    circuitName: r.circuitName,
    status: r.status,
    grid:
      (r.grid as Array<{ driverId: string; driverName?: string; position: number }>) ?? undefined,
    results:
      (r.results as Array<{
        driverId: string;
        driverName?: string;
        finishPosition: number;
        points: number;
        fastestLap?: boolean;
      }>) ?? undefined,
    weather: r.weather ?? undefined,
  }));

  return (
    <div className="space-y-6">
      {isCompleted && season.champion && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-6 text-center"
        >
          <Trophy className="mx-auto mb-2 h-10 w-10 text-yellow-500" />
          <h2 className="text-2xl font-bold">{season.champion.name}</h2>
          <p className="text-muted-foreground mt-1">Season {season.seasonNumber} Champion</p>
        </motion.div>
      )}

      <div className="bg-card/60 relative overflow-hidden rounded-2xl border border-purple-500/25 p-6 shadow-lg shadow-purple-500/5 backdrop-blur-md">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    isInProgress ? "bg-purple-400" : "bg-slate-400"
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    isInProgress ? "bg-purple-500" : "bg-slate-500"
                  )}
                />
              </span>
              <h2 className="text-foreground text-xl font-black">Simulation Control Deck</h2>
            </div>
            <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <span>Season {season.seasonNumber}</span>
              <span>•</span>
              <Badge
                variant={isInProgress ? "default" : isCompleted ? "secondary" : "outline"}
                className={cn(
                  "rounded border px-2 py-0.5 text-[9px] font-bold uppercase shadow-sm",
                  isInProgress
                    ? "border-purple-500/20 bg-purple-500/10 text-purple-400 hover:bg-purple-500/15"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {season.status}
              </Badge>
              {season.startIxTime && (
                <>
                  <span>•</span>
                  <span>Started {new Date(season.startIxTime).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isInProgress && (
              <div className="flex flex-wrap items-center gap-2.5">
                {nextMatchDay && (
                  <Button
                    onClick={() =>
                      simulateMatchDay.mutate({
                        seasonId: season.id,
                        matchDay: nextMatchDay,
                      })
                    }
                    disabled={simulateMatchDay.isPending || simulateFullSeason.isPending}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white shadow transition hover:bg-purple-500"
                  >
                    {simulateMatchDay.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Simulating Day {nextMatchDay}...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span>Simulate Day {nextMatchDay}</span>
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => simulateFullSeason.mutate({ seasonId: season.id })}
                  disabled={simulateMatchDay.isPending || simulateFullSeason.isPending}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border-purple-500/30 text-xs font-bold text-purple-400 shadow-sm transition hover:bg-purple-500/10"
                >
                  {simulateFullSeason.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Simulating Season...</span>
                    </>
                  ) : (
                    <>
                      <FastForward className="h-3.5 w-3.5" />
                      <span>Simulate Remaining</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {isCompleted && (
              <Button
                onClick={() => transitionToNextSeason.mutate({ seasonId: season.id })}
                disabled={transitionToNextSeason.isPending}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white shadow transition hover:bg-purple-500"
              >
                {transitionToNextSeason.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Transitioning...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-white" />
                    <span>Transition Season</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Sim Progress Bar */}
        {isInProgress && (
          <div className="border-border/10 mt-6 space-y-2 border-t pt-4">
            <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
              <span>Season Simulation Progress</span>
              <span>
                {(() => {
                  const completedMatches = season.matches.filter(
                    (m) => m.status === "completed"
                  ).length;
                  const pct =
                    season.matches.length > 0
                      ? Math.round((completedMatches / season.matches.length) * 100)
                      : 0;
                  return `${pct}% (${completedMatches}/${season.matches.length} Matches)`;
                })()}
              </span>
            </div>
            <div className="border-border/20 relative h-2 w-full overflow-hidden rounded-full border bg-slate-200 shadow-inner dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    season.matches.length > 0
                      ? (season.matches.filter((m) => m.status === "completed").length /
                          season.matches.length) *
                        100
                      : 0
                  }%`,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {(simulateMatchDay.isPending || simulateFullSeason.isPending) && (
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  animate={{ opacity: [0.1, 0.4, 0.1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                />
              )}
            </div>
          </div>
        )}

        {(simulateMatchDay.error || simulateFullSeason.error || transitionToNextSeason.error) && (
          <p className="text-destructive mt-4 text-xs font-semibold">
            {simulateMatchDay.error?.message ??
              simulateFullSeason.error?.message ??
              transitionToNextSeason.error?.message}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Card className="facet-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mappedStandings.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No standings data yet. Simulate a match day to get started.
              </p>
            ) : (
              <StandingsTable
                standings={mappedStandings}
                promotionCount={promotionCount}
                relegationCount={relegationCount}
                hasParentLeague={hasParentLeague}
                hasSubLeagues={hasSubLeagues}
              />
            )}
          </CardContent>
        </Card>

        {archetype === "bracket" && mappedBrackets.length > 0 && (
          <BracketView brackets={mappedBrackets} />
        )}

        {archetype === "circuit" && mappedRaces.length > 0 && <RaceResults races={mappedRaces} />}

        {mappedMatches.length > 0 && (
          <Card className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule &amp; Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleView matches={mappedMatches} archetype={archetype} />
            </CardContent>
          </Card>
        )}

        {mappedMatches.length === 0 && archetype !== "bracket" && archetype !== "circuit" && (
          <Card className="facet-hierarchy-child">
            <CardContent className="py-12 text-center">
              <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">
                No matches scheduled yet. Simulate a match day to begin.
              </p>
            </CardContent>
          </Card>
        )}

        {draftPicks && draftPicks.length > 0 && (
          <Card className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {sportPreset === "soccer" ? "Transfer Signings" : "Draft Picks"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DraftPicksView picks={draftPicks} isSoccer={sportPreset === "soccer"} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
