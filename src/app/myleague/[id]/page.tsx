// @ts-nocheck
"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { StandingsTable } from "~/components/myleague/StandingsTable";
import { ScheduleView } from "~/components/myleague/ScheduleView";
import { BracketView } from "~/components/myleague/BracketView";
import { RaceResults } from "~/components/myleague/RaceResults";
import {
  ArrowLeft,
  Play,
  Eye,
  Trophy,
  Users,
  Calendar,
  Medal,
  Swords,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
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

const ARCHETYPE_LABELS: Record<string, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [tab, setTab] = useState("overview");

  const { data: league, isLoading } = api.sports.getLeague.useQuery({ id });
  const utils = api.useUtils();

  usePageTitle({ title: league?.name ? `${league.name} - MyLeague` : "MyLeague" });

  const startSeason = api.sports.startSeason.useMutation({
    onSuccess: () => {
      utils.sports.getLeague.invalidate({ id });
    },
  });

  const activeSeason = league?.seasons?.find((s) => s.status === "in_progress");
  const latestSeason =
    activeSeason ??
    league?.seasons?.find((s) => s.status === "completed") ??
    league?.seasons?.[0];

  const isBoxing = league?.archetype === "bracket" || league?.sportPreset === "boxing";
  const isF1 = league?.archetype === "circuit" || league?.sportPreset === "f1";

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="mb-2 h-10 w-64" />
        <Skeleton className="mb-8 h-6 w-96" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="facet-hierarchy-parent mx-auto max-w-lg text-center">
          <CardContent className="py-12">
            <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-lg">League not found</p>
            <Button
              className="mt-4"
              onClick={() => router.push(withBasePath("/myleague"))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to MyLeague
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emoji = SPORT_EMOJIS[league.sportPreset] ?? "\u26BD";
  const archetypeLabel = ARCHETYPE_LABELS[league.archetype] ?? league.archetype;

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => router.push(withBasePath("/myleague"))}
        className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to MyLeague
      </button>

      <div className="facet-surface rounded-xl border border-border/40 p-6 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <h1 className="text-3xl font-bold">{league.name}</h1>
          {league.isCanonical && (
            <Badge variant="default">
              <Trophy className="mr-1 h-3 w-3" />
              Canonical
            </Badge>
          )}
          <Badge variant="secondary">{archetypeLabel}</Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          {league.teamCount} teams &middot; {league.seasons.length} season
          {league.seasons.length !== 1 ? "s" : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeSeason ? (
            <Button
              onClick={() =>
                router.push(
                  withBasePath(`/myleague/${league.id}/season/${activeSeason.id}`),
                )
              }
            >
              <Eye className="mr-2 h-4 w-4" />
              View Season {activeSeason.seasonNumber}
            </Button>
          ) : (
            <Button
              onClick={() => startSeason.mutate({ leagueId: league.id })}
              disabled={startSeason.isPending || league.teams.length === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              {startSeason.isPending ? "Starting..." : "Start Season"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {isBoxing && <TabsTrigger value="bracket">Bracket</TabsTrigger>}
          {isF1 && <TabsTrigger value="races">Race Results</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="facet-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Teams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {league.teams.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No teams in this league.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {league.teams.map((team) => (
                        <div
                          key={team.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2"
                        >
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: team.color ?? "#888" }}
                          />
                          <span className="text-sm">{team.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="facet-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Current Season
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeSeason ? (
                    <div>
                      <p className="text-2xl font-bold">
                        Season {activeSeason.seasonNumber}
                      </p>
                      <Badge className="mt-1" variant="default">
                        In Progress
                      </Badge>
                    </div>
                  ) : latestSeason && latestSeason.status === "completed" ? (
                    <div>
                      <p className="text-2xl font-bold">
                        Season {latestSeason.seasonNumber}
                      </p>
                      <Badge className="mt-1" variant="secondary">
                        Completed
                      </Badge>
                      {latestSeason.champion && (
                        <p className="text-muted-foreground mt-2 text-sm">
                          <Trophy className="mr-1 inline h-4 w-4" />
                          Champion: {latestSeason.champion.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No seasons played yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="facet-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Season History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {league.seasons.filter((s) => s.status === "completed").length >
                  0 ? (
                    <div className="space-y-2">
                      {league.seasons
                        .filter((s) => s.status === "completed")
                        .slice(0, 5)
                        .map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>Season {s.seasonNumber}</span>
                            {s.champion && (
                              <span className="text-muted-foreground">
                                {s.champion.name}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No completed seasons
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="standings">
          <StandingsTab
            leagueId={league.id}
            activeSeasonId={activeSeason?.id}
            latestSeasonId={latestSeason?.id}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleTab
            leagueId={league.id}
            activeSeasonId={activeSeason?.id}
            latestSeasonId={latestSeason?.id}
            archetype={league.archetype}
          />
        </TabsContent>

        {isBoxing && (
          <TabsContent value="bracket">
            <BracketTab
              leagueId={league.id}
              activeSeasonId={activeSeason?.id}
              latestSeasonId={latestSeason?.id}
            />
          </TabsContent>
        )}

        {isF1 && (
          <TabsContent value="races">
            <RaceResultsTab
              leagueId={league.id}
              activeSeasonId={activeSeason?.id}
              latestSeasonId={latestSeason?.id}
            />
          </TabsContent>
        )}

        <TabsContent value="history">
          <HistoryTab leagueId={league.id} router={router} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StandingsTab({
  _leagueId,
  activeSeasonId,
  latestSeasonId,
}: {
  _leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: standings, isLoading } = api.sports.getStandings.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId },
  );

  if (!seasonId) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No season data available. Start a season first!</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Trophy className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No standings data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const mapped = standings.map((s) => ({
    id: s.id,
    teamId: s.teamId,
    teamName: s.team.name,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    points: s.points,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    rank: s.position,
    division: s.division ?? undefined,
    conference: s.conference ?? undefined,
  }));

  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StandingsTable standings={mapped} />
      </CardContent>
    </Card>
  );
}

function ScheduleTab({
  _leagueId,
  activeSeasonId,
  latestSeasonId,
  archetype,
}: {
  _leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  archetype: string;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: schedule, isLoading } = api.sports.getSchedule.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId },
  );

  if (!seasonId) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No schedule available. Start a season first!</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No schedule data available.</p>
        </CardContent>
      </Card>
    );
  }

  if (schedule.type === "circuit") {
    const races = schedule.races.map((r) => ({
      id: r.id,
      matchDay: r.raceNumber,
      homeTeamName: r.circuitName,
      status: r.status,
    }));
    return <ScheduleView matches={races} archetype={archetype} />;
  }

  const matches = schedule.matches.map((m) => ({
    id: m.id,
    matchDay: m.matchDay,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    homeScore: m.homeScore ?? undefined,
    awayScore: m.awayScore ?? undefined,
    status: m.status,
  }));

  return <ScheduleView matches={matches} archetype={archetype} />;
}

function BracketTab({
  _leagueId,
  activeSeasonId,
  latestSeasonId,
}: {
  _leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: brackets, isLoading } = api.sports.getBracket.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId },
  );

  if (!seasonId) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Swords className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No season data available. Start a season first!</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!brackets || brackets.length === 0) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Swords className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No bracket data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const mapped = brackets.map((b) => ({
    id: b.id,
    round: b.round,
    weightClass: b.weightClass ?? undefined,
    fighter1Id: b.fighter1Id,
    fighter2Id: b.fighter2Id,
    winnerId: b.winnerId ?? undefined,
    status: b.status,
    result: b.result ?? undefined,
  }));

  return <BracketView brackets={mapped} />;
}

function RaceResultsTab({
  _leagueId,
  activeSeasonId,
  latestSeasonId,
}: {
  _leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: races, isLoading } = api.sports.getRaceResults.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId },
  );

  if (!seasonId) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <MapPin className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No season data available. Start a season first!</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!races || races.length === 0) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <MapPin className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No race results available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const mapped = races.map((r) => ({
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

  return <RaceResults races={mapped} />;
}

function HistoryTab({
  leagueId,
  router,
}: {
  leagueId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const { data: history, isLoading } = api.sports.getLeagueHistory.useQuery({
    leagueId,
  });

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <Medal className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">No season history yet. Complete a season first!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal className="h-5 w-5" />
          Season History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((s, i) => (
            <motion.div
              key={s.seasonId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() =>
                router.push(
                  withBasePath(
                    `/myleague/${leagueId}/season/${s.seasonId}`,
                  ),
                )
              }
              className="facet-hierarchy-interactive flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Trophy
                  className={cn(
                    "h-5 w-5",
                    i === 0 ? "text-yellow-500" : "text-muted-foreground",
                  )}
                />
                <div>
                  <p className="font-medium">Season {s.seasonNumber}</p>
                  {s.startIxTime && (
                    <p className="text-muted-foreground text-xs">
                      {new Date(s.startIxTime).toLocaleDateString()}
                      {s.endIxTime &&
                        ` - ${new Date(s.endIxTime).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {s.championTeamName ? (
                  <p className="font-semibold">{s.championTeamName}</p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    No champion
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
