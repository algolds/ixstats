// @ts-nocheck
"use client";

import { useParams, useRouter } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { motion } from "motion/react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  Trophy,
  Calendar,
  Clock,
  CheckCircle2,
  BarChart3,
  Users,
} from "lucide-react";

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "\u26BD",
  football: "\uD83C\uDFC8",
  hockey: "\uD83C\uDFD2",
  basketball: "\uD83C\uDFC0",
  baseball: "\u26BE",
  f1: "\uD83C\uDFCE\uFE0F",
  boxing: "\uD83E\uDD4A",
};

const MATCH_STATUS_ICON: Record<string, React.ReactNode> = {
  scheduled: <Clock className="text-muted-foreground h-4 w-4" />,
  in_progress: <Clock className="text-amber-500 h-4 w-4 animate-pulse" />,
  completed: <CheckCircle2 className="text-emerald-500 h-4 w-4" />,
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "Live",
  completed: "Final",
};

function SeasonDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="mb-2 h-5 w-24" />
      <Skeleton className="mb-1 h-8 w-72" />
      <Skeleton className="mb-6 h-5 w-48" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

function MatchCard({
  match,
  teamId,
  index,
}: {
  match: Record<string, unknown>;
  teamId: string;
  index: number;
}) {
  const homeTeam = match.homeTeam as Record<string, string>;
  const awayTeam = match.awayTeam as Record<string, string>;
  const isHome = homeTeam?.id === teamId;
  const status = (match.status as string) ?? "scheduled";
  const isCompleted = status === "completed";
  const homeScore = match.homeScore as number | null;
  const awayScore = match.awayScore as number | null;
  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const won =
    isCompleted &&
    teamScore != null &&
    opponentScore != null &&
    teamScore > opponentScore;
  const lost =
    isCompleted &&
    teamScore != null &&
    opponentScore != null &&
    teamScore < opponentScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-colors",
          won && "border-emerald-500/30 bg-emerald-500/5",
          lost && "border-red-500/20 bg-red-500/5",
        )}
      >
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            {won ? (
              <ArrowUp className="text-emerald-500 h-5 w-5" />
            ) : lost ? (
              <ArrowDown className="text-red-500 h-5 w-5" />
            ) : (
              <Minus className="text-muted-foreground h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className={cn("font-medium text-sm", isHome && "font-semibold")}>
                {isHome ? homeTeam?.name : awayTeam?.name}
              </p>
              {isCompleted && (
                <span className="text-lg font-bold tabular-nums tracking-tight">
                  {teamScore} - {opponentScore}
                </span>
              )}
              {!isCompleted && (
                <span className="text-muted-foreground text-xs">vs</span>
              )}
              <p className="text-muted-foreground text-sm">
                {isHome ? awayTeam?.name : homeTeam?.name}
              </p>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Match Day {match.matchDay as number}
              {isHome ? " (Home)" : " (Away)"}
            </p>
          </div>

          <Badge
            variant={isCompleted ? "outline" : "secondary"}
            className="shrink-0 gap-1 text-xs"
          >
            {MATCH_STATUS_ICON[status] ?? null}
            {MATCH_STATUS_LABEL[status] ?? status}
          </Badge>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MyClubSeasonDetailPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const seasonId = typeof params.seasonId === "string" ? params.seasonId : "";
  const router = useRouter();

  const { data: season, isLoading } = api.sports.getSeason.useQuery(
    { id: seasonId },
    { enabled: !!seasonId },
  );
  const { data: history } = api.sports.getTeamHistory.useQuery(
    { teamId },
    { enabled: !!teamId },
  );

  usePageTitle({
    title: season
      ? `MyClub - Season ${season.seasonNumber}`
      : "MyClub - Season",
  });

  if (isLoading) return <SeasonDetailSkeleton />;

  if (!season) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push(withBasePath(`/myclub/${teamId}`))}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Team
        </Button>
        <Card className="facet-hierarchy-parent">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Trophy className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">Season not found</h3>
            <p className="text-muted-foreground mt-2">
              This season may not exist or could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emoji = SPORT_EMOJIS[season.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
  const isCompleted = season.status === "completed";

  const teamStanding = season.standings?.find(
    (s: Record<string, unknown>) => (s.team as Record<string, string>)?.id === teamId,
  ) as Record<string, number> | undefined;

  const standingIndex = season.standings
    ? (season.standings as unknown[]).findIndex(
        (s: Record<string, unknown>) => (s.team as Record<string, string>)?.id === teamId,
      )
    : -1;
  const finishPosition = standingIndex >= 0 ? standingIndex + 1 : null;

  const teamMatches = season.matches
    ? (season.matches as unknown[])
        .filter((match) => {
          const m = match as Record<string, unknown>;
          const homeTeam = m.homeTeam as Record<string, string>;
          const awayTeam = m.awayTeam as Record<string, string>;
          return homeTeam?.id === teamId || awayTeam?.id === teamId;
        })
        .sort((a, b) => {
          const aDay = (a as Record<string, number>).matchDay ?? 0;
          const bDay = (b as Record<string, number>).matchDay ?? 0;
          return aDay - bDay;
        })
    : [];

  const seasonHistoryEntry = history?.find(
    (h) => h.seasonId === seasonId,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.push(withBasePath(`/myclub/${teamId}`))}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Team
      </Button>

      <div className="facet-hierarchy-parent mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <h1 className="text-3xl font-bold">Season {season.seasonNumber}</h1>
          <Badge
            variant={
              season.status === "in_progress"
                ? "default"
                : season.status === "completed"
                  ? "outline"
                  : "secondary"
            }
          >
            {season.status === "in_progress"
              ? "Active"
              : season.status === "completed"
                ? "Completed"
                : "Upcoming"}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2">{season.league?.name}</p>
        {season.startIxTime && (
          <p className="text-muted-foreground mt-1 text-sm">
            <Calendar className="mr-1 inline h-3.5 w-3.5" />
            Started {new Date(season.startIxTime).toLocaleDateString()}
            {season.endIxTime &&
              ` \u2014 Ended ${new Date(season.endIxTime).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {season.champion?.id === teamId && isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="from-amber-500/10 via-yellow-500/10 to-orange-500/10 mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r p-6 text-center"
        >
          <Trophy className="mx-auto mb-2 h-10 w-10 text-amber-500" />
          <h2 className="text-2xl font-bold">{season.champion.name}</h2>
          <p className="text-muted-foreground mt-1">
            Season {season.seasonNumber} Champion
          </p>
        </motion.div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="facet-hierarchy-child">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Record
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {teamStanding
                ? `${teamStanding.wins}-${teamStanding.losses}${teamStanding.draws > 0 ? `-${teamStanding.draws}` : ""}`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="facet-hierarchy-child">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Points
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {teamStanding?.points ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="facet-hierarchy-child">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              PF / PA
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {teamStanding
                ? `${teamStanding.pointsFor} / ${teamStanding.pointsAgainst}`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="facet-hierarchy-child">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Position
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold">
              {finishPosition ? (
                <>
                  #{finishPosition}
                  {finishPosition === 1 && <Trophy className="text-amber-500 h-5 w-5" />}
                </>
              ) : (
                "-"
              )}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              of {season.standings?.length ?? 0} teams
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matches">
        <TabsList className="mb-6 gap-1">
          <TabsTrigger value="matches">
            <Calendar className="mr-2 h-4 w-4" />
            Matches
          </TabsTrigger>
          {season.standings && season.standings.length > 0 && (
            <TabsTrigger value="standings">
              <BarChart3 className="mr-2 h-4 w-4" />
              Standings
            </TabsTrigger>
          )}
          {seasonHistoryEntry && (
            <TabsTrigger value="stats">
              <Users className="mr-2 h-4 w-4" />
              Season Stats
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="matches">
          <div>
            <h2 className="mb-4 text-lg font-semibold">
              Match Results ({teamMatches.length})
            </h2>
            {teamMatches.length > 0 ? (
              <div className="space-y-2">
                {teamMatches.map((match, i) => (
                  <MatchCard
                    key={(match as Record<string, string>).id}
                    match={match as Record<string, unknown>}
                    teamId={teamId}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <Card className="facet-hierarchy-child">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                  <h3 className="text-lg font-semibold">No Matches Yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Match results will appear here once games are scheduled and played.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {season.standings && season.standings.length > 0 && (
          <TabsContent value="standings">
            <Card className="facet-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Full Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">D</TableHead>
                      <TableHead className="text-center">Pts</TableHead>
                      <TableHead className="text-center">PF</TableHead>
                      <TableHead className="text-center">PA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(season.standings as unknown[]).map(
                      (s: Record<string, unknown>, i: number) => (
                        <TableRow
                          key={(s.team as Record<string, string>).id}
                          className={cn(
                            (s.team as Record<string, string>).id === teamId && "bg-muted/50",
                          )}
                        >
                          <TableCell className="font-medium">{i + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {(s.team as Record<string, string>).name}
                              </span>
                              {(s.team as Record<string, string>).id === teamId && (
                                <Badge variant="default" className="text-[10px]">
                                  YOU
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{s.wins as number}</TableCell>
                          <TableCell className="text-center">{s.losses as number}</TableCell>
                          <TableCell className="text-center">{s.draws as number}</TableCell>
                          <TableCell className="text-center font-bold">
                            {s.points as number}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.pointsFor as number}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.pointsAgainst as number}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {seasonHistoryEntry && (
          <TabsContent value="stats">
            <Card className="facet-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Season Stats
                </CardTitle>
                <CardDescription>
                  Final team performance for Season {season.seasonNumber}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Wins
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.wins}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Losses
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.losses}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Draws
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.draws}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Points
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.points}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Points For
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.pointsFor}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-muted/30">
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Points Against
                      </p>
                      <p className="mt-1 text-3xl font-bold tabular-nums">
                        {seasonHistoryEntry.pointsAgainst}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {seasonHistoryEntry.position && (
                  <div className="mt-4 text-center">
                    <p className="text-muted-foreground text-sm">
                      Final Position:{" "}
                      <span className="font-semibold">#{seasonHistoryEntry.position}</span>
                      {seasonHistoryEntry.isChampion && (
                        <Badge variant="default" className="ml-2 bg-amber-500">
                          <Trophy className="mr-1 h-3 w-3" />
                          Champion
                        </Badge>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
