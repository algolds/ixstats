"use client";

import { useState, useEffect, useMemo } from "react";
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
import { DraftPicksView } from "~/components/myleague/DraftPicksView";
import { SimulationHubTab } from "~/components/myleague/SimulationHubTab";
import { TeamRosterModal } from "~/components/myleague/TeamRosterModal";
import { LeagueSettingsModal } from "~/components/myleague/LeagueSettingsModal";
import { LeagueWorkspaceSidebarLayout } from "~/components/myleague/LeagueWorkspaceSidebarLayout";
import Standings from "~/components/sports/standings/Standings1";
import LatestResults from "~/components/sports/latest-results/LatestResults1";
import {
  LeagueBrandCard,
  SeasonProgressWidget,
  ReigningChampionWidget,
  type LeagueWorkspaceSection,
} from "~/components/myleague/LeagueWorkspaceSidebarNav";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";
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
  Shield,
  Settings,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

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
  const [tab, setTab] = useState<LeagueWorkspaceSection>("overview");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") as LeagueWorkspaceSection | null;
      if (tabParam) setTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab") as LeagueWorkspaceSection | null;
      if (tabParam && tabParam !== tab) setTab(tabParam);
    };
    window.addEventListener("popstate", handleLocationChange);
    const interval = setInterval(handleLocationChange, 150);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      clearInterval(interval);
    };
  }, [tab]);

  const handleNavigate = (section: LeagueWorkspaceSection) => {
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

  const sportColors = league ? getSportColors(league.sportPreset as SportPresetKey) : null;
  const isBoxing = league?.archetype === "bracket" || league?.sportPreset === "boxing";
  const isF1 = league?.archetype === "circuit" || league?.sportPreset === "f1";

  const visibleSections = useMemo<LeagueWorkspaceSection[]>(() => {
    const sections: LeagueWorkspaceSection[] = [
      "overview",
      "standings",
      "schedule",
      "teams",
      "history",
    ];
    if (isBoxing) sections.splice(3, 0, "bracket");
    if (isF1) sections.splice(3, 0, "races");
    if (hasDraftPicks) sections.splice(4, 0, "draft");
    if (latestSeason) sections.push("sim");
    return sections;
  }, [isBoxing, isF1, hasDraftPicks, latestSeason]);

  const seasonId = activeSeason?.id ?? latestSeason?.id;
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
      {lastCompletedSeason?.champion && (
        <ReigningChampionWidget
          championName={lastCompletedSeason.champion.name}
          seasonNumber={lastCompletedSeason.seasonNumber}
        />
      )}
    </div>
  );

  const heroSection = (
    <div className="flex items-center justify-between">
      <button
        onClick={() => router.push(withBasePath("/myleague"))}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-semibold transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Leagues Lobby
      </button>
      <button
        onClick={() => setSettingsOpen(true)}
        className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors hover:bg-muted/50"
        title="League settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      <LeagueWorkspaceSidebarLayout
        activeSection={tab}
        onNavigate={handleNavigate}
        visibleSections={visibleSections}
        sportAccent={sportColors?.accentColor}
        sportHighlight={sportColors?.highlightColor}
        sidebarExtra={sidebarExtra}
        heroSection={heroSection}
      >
        <Tabs value={tab} onValueChange={(v) => handleNavigate(v as LeagueWorkspaceSection)}>
          <TabsList className="mb-4 gap-1">
            {visibleSections.map((s) => {
              const labels: Record<string, string> = {
                overview: "Overview",
                standings: "Standings",
                schedule: "Schedule",
                bracket: "Bracket",
                races: "Race Results",
                draft: league.sportPreset === "soccer" ? "Transfers" : "Draft",
                teams: "Teams",
                history: "History",
                sim: "Simulation Hub",
              };
              return (
                <TabsTrigger key={s} value={s}>
                  {labels[s] ?? s}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
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
                          <button
                            key={team.id}
                            onClick={() => handleTeamClick(team.id)}
                            className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div
                              className="h-4 w-4 shrink-0 rounded-full"
                              style={{ backgroundColor: team.color ?? "#888" }}
                            />
                            <span className="text-sm">{team.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {latestResultsMatches.length > 0 && (
                  <LatestResults
                    matches={latestResultsMatches}
                    onTeamClick={handleTeamClick}
                  />
                )}
              </div>

              <div className="space-y-4">
                <Card className="facet-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Current Season</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeSeason ? (
                      <div>
                        <p className="text-2xl font-bold">Season {activeSeason.seasonNumber}</p>
                        <Badge className="mt-1" variant="default">
                          In Progress
                        </Badge>
                      </div>
                    ) : latestSeason && latestSeason.status === "completed" ? (
                      <div>
                        <p className="text-2xl font-bold">Season {latestSeason.seasonNumber}</p>
                        <Badge className="mt-1" variant="secondary">
                          Completed
                        </Badge>
                        {latestSeason.champion && (
                          <p className="text-muted-foreground mt-2 text-sm">
                            <Trophy className="mr-1 inline h-4 w-4" />
                            Champion: {latestSeason.champion.name}
                          </p>
                        )}
                        <div className="mt-4">
                          <Button
                            size="sm"
                            onClick={() => startSeason.mutate({ leagueId: league.id })}
                            disabled={startSeason.isPending || league.teams.length === 0}
                            className="text-xs font-semibold"
                          >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {startSeason.isPending ? "Starting..." : "Start Next Season"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-muted-foreground text-sm">No seasons played yet</p>
                        <Button
                          size="sm"
                          onClick={() => startSeason.mutate({ leagueId: league.id })}
                          disabled={startSeason.isPending || league.teams.length === 0}
                          className="text-xs font-semibold"
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          {startSeason.isPending ? "Starting..." : "Start Season 1"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="facet-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Season History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {league.seasons.filter((s) => s.status === "completed").length > 0 ? (
                      <div className="space-y-2">
                        {league.seasons
                          .filter((s) => s.status === "completed")
                          .slice(0, 5)
                          .map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-sm">
                              <span>Season {s.seasonNumber}</span>
                              {s.champion && (
                                <span className="text-muted-foreground">{s.champion.name}</span>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No completed seasons</p>
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
                archetype={league.archetype}
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
                        <button
                          key={team.id}
                          onClick={() => handleTeamClick(team.id)}
                          className="facet-hierarchy-interactive flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div
                            className="h-6 w-6 shrink-0 rounded-full border-2 border-white/20"
                            style={{ backgroundColor: team.color ?? "#888" }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{team.name}</p>
                            {team.ownerUserId ? (
                              <p className="text-muted-foreground text-[10px]">Managed</p>
                            ) : (
                              <p className="text-amber-500 text-[10px]">Unclaimed</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            {tab === "history" && (
              <HistoryTab
                leagueId={league.id}
                router={router}
                onTeamClick={handleTeamClick}
              />
            )}
          </TabsContent>

          {latestSeason && (
            <TabsContent value="sim">
              {tab === "sim" && (
                <SimulationHubTab
                  seasonId={latestSeason.id}
                  leagueId={league.id}
                  sportPreset={league.sportPreset}
                  archetype={league.archetype}
                  promotionCount={league.promotionCount}
                  relegationCount={league.relegationCount}
                  hasParentLeague={!!league.parentLeagueId}
                  hasSubLeagues={false}
                  onSeasonTransition={handleSeasonTransition}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </LeagueWorkspaceSidebarLayout>

      <TeamRosterModal
        teamId={activeTeamId ?? ""}
        leagueId={league.id}
        sportPreset={league.sportPreset}
        isOpen={!!activeTeamId}
        onClose={() => setActiveTeamId(null)}
      />

      <LeagueSettingsModal
        league={league}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
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
  leagueId: _leagueId,
  activeSeasonId,
  latestSeasonId,
  archetype,
  onTeamClick,
}: {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  archetype: string;
  onTeamClick?: (teamId: string) => void;
}) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const { data: schedule, isLoading } = api.sports.getSchedule.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
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
        <CardContent className="space-y-4 py-8">
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
