// @ts-nocheck
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import {
  ArrowLeft,
  Trophy,
  Users,
  ArrowRight,
  Calendar,
  BarChart3,
  Flag,
  MapPin,
  Shield,
  Check,
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

const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue-500/30 bg-blue-500/10 text-blue-600" },
  developing: {
    label: "Developing",
    className: "border-green-500/30 bg-green-500/10 text-green-600",
  },
  prime: { label: "Prime", className: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
  plateau: {
    label: "Plateau",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-600",
  },
  declining: {
    label: "Declining",
    className: "border-red-500/30 bg-red-500/10 text-red-600",
  },
  retired: { label: "Retired", className: "border-gray-500/30 bg-gray-500/10 text-gray-500" },
};

function MiniBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          pct >= 80
            ? "bg-emerald-500"
            : pct >= 60
              ? "bg-blue-500"
              : pct >= 40
                ? "bg-amber-500"
                : "bg-red-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PlayerRow({
  player,
}: {
  player: Record<string, unknown>;
}) {
  const stageKey = (player.careerStage as string) ?? "rookie";
  const stage = CAREER_STAGE_STYLES[stageKey] ?? CAREER_STAGE_STYLES.rookie;
  const ratings = (player.ratings as Record<string, number>) ?? {};

  return (
    <div className="hover:bg-muted/50 flex items-center gap-4 rounded-lg p-3 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {player.firstName as string} {player.lastName as string}
          </span>
          {typeof player.number === "number" && (
            <span className="text-muted-foreground text-xs">#{player.number}</span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <span>{(player.position as string) ?? "Unknown"}</span>
          <span>&middot;</span>
          <span>Age {player.age as number}</span>
        </div>
      </div>
      <Badge variant="outline" className={cn("shrink-0 text-xs", stage.className)}>
        {stage.label}
      </Badge>
      <div className="hidden w-28 shrink-0 space-y-1 sm:block">
        {Object.entries(ratings).length > 0 ? (
          Object.entries(ratings)
            .slice(0, 4)
            .map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-muted-foreground w-3 text-right text-[10px] uppercase">
                  {key.slice(0, 3)}
                </span>
                <MiniBar value={val} />
                <span className="w-5 text-right text-[10px] tabular-nums">{val}</span>
              </div>
            ))
        ) : (
          <span className="text-muted-foreground text-[10px]">No ratings</span>
        )}
      </div>
    </div>
  );
}

function SeasonHistoryRow({
  entry,
  teamId,
}: {
  entry: Record<string, unknown>;
  teamId: string;
}) {
  const router = useRouter();
  const wins = (entry.wins as number) ?? 0;
  const losses = (entry.losses as number) ?? 0;
  const draws = (entry.draws as number) ?? 0;
  const position = entry.position as number | null;

  return (
    <div
      className="hover:bg-muted/50 flex cursor-pointer items-center gap-4 rounded-lg p-3 transition-colors"
      onClick={() =>
        router.push(withBasePath(`/myclub/${teamId}/season/${entry.seasonId as string}`))
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
        <Trophy className="text-blue-500 h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">Season {entry.seasonNumber as number}</p>
        <p className="text-muted-foreground text-xs">
          {wins}-{losses}
          {(draws as number) > 0 ? `-${draws}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {position && (
          <Badge variant={position <= 3 ? "default" : "secondary"} className="text-xs">
            #{position}
          </Badge>
        )}
        {entry.isChampion ? (
          <Badge variant="default" className="bg-amber-500 text-xs hover:bg-amber-500">
            Champ
          </Badge>
        ) : null}
        <span className="text-muted-foreground text-xs capitalize">
          {(entry.status as string)?.replace("_", " ") ?? "Unknown"}
        </span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="mb-4 h-5 w-24" />
      <div className="facet-hierarchy-parent mb-6 space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-4 h-10 w-72 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function MyClubTeamDetailPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const router = useRouter();
  const { user } = useUser();
  const [tab, setTab] = useState("roster");

  const {
    data: overview,
    isLoading: overviewLoading,
  } = api.sports.getMyClubOverview.useQuery({ teamId }, { enabled: !!teamId });
  const { data: teamPublic } = api.sports.getTeam.useQuery(
    { id: teamId },
    { enabled: !!teamId && !overview && !overviewLoading },
  );
  const { data: history } = api.sports.getTeamHistory.useQuery(
    { teamId },
    { enabled: !!teamId },
  );

  const claimTeam = api.sports.claimTeam.useMutation();

  usePageTitle({
    title: overview?.team?.name
      ? `MyClub - ${overview.team.name}`
      : teamPublic?.name
        ? `MyClub - ${teamPublic.name}`
        : "MyClub",
  });

  if (overviewLoading) return <OverviewSkeleton />;

  if (!overview && teamPublic) {
    const publicEmoji = SPORT_EMOJIS[teamPublic.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
    const isClaimed = !!teamPublic.ownerUserId;
    const isOwnedByMe = isClaimed && teamPublic.ownerUserId === user?.id;

    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push(withBasePath("/myclub"))}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to MyClub
        </Button>

        <div className="facet-hierarchy-parent mb-6 flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${teamPublic.color}20` }}
          >
            {publicEmoji}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold">{teamPublic.name}</h1>
            <p className="text-muted-foreground">{teamPublic.league?.name}</p>
          </div>
        </div>

        {!isClaimed ? (
          <Card className="facet-hierarchy-parent">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Shield className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">This team is unclaimed</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Take ownership of {teamPublic.name} and manage its roster, track seasons, and compete
                for championships.
              </p>
              <Button
                className="mt-6"
                onClick={() => claimTeam.mutate({ teamId })}
                disabled={claimTeam.isPending}
              >
                {claimTeam.isPending ? (
                  "Claiming..."
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Claim Team
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : isOwnedByMe ? (
          <Card className="facet-hierarchy-parent">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Trophy className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">You own this team</h3>
              <p className="text-muted-foreground mt-2">
                Something went wrong loading the overview. Try refreshing.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="facet-hierarchy-parent">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Shield className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-muted-foreground mt-2">
                This team is owned by another user.
              </p>
            </CardContent>
          </Card>
        )}

        {claimTeam.error && (
          <p className="text-destructive mt-4 text-center text-sm">
            {claimTeam.error.message ?? "Failed to claim team"}
          </p>
        )}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push(withBasePath("/myclub"))}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to MyClub
        </Button>
        <Card className="facet-hierarchy-parent">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Trophy className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="text-lg font-semibold">Team not found</h3>
            <p className="text-muted-foreground mt-2">
              This team may not exist or could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { team, activeSeason, currentStandings, upcomingMatches, seasonsCount, championships } =
    overview;
  const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
  const settledMatches =
    activeSeason?.id
      ? overview.upcomingMatches?.concat
      : undefined;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.push(withBasePath("/myclub"))}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to MyClub
      </Button>

      <div className="facet-hierarchy-parent mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${team.color}20` }}
          >
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-bold">{team.name}</h1>
            <p className="text-muted-foreground mt-1">{team.league?.name}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {team.city && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {team.city}
            </Badge>
          )}
          {team.nation && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {(team.nation as Record<string, string>).name}
            </Badge>
          )}
          <Badge variant="secondary" className="flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            {seasonsCount} season{seasonsCount !== 1 ? "s" : ""}
          </Badge>
          {championships > 0 && (
            <Badge
              variant="default"
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-500"
            >
              <Trophy className="h-3 w-3" />
              {championships}x Champion
            </Badge>
          )}
        </div>
      </div>

      {activeSeason && currentStandings && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="facet-hierarchy-child">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Record
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {currentStandings.wins}-{currentStandings.losses}
                {currentStandings.draws > 0 ? `-${currentStandings.draws}` : ""}
              </p>
            </CardContent>
          </Card>
          <Card className="facet-hierarchy-child">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Points
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{currentStandings.points}</p>
            </CardContent>
          </Card>
          <Card className="facet-hierarchy-child">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                PF / PA
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {currentStandings.pointsFor} / {currentStandings.pointsAgainst}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 gap-1">
          <TabsTrigger value="roster">
            <Users className="mr-2 h-4 w-4" />
            Roster
          </TabsTrigger>
          <TabsTrigger value="season">
            <Calendar className="mr-2 h-4 w-4" />
            Season
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart3 className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster">
          <Card className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle>Team Roster</CardTitle>
              <CardDescription>Active players and their current ratings</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {team.players && (team.players as unknown[]).length > 0 ? (
                (team.players as unknown[]).map((player) => (
                  <PlayerRow
                    key={(player as Record<string, string>).id}
                    player={player as Record<string, unknown>}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <Users className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">No active players on this team.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {team.coaches && (team.coaches as unknown[]).length > 0 && (
            <Card className="facet-hierarchy-child mt-4">
              <CardHeader>
                <CardTitle>Coaching Staff</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {(team.coaches as unknown[]).map((coach) => {
                  const c = coach as Record<string, unknown>;
                  const cStageKey = (c.careerStage as string) ?? "prime";
                  const cStage =
                    CAREER_STAGE_STYLES[cStageKey] ?? CAREER_STAGE_STYLES.prime;
                  return (
                    <div
                      key={c.id as string}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {c.firstName as string} {c.lastName as string}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {c.role as string} &middot; Age {c.age as number}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 text-xs", cStage.className)}
                      >
                        {cStage.label}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="season">
          {!activeSeason ? (
            <Card className="facet-hierarchy-child">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Calendar className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">No Active Season</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  This team does not currently have an active season.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="facet-hierarchy-child">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Season {activeSeason.seasonNumber}</CardTitle>
                    <CardDescription>Current standings and upcoming matches</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        withBasePath(`/myclub/${teamId}/season/${activeSeason.id}`)
                      )
                    }
                  >
                    View Full Season
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardHeader>
              </Card>

              {upcomingMatches && (upcomingMatches as unknown[]).length > 0 && (
                <Card className="facet-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-base">Upcoming Matches</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(upcomingMatches as unknown[]).map((match) => {
                      const m = match as Record<string, unknown>;
                      const homeTeam = m.homeTeam as Record<string, string> | undefined;
                      const awayTeam = m.awayTeam as Record<string, string> | undefined;
                      const isHome = homeTeam?.id === teamId;
                      return (
                        <div
                          key={m.id as string}
                          className="bg-muted/50 flex items-center gap-3 rounded-lg p-3"
                        >
                          <div className="flex-1 text-right">
                            <p className={cn("font-medium text-sm", isHome && "font-semibold")}>
                              {homeTeam?.shortName ?? homeTeam?.name ?? "TBD"}
                            </p>
                          </div>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                            VS
                          </div>
                          <div className="flex-1">
                            <p className={cn("font-medium text-sm", !isHome && "font-semibold")}>
                              {awayTeam?.shortName ?? awayTeam?.name ?? "TBD"}
                            </p>
                          </div>
                          <div className="text-muted-foreground shrink-0 text-xs">
                            <p>MD {m.matchDay as number}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="facet-hierarchy-child">
            <CardHeader>
              <CardTitle>Season History</CardTitle>
              <CardDescription>Team performance across all seasons</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {history && history.length > 0 ? (
                history.map((entry) => (
                  <SeasonHistoryRow
                    key={entry.seasonId as string}
                    entry={entry as Record<string, unknown>}
                    teamId={teamId}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <BarChart3 className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">No season history available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
