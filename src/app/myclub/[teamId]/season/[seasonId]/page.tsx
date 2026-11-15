"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { MatchCommentary } from "~/components/sports/MatchCommentary";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { Stat } from "~/components/ui/stat";
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
import { springSmooth, tweenFast } from "~/lib/design/motion";
import { cn } from "~/lib/utils";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Trophy,
  Calendar,
  Clock,
  CheckCircle as CheckCircle2,
  StatsReport as BarChart3,
  Group as Users,
} from "iconoir-react";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";
import { Signal } from "~/components/ui/signal";
import { SportGlyph } from "~/components/sports/SportGlyph";

const MATCH_STATUS_ICON: Record<string, React.ReactNode> = {
  scheduled: <Clock className="text-label-secondary" />,
  in_progress: <Clock className="text-yellow" />,
  completed: <CheckCircle2 className="text-green" />,
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
        <Skeleton className="rounded-row h-24" />
        <Skeleton className="rounded-row h-24" />
        <Skeleton className="rounded-row h-24" />
        <Skeleton className="rounded-row h-24" />
      </div>
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="rounded-row h-16 w-full" />
        <Skeleton className="rounded-row h-16 w-full" />
        <Skeleton className="rounded-row h-16 w-full" />
      </div>
    </div>
  );
}

function MatchCard({
  match,
  teamId,
  index,
  isExpanded,
  onToggleExpand,
}: {
  match: Record<string, unknown>;
  teamId: string;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
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
    isCompleted && teamScore != null && opponentScore != null && teamScore > opponentScore;
  const lost =
    isCompleted && teamScore != null && opponentScore != null && teamScore < opponentScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSmooth, delay: Math.min(index, 10) * 0.03 }}
      layout
    >
      <Card
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className={cn("overflow-hidden", won && "border-green/30", lost && "border-red/30")}
        interactive
      >
        <div className="flex flex-col gap-0 px-5 py-4">
          <div className="flex w-full items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full">
              {won ? (
                <ArrowUp className="text-green size-5" aria-label="Won" />
              ) : lost ? (
                <ArrowDown className="text-red size-5" aria-label="Lost" />
              ) : (
                <Minus className="text-label-secondary size-5" aria-hidden />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className={cn("text-body font-medium", isHome && "font-semibold")}>
                  {isHome ? homeTeam?.name : awayTeam?.name}
                </p>
                {isCompleted && (
                  <span className="text-title-3 tabular-nums">
                    {teamScore} - {opponentScore}
                  </span>
                )}
                {!isCompleted && <span className="text-label-secondary text-footnote">vs</span>}
                <p className="text-label-secondary text-body">
                  {isHome ? awayTeam?.name : homeTeam?.name}
                </p>
              </div>
              <p className="text-label-secondary text-footnote mt-0.5">
                Match Day {match.matchDay as number}
                {isHome ? " (Home)" : " (Away)"}
              </p>
            </div>

            <Badge variant={isCompleted ? "outline" : "default"} className="shrink-0 gap-1">
              {MATCH_STATUS_ICON[status] ?? null}
              {MATCH_STATUS_LABEL[status] ?? status}
            </Badge>
          </div>

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={tweenFast}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 w-full"
            >
              <MatchCommentary matchId={match.id as string} />
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function MyClubSeasonDetailPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const seasonId = typeof params.seasonId === "string" ? params.seasonId : "";
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const { data: season, isLoading } = api.sports.getSeason.useQuery(
    { id: seasonId },
    { enabled: !!seasonId }
  );
  const { data: history } = api.sports.getTeamHistory.useQuery({ teamId }, { enabled: !!teamId });

  usePageTitle({
    title: season ? `MyClub - Season ${season.seasonNumber}` : "MyClub - Season",
  });

  if (isLoading) return <SeasonDetailSkeleton />;

  if (!season) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader title="Season" back={{ href: `/myclub/${teamId}`, label: "Club" }} bleed />
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="Season not found"
            message="This season may not exist or could not be loaded."
          />
        </Card>
      </div>
    );
  }

  const isCompleted = season.status === "completed";

  const teamStanding = season.standings?.find(
    (s: Record<string, unknown>) => (s.team as Record<string, string>)?.id === teamId
  ) as Record<string, number> | undefined;

  const standingIndex = season.standings
    ? (season.standings as Record<string, any>[]).findIndex(
        (s) => (s.team as Record<string, string>)?.id === teamId
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

  const seasonHistoryEntry = history?.find((h) => h.seasonId === seasonId);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={`Season ${season.seasonNumber}`}
        back={{ href: `/myclub/${teamId}`, label: "Club" }}
        bleed
        leading={
          <span className="bg-tint-fill text-tint-ink rounded-row flex size-12 items-center justify-center">
            <SportGlyph sportPreset={season.league?.sportPreset} className="size-6" />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={season.status === "in_progress" ? "success" : "default"}>
              {season.status === "in_progress"
                ? "Active"
                : season.status === "completed"
                  ? "Completed"
                  : "Upcoming"}
            </Badge>
            <span>{season.league?.name}</span>
            {season.startIxTime && (
              <span>
                · Started {new Date(season.startIxTime).toLocaleDateString()}
                {season.endIxTime && ` · Ended ${new Date(season.endIxTime).toLocaleDateString()}`}
              </span>
            )}
          </span>
        }
      />

      {season.champion?.id === teamId && isCompleted && (
        <Signal
          tone="success"
          title={`${season.champion.name} won season ${season.seasonNumber}`}
          className="my-6"
        />
      )}

      <Card padding="md" content="data" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Stat
              label="Record"
              value={
                teamStanding
                  ? `${teamStanding.wins}-${teamStanding.losses}${teamStanding.draws > 0 ? `-${teamStanding.draws}` : ""}`
                  : "–"
              }
            />
          </div>
          <div>
            <Stat label="Points" value={teamStanding?.points ?? "–"} />
          </div>
          <div>
            <Stat
              label="PF / PA"
              value={
                teamStanding ? `${teamStanding.pointsFor} / ${teamStanding.pointsAgainst}` : "–"
              }
            />
          </div>
          <div>
            <Stat
              label="Position"
              value={
                finishPosition ? (
                  <span className="flex items-center gap-1">
                    #{finishPosition}
                    {finishPosition === 1 && (
                      <Trophy className="text-yellow size-5" aria-label="Champion" />
                    )}
                  </span>
                ) : (
                  "–"
                )
              }
              hint={`of ${season.standings?.length ?? 0} teams`}
            />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="matches">
        <TabsList className="mb-6 gap-1">
          <TabsTrigger value="matches">
            <Calendar className="mr-2 size-4" />
            Matches
          </TabsTrigger>
          {season.standings && season.standings.length > 0 && (
            <TabsTrigger value="standings">
              <BarChart3 className="mr-2 size-4" />
              Standings
            </TabsTrigger>
          )}
          {seasonHistoryEntry && (
            <TabsTrigger value="stats">
              <Users className="mr-2 size-4" />
              Season stats
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="matches">
          <div>
            <h2 className="text-title-3 text-label mb-4">
              Match results <span className="tabular-nums">({teamMatches.length})</span>
            </h2>
            {teamMatches.length > 0 ? (
              <div className="space-y-2">
                {teamMatches.map((match, i) => (
                  <MatchCard
                    key={(match as Record<string, string>).id}
                    match={match as Record<string, unknown>}
                    teamId={teamId}
                    index={i}
                    isExpanded={expandedMatchId === (match as Record<string, string>).id}
                    onToggleExpand={() =>
                      setExpandedMatchId(
                        expandedMatchId === (match as Record<string, string>).id
                          ? null
                          : (match as Record<string, string>).id
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={<Calendar />}
                  title="No matches yet"
                  message="Schedule and play games to see results."
                />
              </Card>
            )}
          </div>
        </TabsContent>

        {season.standings && season.standings.length > 0 && (
          <TabsContent value="standings">
            <Card padding="md">
              <h2 className="text-title-3 text-label mb-4 flex items-center gap-2">
                <Trophy className="text-label-secondary size-5" aria-hidden />
                Full standings
              </h2>
              <Table className="tabular-nums">
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
                  {(season.standings as Record<string, any>[]).map((s, i: number) => (
                    <TableRow
                      key={(s.team as Record<string, string>).id}
                      className={cn(
                        (s.team as Record<string, string>).id === teamId && "bg-fill-3"
                      )}
                    >
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-body">
                            {(s.team as Record<string, string>).name}
                          </span>
                          {(s.team as Record<string, string>).id === teamId && (
                            <Badge variant="secondary">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{s.wins as number}</TableCell>
                      <TableCell className="text-center">{s.losses as number}</TableCell>
                      <TableCell className="text-center">{s.draws as number}</TableCell>
                      <TableCell className="text-center font-semibold">
                        {s.points as number}
                      </TableCell>
                      <TableCell className="text-center">{s.pointsFor as number}</TableCell>
                      <TableCell className="text-center">{s.pointsAgainst as number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {seasonHistoryEntry && (
          <TabsContent value="stats">
            <Card padding="md">
              <h2 className="text-title-3 text-label flex items-center gap-2">
                <Users className="text-label-secondary size-5" aria-hidden />
                Season stats
              </h2>
              <p className="text-callout text-label-secondary mt-1 mb-4">
                Final team performance for Season {season.seasonNumber}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["Wins", seasonHistoryEntry.wins],
                    ["Losses", seasonHistoryEntry.losses],
                    ["Draws", seasonHistoryEntry.draws],
                    ["Points", seasonHistoryEntry.points],
                    ["Points for", seasonHistoryEntry.pointsFor],
                    ["Points against", seasonHistoryEntry.pointsAgainst],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-surface-secondary rounded-row p-4">
                    <Stat label={label} value={value} />
                  </div>
                ))}
              </div>
              {seasonHistoryEntry.position && (
                <div className="text-body text-label-secondary mt-4 flex items-center justify-center gap-2">
                  <span>
                    Final Position:{" "}
                    <span className="text-label font-semibold tabular-nums">
                      #{seasonHistoryEntry.position}
                    </span>
                  </span>
                  {seasonHistoryEntry.isChampion && (
                    <Badge variant="warning">
                      <Trophy />
                      Champion
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
