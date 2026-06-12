// @ts-nocheck
"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { StandingsTable } from "~/components/myleague/StandingsTable";
import { ScheduleView } from "~/components/myleague/ScheduleView";
import { BracketView } from "~/components/myleague/BracketView";
import { RaceResults } from "~/components/myleague/RaceResults";
import {
  ArrowLeft,
  Play,
  FastForward,
  Trophy,
  Calendar,
} from "lucide-react";
import { motion } from "motion/react";
import { withBasePath } from "~/lib/base-path";

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "\u26BD",
  football: "\uD83C\uDFC8",
  hockey: "\uD83C\uDFD2",
  basketball: "\uD83C\uDFC0",
  baseball: "\u26BE",
  f1: "\uD83C\uDFCE\uFE0F",
  boxing: "\uD83E\uDD4A",
};

export default function SeasonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const seasonId = typeof params.seasonId === "string" ? params.seasonId : "";

  const utils = api.useUtils();
  const { data: season, isLoading } = api.sports.getSeason.useQuery({ id: seasonId });

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

  usePageTitle({
    title: season
      ? `Season ${season.seasonNumber} - ${season.league.name}`
      : "Season - MyLeague",
  });

  if (isLoading) {
    return (
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
    );
  }

  if (!season) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="facet-hierarchy-parent mx-auto max-w-lg text-center">
          <CardContent className="py-12">
            <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-lg">Season not found</p>
            <Button
              className="mt-4"
              onClick={() => router.push(withBasePath(`/myleague/${leagueId}`))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to League
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emoji = SPORT_EMOJIS[season.league.sportPreset] ?? "\u26BD";
  const isCompleted = season.status === "completed";
  const isInProgress = season.status === "in_progress";

  const nextMatchDay = isInProgress
    ? findNextScheduledMatchDay(season)
    : null;

  function findNextScheduledMatchDay(s: typeof season): number | null {
    const scheduledMatches = s.matches.filter((m) => m.status === "scheduled");
    if (scheduledMatches.length === 0) return null;
    const days = [...new Set(scheduledMatches.map((m) => m.matchDay))].sort(
      (a, b) => a - b,
    );
    return days[0] ?? null;
  }

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
    grid: (r.grid as Array<{ driverId: string; driverName?: string; position: number }>) ?? undefined,
    results: (r.results as Array<{
      driverId: string;
      driverName?: string;
      finishPosition: number;
      points: number;
      fastestLap?: boolean;
    }>) ?? undefined,
    weather: r.weather ?? undefined,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => router.push(withBasePath(`/myleague/${leagueId}`))}
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {season.league.name}
      </button>

      {isCompleted && season.champion && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="from-yellow-500/10 via-amber-500/10 to-orange-500/10 mb-6 rounded-xl border border-yellow-500/30 bg-gradient-to-r p-6 text-center"
        >
          <Trophy className="mx-auto mb-2 h-10 w-10 text-yellow-500" />
          <h2 className="text-2xl font-bold">{season.champion.name}</h2>
          <p className="text-muted-foreground mt-1">
            Season {season.seasonNumber} Champion
          </p>
        </motion.div>
      )}

      <div className="facet-hierarchy-parent mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <h1 className="text-3xl font-bold">{season.league.name}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-xl font-semibold">Season {season.seasonNumber}</p>
          <Badge
            variant={isInProgress ? "default" : isCompleted ? "secondary" : "outline"}
          >
            {season.status}
          </Badge>
          {season.startIxTime && (
            <span className="text-muted-foreground text-sm">
              Started {new Date(season.startIxTime).toLocaleDateString()}
            </span>
          )}
        </div>

        {isInProgress && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {nextMatchDay && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  Next: Match Day {nextMatchDay}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    simulateMatchDay.mutate({
                      seasonId: season.id,
                      matchDay: nextMatchDay,
                    })
                  }
                  disabled={simulateMatchDay.isPending}
                >
                  <Play className="mr-1 h-4 w-4" />
                  {simulateMatchDay.isPending ? "Simulating..." : "Simulate Match Day"}
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => simulateFullSeason.mutate({ seasonId: season.id })}
              disabled={simulateFullSeason.isPending}
            >
              <FastForward className="mr-1 h-4 w-4" />
              {simulateFullSeason.isPending ? "Simulating..." : "Simulate Full Season"}
            </Button>
          </div>
        )}

        {(simulateMatchDay.error || simulateFullSeason.error) && (
          <p className="text-destructive mt-2 text-sm">
            {simulateMatchDay.error?.message ?? simulateFullSeason.error?.message}
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
              <StandingsTable standings={mappedStandings} />
            )}
          </CardContent>
        </Card>

        {season.league.archetype === "bracket" && mappedBrackets.length > 0 && (
          <BracketView brackets={mappedBrackets} />
        )}

        {season.league.archetype === "circuit" && mappedRaces.length > 0 && (
          <RaceResults races={mappedRaces} />
        )}

        {mappedMatches.length > 0 && (
          <Card className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule &amp; Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleView matches={mappedMatches} archetype={season.league.archetype} />
            </CardContent>
          </Card>
        )}

        {mappedMatches.length === 0 &&
          season.league.archetype !== "bracket" &&
          season.league.archetype !== "circuit" && (
            <Card className="facet-hierarchy-child">
              <CardContent className="py-12 text-center">
                <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="text-muted-foreground">
                  No matches scheduled yet. Simulate a match day to begin.
                </p>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
