"use client";

import { useState, useEffect, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent } from "~/components/ui/tabs";
// eslint-disable-next-line unused-imports/no-unused-imports
import { StandingsTable } from "~/components/myleague/StandingsTable";
import { ScheduleView } from "~/components/myleague/ScheduleView";
import { BracketView } from "~/components/myleague/BracketView";
import { RaceResults } from "~/components/myleague/RaceResults";
import { DraftPicksView } from "~/components/myleague/DraftPicksView";
import { TeamRosterModal } from "~/components/myleague/TeamRosterModal";
import { LeagueSettingsModal } from "~/components/myleague/LeagueSettingsModal";
import { LeagueSidebarLayout } from "~/components/myleague/LeagueSidebarLayout";
import Standings from "~/components/sports/standings/Standings1";
import LatestResults from "~/components/sports/latest-results/LatestResults1";
import {
  LeagueBrandCard,
  SeasonProgressWidget,
  ReigningChampionWidget,
  QuickSimWidget,
  type LeagueSection,
} from "~/components/myleague/LeagueSidebarNav";
import { getSportColors, getPreset, type SportPresetKey } from "~/lib/sports/presets";
import {
  ArrowLeft,
  Play,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Eye,
  Trophy,
  Users,
  Calendar,
  Medal,
  Swords,
  MapPin,
  Shield,
  Settings,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ArrowRight,
  Loader2,
  Activity,
  FastForward,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { FacetCard } from "~/components/ui/facet-container";

const ARCHETYPE_LABELS: Record<string, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽",
  football: "🏈",
  basketball: "🏀",
  hockey: "🏒",
  baseball: "⚾",
  f1: "🏎️",
  boxing: "🥊",
};

const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  football: "American Football",
  basketball: "Basketball",
  hockey: "Ice Hockey",
  baseball: "Baseball",
  f1: "Formula 1",
  boxing: "Boxing",
};

function findNextScheduledMatchDayFromSchedule(schedule: any): number | null {
  if (!schedule) return null;
  if (schedule.type === "circuit" && schedule.races) {
    const scheduledRaces = (schedule.races as Array<{ status: string; raceNumber: number }>).filter(
      (r) => r.status === "scheduled"
    );
    if (scheduledRaces.length === 0) return null;
    const days = [...new Set(scheduledRaces.map((r) => r.raceNumber))].sort((a, b) => a - b);
    return days[0] ?? null;
  }
  if (schedule.matches) {
    const scheduledMatches = (
      schedule.matches as Array<{ status: string; matchDay: number }>
    ).filter((m) => m.status === "scheduled");
    if (scheduledMatches.length === 0) return null;
    const days = [...new Set(scheduledMatches.map((m) => m.matchDay))].sort((a, b) => a - b);
    return days[0] ?? null;
  }
  return null;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [tab, setTab] = useState<LeagueSection>("overview");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") as LeagueSection | null;
      if (tabParam) setTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") as LeagueSection | null;
      if (tabParam && tabParam !== tab) setTab(tabParam);
    };
    window.addEventListener("popstate", handleLocationChange);
    const interval = setInterval(handleLocationChange, 150);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      clearInterval(interval);
    };
  }, [tab]);

  const handleNavigate = (section: LeagueSection) => {
    setTab(section);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", section);
      window.history.pushState(null, "", url.toString());
    }
  };

  const { data: league, isLoading } = api.sports.getLeague.useQuery({ id });
  const utils = api.useUtils();

  usePageTitle({ title: league?.name ? `${league.name} - MyLeague` : "MyLeague" });

  const activeSeason = league?.seasons?.find((s) => s.status === "in_progress");
  const latestSeason =
    activeSeason ?? league?.seasons?.find((s) => s.status === "completed") ?? league?.seasons?.[0];
  const lastCompletedSeason = league?.seasons?.find((s) => s.status === "completed");

  const seasonIdForDraft = activeSeason?.id ?? latestSeason?.id;
  const seasonId = activeSeason?.id ?? latestSeason?.id;
  const hasDraftPicks = latestSeason ? ((latestSeason as any)._count?.draftPicks ?? 0) > 0 : false;

  const { data: draftPicks } = api.sports.getDraftPicks.useQuery(
    { seasonId: seasonIdForDraft ?? "" },
    { enabled: !!seasonIdForDraft && tab === "draft" }
  );

  const startSeason = api.sports.startSeason.useMutation({
    onSuccess: () => {
      utils.sports.getLeague.invalidate({ id });
    },
  });

  const simulateMatchDay = api.sports.simulateMatchDay.useMutation({
    onSuccess: () => {
      utils.sports.getLeague.invalidate({ id });
      utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      utils.sports.getStandings.invalidate({ seasonId: seasonId ?? "" });
    },
  });

  const transitionToNextSeason = api.sports.transitionToNextSeason.useMutation({
    onSuccess: (data) => {
      utils.sports.getLeague.invalidate({ id });
      utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      utils.sports.getStandings.invalidate({ seasonId: seasonId ?? "" });
      handleSeasonTransition(data?.newSeasonId ?? "");
    },
  });

  const { data: standings, isLoading: standingsLoading } = api.sports.getStandings.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const sportColors = league ? getSportColors(league.sportPreset as SportPresetKey) : null;
  const isBoxing = league?.archetype === "bracket" || league?.sportPreset === "boxing";
  const isF1 = league?.archetype === "circuit" || league?.sportPreset === "f1";

  const visibleSections = useMemo<LeagueSection[]>(() => {
    const sections: LeagueSection[] = ["overview", "standings", "schedule", "teams", "history"];
    if (isBoxing) sections.splice(3, 0, "bracket");
    if (isF1) sections.splice(3, 0, "races");
    if (hasDraftPicks) sections.splice(4, 0, "draft");
    return sections;
  }, [isBoxing, isF1, hasDraftPicks]);

  const { data: schedule } = api.sports.getSchedule.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const latestResultsMatches = useMemo(() => {
    if (!schedule?.matches) return [];
    return (schedule.matches as any[]).map((m: any) => ({
      id: m.id,
      matchDay: m.matchDay,
      homeTeamName: m.homeTeam.name,
      awayTeamName: m.awayTeam.name,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      homeColor: m.homeTeam.color,
      awayColor: m.awayTeam.color,
      homeShortName: m.homeTeam.shortName,
      awayShortName: m.awayTeam.shortName,
    }));
  }, [schedule]);

  let progressLabel = "Matches";
  let completedCount = 0;
  let totalCount = 0;
  if (activeSeason) {
    if (league?.archetype === "circuit") {
      progressLabel = "Races";
      const races = ((activeSeason as any).races as Array<{ status: string }>) ?? [];
      completedCount = races.filter((r) => r.status === "completed").length;
      totalCount = races.length;
    } else {
      const matches = ((activeSeason as any).matches as Array<{ status: string }>) ?? [];
      completedCount = matches.filter((m) => m.status === "completed").length;
      totalCount = matches.length;
    }
  }

  const handleTeamClick = (teamId: string) => setActiveTeamId(teamId);
  const handleSeasonTransition = (newSeasonId: string) => {
    if (newSeasonId) {
      router.push(withBasePath(`/myleague/${id}?tab=sim`));
    }
  };

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
            <Button className="mt-4" onClick={() => router.push(withBasePath("/myleague"))}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to MyLeague
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const archetypeLabel = ARCHETYPE_LABELS[league.archetype] ?? league.archetype;

  const nextMatchDay = activeSeason ? findNextScheduledMatchDayFromSchedule(schedule) : null;

  const sidebarExtra = (
    <div className="space-y-3">
      <LeagueBrandCard
        sportPreset={league.sportPreset}
        leagueName={league.name}
        archetype={archetypeLabel}
        teamCount={league.teamCount}
        logo={league.logo}
      />
      {activeSeason && (
        <SeasonProgressWidget
          seasonNumber={activeSeason.seasonNumber}
          completedCount={completedCount}
          totalCount={totalCount}
          label={progressLabel}
        />
      )}
      {activeSeason && activeSeason.id && (
        <QuickSimWidget
          seasonId={activeSeason.id}
          nextMatchDay={nextMatchDay}
          onSimulated={() => {
            utils.sports.getLeague.invalidate({ id });
          }}
        />
      )}
      {lastCompletedSeason?.champion && (
        <ReigningChampionWidget
          championName={lastCompletedSeason.champion.name}
          seasonNumber={lastCompletedSeason.seasonNumber}
        />
      )}
    </div>
  );

  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const heroSection = (
    <div className="space-y-4">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(withBasePath("/myleague"))}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Leagues Lobby
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="h-8 cursor-pointer border-white/10 bg-white/5 text-xs font-medium hover:bg-white/10 dark:border-white/5"
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Manage MyLeague
        </Button>
      </div>

      {/* Widescreen Glass HUD Banner */}
      <div
        style={
          sportColors
            ? {
                background: `linear-gradient(135deg, hsl(${sportColors.accentColor} / 0.15), hsl(${sportColors.highlightColor} / 0.05))`,
                borderColor: `hsl(${sportColors.accentColor} / 0.25)`,
              }
            : {}
        }
        className="bg-card/40 relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-white/10 p-6 shadow-xl backdrop-blur-xl md:flex-row md:items-center dark:border-white/5"
      >
        {sportColors && (
          <>
            <div
              className="pointer-events-none absolute animate-pulse rounded-full opacity-15 blur-[80px]"
              style={{
                background: `hsl(${sportColors.accentColor})`,
                width: "300px",
                height: "300px",
                top: "-100px",
                left: "-50px",
                animationDuration: "8s",
              }}
            />
            <div
              className="pointer-events-none absolute rounded-full opacity-10 blur-[60px]"
              style={{
                background: `hsl(${sportColors.highlightColor})`,
                width: "250px",
                height: "250px",
                bottom: "-80px",
                right: "-50px",
              }}
            />
          </>
        )}

        {/* Left: League Identity */}
        <div className="relative z-10 flex items-center gap-4">
          {league.logo ? (
            <img
              src={league.logo}
              alt={league.name}
              className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 object-cover shadow-md dark:border-white/5"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-4xl shadow-md backdrop-blur-md dark:border-white/5">
              {SPORT_EMOJIS[league.sportPreset] ?? "🏆"}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground text-2xl font-black tracking-tight">{league.name}</h1>
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/5 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-400 uppercase select-none"
              >
                {SPORT_LABELS[league.sportPreset] || league.sportPreset}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs font-semibold tracking-wider uppercase">
              {archetypeLabel} • {getPreset(league.sportPreset as SportPresetKey).federationName}
            </p>
          </div>
        </div>

        {/* Right: HUD Stats */}
        <div className="relative z-10 grid w-full shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 md:w-auto">
          {/* Card 1: Season */}
          <div className="flex min-w-[125px] flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/20">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
              <Calendar className="h-3 w-3 text-purple-400" /> Season
            </span>
            <span className="mt-1 text-base font-extrabold tracking-tight">
              {activeSeason
                ? `Season ${activeSeason.seasonNumber}`
                : latestSeason
                  ? `Season ${latestSeason.seasonNumber}`
                  : "None"}
            </span>
            <div className="mt-1.5 flex">
              {activeSeason ? (
                <Badge className="border border-purple-500/20 bg-purple-500/10 px-1.5 py-0 text-[9px] font-bold text-purple-400">
                  In Progress
                </Badge>
              ) : latestSeason && latestSeason.status === "completed" ? (
                <Badge className="bg-secondary/40 text-muted-foreground px-1.5 py-0 text-[9px] font-bold">
                  Completed
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground px-1.5 py-0 text-[9px] font-bold">
                  Not Started
                </Badge>
              )}
            </div>
          </div>

          {/* Card 2: Teams */}
          <div className="flex min-w-[125px] flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/20">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
              <Shield className="h-3 w-3 text-blue-400" /> Teams
            </span>
            <span className="mt-1 text-base font-extrabold tracking-tight">
              {league.teamCount} Teams
            </span>
            <span className="text-muted-foreground mt-1.5 text-[9px] font-bold tracking-wider uppercase">
              Registered
            </span>
          </div>

          {/* Card 3: Progression */}
          <div className="flex min-w-[125px] flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/20">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
              <Activity className="h-3 w-3 text-cyan-400" /> Progression
            </span>
            <span className="mt-1 text-base font-extrabold tracking-tight">
              {totalCount > 0 ? `${completedCount} / ${totalCount}` : "0 / 0"}
            </span>
            <span className="text-muted-foreground mt-1.5 text-[9px] font-bold tracking-wider uppercase">
              {progressLabel}
            </span>
          </div>

          {/* Card 4: Champion */}
          <div className="flex min-w-[125px] flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/20">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
              <Trophy className="h-3 w-3 text-yellow-500" /> Champion
            </span>
            <span
              className="mt-1 max-w-[110px] truncate text-base font-extrabold tracking-tight"
              title={lastCompletedSeason?.champion?.name ?? "No Champion Yet"}
            >
              {lastCompletedSeason?.champion?.name ?? "None Yet"}
            </span>
            <span className="text-muted-foreground mt-1.5 truncate text-[9px] font-bold tracking-wider uppercase">
              {lastCompletedSeason ? `Season ${lastCompletedSeason.seasonNumber}` : "Active"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <LeagueSidebarLayout
        activeSection={tab}
        onNavigate={handleNavigate}
        visibleSections={visibleSections}
        sportAccent={sportColors?.accentColor}
        sportHighlight={sportColors?.highlightColor}
        sidebarExtra={sidebarExtra}
        heroSection={heroSection}
      >
        <Tabs value={tab} onValueChange={(v) => handleNavigate(v as LeagueSection)}>
          <TabsContent value="overview">
            {/* 2-Column Premium Layout (matched to vault/dashboard ratio) */}
            <div className="facet-layout-grid-3">
              {/* Left Column: Standings & Results */}
              <div className="facet-layout-main-span-2 space-y-6">
                {/* Standings Preview: Top 5 leaders in a compact glass table */}
                <Card className="facet-hierarchy-child border-border/40 bg-card/65 border backdrop-blur-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-sm font-bold tracking-wider uppercase">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Standings Leaders
                    </CardTitle>
                    {seasonId && (
                      <button
                        onClick={() => handleNavigate("standings")}
                        className="cursor-pointer text-[10px] font-bold text-purple-400 transition-colors select-none hover:text-purple-300"
                      >
                        View Full Standings
                      </button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {standingsLoading ? (
                      <div className="space-y-2 py-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : !standings || standings.length === 0 ? (
                      <div className="text-muted-foreground py-8 text-center text-xs">
                        No standings data yet. Simulate a match day to begin!
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-border/40 text-muted-foreground border-b font-semibold">
                              <th className="w-10 py-2 pl-2">Pos</th>
                              <th className="py-2">Team</th>
                              <th className="py-2 text-right">Record</th>
                              <th className="py-2 pr-2 text-right">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.slice(0, 5).map((s, idx) => (
                              <tr
                                key={s.team.id}
                                onClick={() => handleTeamClick(s.teamId)}
                                className="border-border/10 cursor-pointer border-b transition-colors hover:bg-white/5"
                              >
                                <td className="text-muted-foreground py-2.5 pl-2 font-black">
                                  {s.position ?? idx + 1}
                                </td>
                                <td className="flex min-w-0 items-center gap-2 py-2.5 font-bold">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: s.team.color ?? "#888" }}
                                  />
                                  <span className="text-foreground truncate">{s.team.name}</span>
                                </td>
                                <td className="text-muted-foreground py-2.5 text-right font-semibold">
                                  {s.wins}-
                                  {s.draws !== null && s.draws !== undefined ? `${s.draws}-` : ""}
                                  {s.losses}
                                </td>
                                <td className="text-foreground py-2.5 pr-2 text-right font-black">
                                  {s.points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Latest Results Scoreboard */}
                {latestResultsMatches.length > 0 && (
                  <LatestResults matches={latestResultsMatches} onTeamClick={handleTeamClick} />
                )}
              </div>

              {/* Right Column: Simulation controls & Teams directory */}
              <div className="facet-layout-sidebar-span-1 space-y-6">
                {/* Live Simulation Panel */}
                <Card className="facet-hierarchy-child bg-card/65 border border-purple-500/20 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                      <Play className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
                      Next Match Hub
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activeSeason ? (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-foreground text-sm font-extrabold">
                              Season {activeSeason.seasonNumber}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {nextMatchDay
                                ? `Next: Match Day ${nextMatchDay}`
                                : "Ready to complete"}
                            </p>
                          </div>
                          {nextMatchDay && (
                            <Button
                              size="sm"
                              onClick={() =>
                                simulateMatchDay.mutate({
                                  seasonId: activeSeason.id,
                                  matchDay: nextMatchDay,
                                })
                              }
                              disabled={simulateMatchDay.isPending}
                              className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white shadow transition hover:bg-purple-500"
                            >
                              {simulateMatchDay.isPending ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Simulating...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 fill-white" />
                                  <span>Simulate Day {nextMatchDay}</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                          <div className="text-muted-foreground flex justify-between text-[10px] font-bold uppercase">
                            <span>Progress</span>
                            <span>{Math.round(progressPct)}%</span>
                          </div>
                          <div className="border-border/10 relative h-1.5 w-full overflow-hidden rounded-full border bg-slate-200 dark:bg-slate-800">
                            <motion.div
                              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.5 }}
                            />
                            {simulateMatchDay.isPending && (
                              <motion.div
                                className="absolute inset-0 bg-white/20"
                                animate={{ opacity: [0.1, 0.4, 0.1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                              />
                            )}
                          </div>
                        </div>
                      </>
                    ) : latestSeason && latestSeason.status === "completed" ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-3.5 text-center">
                          <Trophy className="mx-auto mb-1 h-5 w-5 text-yellow-500" />
                          <p className="text-xs font-bold text-yellow-500">Season Completed</p>
                          {latestSeason.champion && (
                            <p className="text-muted-foreground mt-0.5 text-[11px]">
                              Champion: {latestSeason.champion.name}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            transitionToNextSeason.mutate({ seasonId: latestSeason.id })
                          }
                          disabled={transitionToNextSeason.isPending}
                          className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white shadow transition hover:bg-purple-500"
                        >
                          {transitionToNextSeason.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Transitioning...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 fill-white" />
                              <span>Start Next Season</span>
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 py-2 text-center">
                        <p className="text-muted-foreground text-xs">No seasons played yet</p>
                        <Button
                          size="sm"
                          onClick={() => startSeason.mutate({ leagueId: league.id })}
                          disabled={startSeason.isPending || league.teams.length === 0}
                          className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white shadow transition hover:bg-purple-500"
                        >
                          {startSeason.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Starting...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 fill-white" />
                              <span>Start Season 1</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Teams Directory List */}
                <Card className="facet-hierarchy-child border-border/40 bg-card/65 border backdrop-blur-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      Teams Directory
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="border-border/50 text-muted-foreground px-1.5 py-0.5 text-[9px] font-bold"
                    >
                      {league.teams.length} Teams
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {league.teams.length === 0 ? (
                      <p className="text-muted-foreground py-6 text-center text-xs italic">
                        No teams registered
                      </p>
                    ) : (
                      <div className="thin-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
                        {league.teams.map((team) => (
                          <div
                            key={team.id}
                            onClick={() => handleTeamClick(team.id)}
                            className="border-border/10 relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl border bg-white/5 p-2.5 text-left transition hover:bg-white/10"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[9px] font-black text-white shadow"
                                style={{ backgroundColor: team.color ?? "#888" }}
                              >
                                {team.shortName || team.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-foreground truncate text-xs font-bold">
                                {team.name}
                              </span>
                            </div>
                            {team.ownerUserId ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0 text-[8px] font-bold text-cyan-400 select-none"
                              >
                                Managed
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[8px] font-bold text-amber-400 select-none"
                              >
                                Unclaimed
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="standings">
            {tab === "standings" && (
              <StandingsTab
                league={league}
                activeSeasonId={activeSeason?.id}
                latestSeasonId={latestSeason?.id}
                onTeamClick={handleTeamClick}
              />
            )}
          </TabsContent>

          <TabsContent value="schedule">
            {tab === "schedule" && (
              <ScheduleTab
                leagueId={league.id}
                activeSeasonId={activeSeason?.id}
                latestSeasonId={latestSeason?.id}
                sportPreset={league.sportPreset}
                archetype={league.archetype}
                promotionCount={league.promotionCount}
                relegationCount={league.relegationCount}
                hasParentLeague={!!league.parentLeagueId}
                hasSubLeagues={false}
                onSeasonTransition={handleSeasonTransition}
                onTeamClick={handleTeamClick}
              />
            )}
          </TabsContent>

          {isBoxing && (
            <TabsContent value="bracket">
              {tab === "bracket" && (
                <BracketTab
                  leagueId={league.id}
                  activeSeasonId={activeSeason?.id}
                  latestSeasonId={latestSeason?.id}
                  onTeamClick={handleTeamClick}
                />
              )}
            </TabsContent>
          )}

          {isF1 && (
            <TabsContent value="races">
              {tab === "races" && (
                <RaceResultsTab
                  leagueId={league.id}
                  activeSeasonId={activeSeason?.id}
                  latestSeasonId={latestSeason?.id}
                  onTeamClick={handleTeamClick}
                />
              )}
            </TabsContent>
          )}

          {hasDraftPicks && (
            <TabsContent value="draft">
              {tab === "draft" && draftPicks && (
                <Card className="facet-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      {league.sportPreset === "soccer" ? "Transfer Signings" : "Draft Picks"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DraftPicksView
                      picks={draftPicks}
                      isSoccer={league.sportPreset === "soccer"}
                      onTeamClick={handleTeamClick}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          <TabsContent value="teams">
            {tab === "teams" && (
              <Card className="facet-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    All Teams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {league.teams.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No teams in this league.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {league.teams.map((team) => (
                        <FacetCard
                          key={team.id}
                          depth={1}
                          interactive="hover"
                          onClick={() => handleTeamClick(team.id)}
                          className="border-border/40 bg-card/60 relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border p-4 text-left backdrop-blur-md transition"
                          style={{
                            borderLeft: `4px solid ${team.color ?? "#888"}`,
                          }}
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-black text-white shadow"
                            style={{ backgroundColor: team.color ?? "#888" }}
                          >
                            {team.shortName || team.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-sm font-bold">
                              {team.name}
                            </p>
                            {team.ownerUserId ? (
                              <Badge
                                variant="outline"
                                className="mt-1 border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0 text-[8px] font-bold text-cyan-400 select-none"
                              >
                                Managed
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="mt-1 border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[8px] font-bold text-amber-400 select-none"
                              >
                                Unclaimed
                              </Badge>
                            )}
                          </div>
                        </FacetCard>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            {tab === "history" && (
              <HistoryTab leagueId={league.id} router={router} onTeamClick={handleTeamClick} />
            )}
          </TabsContent>
        </Tabs>
      </LeagueSidebarLayout>

      <TeamRosterModal
        teamId={activeTeamId ?? ""}
        leagueId={league.id}
        sportPreset={league.sportPreset}
        isOpen={!!activeTeamId}
        onClose={() => setActiveTeamId(null)}
      />

      <LeagueSettingsModal league={league} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

// ── Tab sub-components ──────────────────────────────────────────────────

function StandingsTab({
  league,
  activeSeasonId,
  latestSeasonId,
  onTeamClick,
}: {
  league: any;
  activeSeasonId?: string;
  latestSeasonId?: string;
  onTeamClick?: (teamId: string) => void;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: standings, isLoading } = api.sports.getStandings.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
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
    color: s.team.color,
  }));

  return (
    <Standings
      title={`${league.name} Standings`}
      standings={mapped}
      promotionCount={league?.promotionCount}
      relegationCount={league?.relegationCount}
      hasParentLeague={!!league?.parentLeagueId}
      hasSubLeagues={!!league?.subLeagues && league.subLeagues.length > 0}
      onTeamClick={onTeamClick}
    />
  );
}

function ScheduleTab({
  leagueId,
  activeSeasonId,
  latestSeasonId,
  // eslint-disable-next-line unused-imports/no-unused-vars
  sportPreset,
  archetype,
  // eslint-disable-next-line unused-imports/no-unused-vars
  promotionCount = 0,
  // eslint-disable-next-line unused-imports/no-unused-vars
  relegationCount = 0,
  // eslint-disable-next-line unused-imports/no-unused-vars
  hasParentLeague = false,
  // eslint-disable-next-line unused-imports/no-unused-vars
  hasSubLeagues = false,
  onSeasonTransition,
  onTeamClick,
}: {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  sportPreset: string;
  archetype: string;
  promotionCount?: number;
  relegationCount?: number;
  hasParentLeague?: boolean;
  hasSubLeagues?: boolean;
  onSeasonTransition?: (newSeasonId: string) => void;
  onTeamClick?: (teamId: string) => void;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const utils = api.useUtils();

  const { data: season, isLoading: seasonLoading } = api.sports.getSeason.useQuery(
    { id: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const { data: schedule, isLoading: scheduleLoading } = api.sports.getSchedule.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const simulateMatchDay = api.sports.simulateMatchDay.useMutation({
    onSuccess: () => {
      utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const simulateFullSeason = api.sports.simulateFullSeason.useMutation({
    onSuccess: () => {
      utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const transitionToNextSeason = api.sports.transitionToNextSeason.useMutation({
    onSuccess: (data) => {
      utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      utils.sports.getLeague.invalidate({ id: leagueId });
      onSeasonTransition?.(data?.newSeasonId ?? "");
    },
  });

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

  if (seasonLoading || scheduleLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="space-y-4 py-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!season || !schedule) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  const isCompleted = season.status === "completed";
  const isInProgress = season.status === "in_progress";
  const nextMatchDay = isInProgress ? findNextScheduledMatchDayFromSchedule(schedule) : null;

  let progressPct = 0;
  if (archetype === "circuit" && schedule.races) {
    const completedRaces = schedule.races.filter((r: any) => r.status === "completed").length;
    progressPct = schedule.races.length > 0 ? (completedRaces / schedule.races.length) * 100 : 0;
  } else if (schedule.matches) {
    const completedMatches = schedule.matches.filter((m: any) => m.status === "completed").length;
    progressPct =
      schedule.matches.length > 0 ? (completedMatches / schedule.matches.length) * 100 : 0;
  }

  const renderSimulationDeck = () => {
    return (
      <div className="bg-card/60 relative mb-6 overflow-hidden rounded-2xl border border-purple-500/25 p-6 shadow-lg shadow-purple-500/5 backdrop-blur-md">
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
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="border-border/20 relative h-2 w-full overflow-hidden rounded-full border bg-slate-200 shadow-inner dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
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
    );
  };

  const renderSchedule = () => {
    if (schedule.type === "circuit") {
      const races = (schedule.races ?? []).map((r: any) => ({
        id: r.id,
        matchDay: r.raceNumber,
        homeTeamName: r.circuitName,
        status: r.status,
      }));
      return <ScheduleView matches={races} archetype={archetype} onTeamClick={onTeamClick} />;
    }

    const matches = (schedule.matches ?? []).map((m: any) => ({
      id: m.id,
      matchDay: m.matchDay,
      homeTeamName: m.homeTeam.name,
      awayTeamName: m.awayTeam.name,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
      homeScore: m.homeScore ?? undefined,
      awayScore: m.awayScore ?? undefined,
      status: m.status,
    }));

    return <ScheduleView matches={matches} archetype={archetype} onTeamClick={onTeamClick} />;
  };

  return (
    <div className="space-y-6">
      {renderSimulationDeck()}
      {renderSchedule()}
    </div>
  );
}

function BracketTab({
  leagueId: _leagueId,
  activeSeasonId,
  latestSeasonId,
  onTeamClick: _onTeamClick,
}: {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  onTeamClick?: (teamId: string) => void;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: brackets, isLoading } = api.sports.getBracket.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
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
        <CardContent className="space-y-4 py-8">
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

  const mapped = brackets.map((b: any) => ({
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
  leagueId: _leagueId,
  activeSeasonId,
  latestSeasonId,
  onTeamClick: _onTeamClick,
}: {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  onTeamClick?: (teamId: string) => void;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: races, isLoading } = api.sports.getRaceResults.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
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
        <CardContent className="space-y-4 py-8">
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

  const mapped = races.map((r: any) => ({
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

  return <RaceResults races={mapped} />;
}

function HistoryTab({
  leagueId,
  router,
  onTeamClick: _onTeamClick,
}: {
  leagueId: string;
  router: ReturnType<typeof useRouter>;
  onTeamClick?: (teamId: string) => void;
}) {
  const { data: history, isLoading } = api.sports.getLeagueHistory.useQuery({ leagueId });

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child">
        <CardContent className="space-y-4 py-8">
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
                router.push(withBasePath(`/myleague/${leagueId}/season/${s.seasonId}`))
              }
              className="facet-hierarchy-interactive flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Trophy
                  className={cn("h-5 w-5", i === 0 ? "text-yellow-500" : "text-muted-foreground")}
                />
                <div>
                  <p className="font-medium">Season {s.seasonNumber}</p>
                  {s.startIxTime && (
                    <p className="text-muted-foreground text-xs">
                      {new Date(s.startIxTime).toLocaleDateString()}
                      {s.endIxTime && ` - ${new Date(s.endIxTime).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {s.championTeamName ? (
                  <p className="font-semibold">{s.championTeamName}</p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">No champion</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
