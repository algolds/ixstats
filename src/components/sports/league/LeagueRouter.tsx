"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { SportsShell } from "~/components/sports/core/SportsShell";
import { useUrlSyncedSection } from "~/components/sports/core/useUrlSyncedSection";
import {
  LEAGUE_SECTION_TABS,
  type SportsNavSection,
} from "~/components/sports/core/sportsSections";
import { SportsSectionTabs } from "~/components/sports/core/SportsSectionTabs";
import { PageHeader } from "~/components/shell/PageHeader";
import { ControlSlider } from "iconoir-react";
import {
  LeagueControlDeck,
  ReigningChampionWidget,
} from "~/components/sports/league/LeagueBrandWidgets";
import { ChampionshipRevealOverlay } from "~/components/sports/core/ChampionshipRevealOverlay";
import { ARCHETYPE_LABELS, getSportTheme } from "~/lib/sports/theming";
import { soundCues } from "~/lib/sound/cuelume";

// Tab Sub-Components
import { LeagueOverviewTab } from "~/components/sports/league/tabs/LeagueOverviewTab";
import { LeagueStandingsTab } from "~/components/sports/league/tabs/LeagueStandingsTab";
import { LeagueScheduleTab } from "~/components/sports/league/tabs/LeagueScheduleTab";
import { LeagueBracketTab } from "~/components/sports/league/tabs/LeagueBracketTab";
import { LeagueRacesTab } from "~/components/sports/league/tabs/LeagueRacesTab";
import { LeagueTeamsTab } from "~/components/sports/league/tabs/LeagueTeamsTab";
import { LeagueDraftTab } from "~/components/sports/league/tabs/LeagueDraftTab";
import { LeagueArchiveTab } from "~/components/sports/league/tabs/LeagueArchiveTab";

// Unified Masthead & Matchday Tape
import { LeagueMasthead } from "~/components/sports/league/LeagueMasthead";
import { MatchdayTape, type MatchdayTapeItem } from "~/components/sports/league/MatchdayTape";

// Modals & Panels
import { MatchDetailModal } from "~/components/sports/league/MatchDetailModal";
import { LeagueSettingsModal } from "~/components/sports/league/LeagueSettingsModal";
import { TeamSettingsModal } from "~/components/sports/league/TeamSettingsModal";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { SportsCommandPalette } from "~/components/sports/core/SportsCommandPalette";
import { type StandingsRow } from "~/components/sports/StandingsTable";
import { type MatchEvent } from "~/components/sports/LatestResults";

interface LeagueRouterProps {
  leagueId: string;
}

interface FormMatch {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  resolvedIxTime?: number | null;
  homeTeam: { id: string };
  awayTeam: { id: string };
}

/** Each team's last three completed results (oldest first), taken from the played fixtures. */
function recentFormByTeam(matches: FormMatch[] | undefined): Map<string, Array<"W" | "D" | "L">> {
  const form = new Map<string, Array<"W" | "D" | "L">>();
  const played = (matches ?? [])
    .filter((m) => m.status === "completed" && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => (a.resolvedIxTime ?? 0) - (b.resolvedIxTime ?? 0));
  for (const m of played) {
    const diff = m.homeScore! - m.awayScore!;
    for (const [teamId, result] of [
      [m.homeTeam.id, diff > 0 ? "W" : diff < 0 ? "L" : "D"],
      [m.awayTeam.id, diff < 0 ? "W" : diff > 0 ? "L" : "D"],
    ] as const) {
      form.set(teamId, [...(form.get(teamId) ?? []), result].slice(-3));
    }
  }
  return form;
}

export function LeagueRouter({ leagueId }: LeagueRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { focusOrganization } = useSportsFocus();

  const sectionParam = (searchParams.get("section") ||
    searchParams.get("tab")) as SportsNavSection | null;
  const [activeSection, setActiveSection] = useUrlSyncedSection<SportsNavSection>(
    sectionParam,
    "overview"
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [celebratingChampion, setCelebratingChampion] = useState<{
    championName: string;
    seasonNumber: number;
  } | null>(null);

  // Client-side instant navigation with URL synchronization
  const handleNavigate = useCallback((section: SportsNavSection) => {
    setActiveSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set("section", section);
    params.delete("tab");
    window.history.pushState(null, "", `?${params.toString()}`);
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const s = (params.get("section") || params.get("tab")) as SportsNavSection | null;
      if (s) setActiveSection(s);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const { data: league, isLoading } = api.sports.getLeague.useQuery(
    { id: leagueId },
    { enabled: !!leagueId }
  );
  const utils = api.useUtils();

  usePageTitle({ title: league?.name ? `${league.name} - MyLeague` : "MyLeague" });

  const activeSeason = league?.seasons?.find((s) => s.status === "in_progress");
  const latestSeason =
    activeSeason ?? league?.seasons?.find((s) => s.status === "completed") ?? league?.seasons?.[0];
  const lastCompletedSeason = league?.seasons?.find((s) => s.status === "completed");

  const seasonId = activeSeason?.id ?? latestSeason?.id;
  const hasDraftPicks = latestSeason
    ? ((latestSeason as { _count?: { draftPicks?: number } })._count?.draftPicks ?? 0) > 0
    : false;

  const { data: draftPicks } = api.sports.getDraftPicks.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId && activeSection === "draft" }
  );

  const startSeason = api.sports.startSeason.useMutation({
    onSuccess: () => {
      void utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const simulateMatchDay = api.sports.simulateMatchDay.useMutation({
    onSuccess: () => {
      soundCues.success();
      void utils.sports.getLeague.invalidate({ id: leagueId });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getStandings.invalidate({ seasonId: seasonId ?? "" });
    },
  });

  const simulateFullSeason = api.sports.simulateFullSeason.useMutation({
    onSuccess: (data) => {
      soundCues.success();
      void utils.sports.getLeague.invalidate({ id: leagueId });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getStandings.invalidate({ seasonId: seasonId ?? "" });

      if (data?.championTeamName && activeSeason?.seasonNumber) {
        setCelebratingChampion({
          championName: data.championTeamName,
          seasonNumber: activeSeason.seasonNumber,
        });
      }
    },
  });

  const transitionSeason = api.sports.transitionToNextSeason.useMutation({
    onSuccess: (data: unknown) => {
      soundCues.success();
      void utils.sports.getLeague.invalidate({ id: leagueId });
      const res = data as { newSeason?: { id: string } } | null;
      if (res?.newSeason) {
        void utils.sports.getSchedule.invalidate({ seasonId: res.newSeason.id });
        void utils.sports.getStandings.invalidate({ seasonId: res.newSeason.id });
      }
      handleNavigate("schedule");
    },
  });

  const { data: standings, isLoading: standingsLoading } = api.sports.getStandings.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const { data: schedule } = api.sports.getSchedule.useQuery(
    { seasonId: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  const standingsRows = useMemo<StandingsRow[] | undefined>(() => {
    if (!standings) return undefined;
    const formByTeam = recentFormByTeam(schedule?.matches);
    return standings.map((s, idx) => ({
      id: s.id,
      teamId: s.teamId,
      teamName: s.team.name,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws ?? 0,
      points: s.points,
      pointsFor: s.pointsFor ?? 0,
      pointsAgainst: s.pointsAgainst ?? 0,
      rank: s.position ?? idx + 1,
      recentForm: formByTeam.get(s.teamId),
      color: s.team.color ?? undefined,
      logo: s.team.logo,
      wikiSlug: s.team.wikiSlug,
    }));
  }, [standings, schedule?.matches]);

  const sportTheme = getSportTheme(league?.sportPreset);
  const isBoxing = league?.archetype === "bracket" || league?.sportPreset === "boxing";
  const isF1 = league?.archetype === "circuit" || league?.sportPreset === "f1";

  const sectionTabs = useMemo(() => {
    const shown = new Set<SportsNavSection>([
      "overview",
      "standings",
      "schedule",
      "teams",
      "history",
    ]);
    if (isBoxing) shown.add("bracket");
    if (isF1) shown.add("races");
    if (hasDraftPicks) shown.add("draft");
    return LEAGUE_SECTION_TABS.filter((tab) => shown.has(tab.id));
  }, [isBoxing, isF1, hasDraftPicks]);

  // Computed on the server: createdByUserId is a database id, not the Clerk id `useUser` returns.
  const canManageLeague = Boolean(league?.viewerCanManage);

  const archetypeLabel = league ? ARCHETYPE_LABELS[league.archetype] || league.archetype : "";
  const isCircuit = league?.archetype === "circuit";

  let completedCount = 0;
  let totalCount = 0;

  if (isCircuit && schedule?.races) {
    totalCount = schedule.races.length;
    completedCount = schedule.races.filter((r) => r.status === "completed").length;
  } else if (schedule?.matches) {
    totalCount = schedule.matches.length;
    completedCount = schedule.matches.filter((m) => m.status === "completed").length;
  }

  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Next scheduled fixture details
  const nextScheduledMatch = schedule?.matches?.find((m) => m.status === "scheduled");
  const nextMatchDay = nextScheduledMatch?.matchDay ?? (schedule?.matches?.length ? 1 : null);
  const nextMatchIxTime = nextScheduledMatch?.scheduledIxTime ?? null;

  // Matches for the live matchday tape strip
  const currentMatchDay = activeSeason ? (nextMatchDay ?? 1) : 1;
  const matchdayTapeMatches = useMemo<MatchdayTapeItem[]>(() => {
    if (!schedule?.matches) return [];
    return schedule.matches
      .filter((m) => m.matchDay === currentMatchDay)
      .map((m) => ({
        id: m.id,
        matchDay: m.matchDay,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          shortName: m.homeTeam.shortName,
          logo: m.homeTeam.logo,
          color: m.homeTeam.color,
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          shortName: m.awayTeam.shortName,
          logo: m.awayTeam.logo,
          color: m.awayTeam.color,
        },
      }));
  }, [schedule?.matches, currentMatchDay]);

  // Recently completed results
  const latestResultsMatches = useMemo<MatchEvent[]>(() => {
    if (!schedule?.matches) return [];
    return schedule.matches
      .filter((m) => m.status === "completed")
      .sort((a, b) => (b.resolvedIxTime ?? 0) - (a.resolvedIxTime ?? 0))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        matchDay: m.matchDay,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
        homeTeamName: m.homeTeam.name,
        awayTeamName: m.awayTeam.name,
        homeShortName: m.homeTeam.shortName,
        awayShortName: m.awayTeam.shortName,
        homeColor: m.homeTeam.color ?? undefined,
        awayColor: m.awayTeam.color ?? undefined,
        homeLogo: m.homeTeam.logo,
        awayLogo: m.awayTeam.logo,
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        status: m.status,
      }));
  }, [schedule?.matches]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="rounded-sheet h-36 w-full" />
        <div className="grid gap-6 lg:grid-cols-4">
          <Skeleton className="rounded-card h-96" />
          <Skeleton className="rounded-card h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h2 className="text-title-2 text-label">Competition not found</h2>
        <p className="text-footnote text-label-secondary">
          The requested sports league does not exist or has been archived.
        </p>
        <Button
          onClick={() => router.push("/myleague")}
          className="rounded-row text-footnote font-semibold"
        >
          Return to MyLeague lobby
        </Button>
      </div>
    );
  }

  const handleMatchClick = (matchId: string) => {
    setActiveMatchId(matchId);
  };

  const heroSection = (
    <div className="space-y-4">
      {/* 1. Unified Competition Masthead */}
      <LeagueMasthead
        league={league}
        archetypeLabel={archetypeLabel}
        sportTheme={sportTheme}
        activeSeason={activeSeason}
        latestSeason={latestSeason}
        nextMatchDay={nextMatchDay}
        totalMatchDays={38}
        progressPct={progressPct}
        canManageLeague={canManageLeague}
        onOpenSettings={() => setSettingsOpen(true)}
        onSimulateMatchDay={
          canManageLeague && activeSeason && nextMatchDay
            ? () => simulateMatchDay.mutate({ seasonId: activeSeason.id, matchDay: nextMatchDay })
            : undefined
        }
        isSimulatingMatchDay={simulateMatchDay.isPending}
      />

      {/* 2. Signature Live Matchday Tape */}
      {matchdayTapeMatches.length > 0 && (
        <MatchdayTape
          matches={matchdayTapeMatches}
          matchDay={currentMatchDay}
          onMatchClick={handleMatchClick}
        />
      )}
    </div>
  );

  const sideLabel = canManageLeague ? "League controls" : "Reigning champion";
  const hasSideContent = canManageLeague || Boolean(lastCompletedSeason?.champion);

  const sideContent = hasSideContent ? (
    <div className="space-y-4">
      {canManageLeague && (
        <LeagueControlDeck
          leagueId={league.id}
          canManageLeague={canManageLeague}
          activeSeason={activeSeason}
          latestSeason={latestSeason}
          hasMatchesPlayed={completedCount > 0}
          onOpenSettings={() => setSettingsOpen(true)}
          isSimulatingMatchDay={simulateMatchDay.isPending}
          onSimulateFullSeason={
            activeSeason
              ? () => simulateFullSeason.mutate({ seasonId: activeSeason.id })
              : undefined
          }
          isSimulatingFullSeason={simulateFullSeason.isPending}
          onTransitionSeason={
            latestSeason ? () => transitionSeason.mutate({ seasonId: latestSeason.id }) : undefined
          }
          isTransitioningSeason={transitionSeason.isPending}
          onStartSeason={() => startSeason.mutate({ leagueId: league.id })}
          isStartingSeason={startSeason.isPending}
        />
      )}
      {lastCompletedSeason?.champion && (
        <ReigningChampionWidget
          championName={lastCompletedSeason.champion.name}
          seasonNumber={lastCompletedSeason.seasonNumber}
        />
      )}
    </div>
  ) : null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case "standings":
        return (
          <LeagueStandingsTab
            standings={standingsRows}
            isLoading={standingsLoading}
            promotionCount={league.promotionCount}
            relegationCount={league.relegationCount}
            onTeamClick={(tId) => focusOrganization(tId)}
          />
        );

      case "schedule":
        return (
          <LeagueScheduleTab
            leagueId={league.id}
            activeSeasonId={activeSeason?.id}
            latestSeasonId={latestSeason?.id}
            onTeamClick={(tId) => focusOrganization(tId)}
            onMatchClick={handleMatchClick}
          />
        );

      case "teams":
        return (
          <LeagueTeamsTab teams={league.teams} onTeamClick={(tId) => focusOrganization(tId)} />
        );

      case "bracket":
        return (
          <LeagueBracketTab
            leagueId={league.id}
            activeSeasonId={activeSeason?.id}
            latestSeasonId={latestSeason?.id}
            onTeamClick={(tId) => focusOrganization(tId)}
          />
        );

      case "races":
        return (
          <LeagueRacesTab
            leagueId={league.id}
            activeSeasonId={activeSeason?.id}
            latestSeasonId={latestSeason?.id}
            onTeamClick={(tId) => focusOrganization(tId)}
          />
        );

      case "draft":
        return (
          <LeagueDraftTab
            picks={draftPicks ?? []}
            sportPreset={league.sportPreset}
            onTeamClick={(tId) => focusOrganization(tId)}
          />
        );

      case "history":
        return <LeagueArchiveTab leagueId={league.id} sportPreset={league.sportPreset} />;

      case "overview":
      default:
        return (
          <LeagueOverviewTab
            leagueId={league.id}
            activeSeason={activeSeason}
            latestSeason={latestSeason}
            standings={standings}
            standingsLoading={standingsLoading}
            latestResultsMatches={latestResultsMatches}
            nextMatchDay={nextMatchDay}
            nextMatchIxTime={nextMatchIxTime}
            onNavigate={handleNavigate}
            onTeamClick={(tId) => focusOrganization(tId)}
            onMatchClick={handleMatchClick}
            onSimulateMatchDay={
              canManageLeague
                ? (sId: string, mDay: number) =>
                    simulateMatchDay.mutate({ seasonId: sId, matchDay: mDay })
                : undefined
            }
            isSimulatingMatchDay={simulateMatchDay.isPending}
            onTransitionSeason={
              canManageLeague
                ? (sId: string) => transitionSeason.mutate({ seasonId: sId })
                : undefined
            }
            isTransitioningSeason={transitionSeason.isPending}
            onStartSeason={(lId: string) => startSeason.mutate({ leagueId: lId })}
            isStartingSeason={startSeason.isPending}
          />
        );
    }
  };

  return (
    <>
      <SportsShell
        sportPreset={league.sportPreset}
        header={
          <PageHeader
            title={league.name}
            subtitle={sportTheme.name}
            back={{ href: "/myleague", label: "Leagues" }}
            bleed
            actions={
              hasSideContent ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="xl:hidden"
                  onClick={() => setControlsOpen(true)}
                >
                  <ControlSlider />
                  {sideLabel}
                </Button>
              ) : undefined
            }
          />
        }
        heroSection={heroSection}
        sideContent={sideContent}
        sideTitle={sideLabel}
        sideOpen={controlsOpen}
        onSideOpenChange={setControlsOpen}
      >
        <SportsSectionTabs
          label="League views"
          tabs={sectionTabs}
          active={activeSection}
          onChange={handleNavigate}
        >
          {renderSectionContent()}
        </SportsSectionTabs>
      </SportsShell>

      {/* Match Center Dialog */}
      {activeMatchId && (
        <MatchDetailModal
          matchId={activeMatchId}
          isOpen={!!activeMatchId}
          onClose={() => setActiveMatchId(null)}
          sportPreset={league.sportPreset ?? undefined}
        />
      )}

      {/* League Settings Modal */}
      <LeagueSettingsModal
        league={league}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenRoster={(tId) => focusOrganization(tId)}
        onEditTeam={(tId) => setEditTeamId(tId)}
      />

      {/* Team Edit Modal */}
      {editTeamId &&
        (() => {
          const t = league.teams?.find((tm) => tm.id === editTeamId);
          if (!t) return null;
          return (
            <TeamSettingsModal
              team={t}
              open={!!editTeamId}
              onOpenChange={(o) => !o && setEditTeamId(null)}
              onSaved={() => void utils.sports.getLeague.invalidate({ id: league.id })}
            />
          );
        })()}

      {/* Full-Screen Championship Takeover Reveal */}
      {celebratingChampion && (
        <ChampionshipRevealOverlay
          isOpen={!!celebratingChampion}
          championName={celebratingChampion.championName}
          seasonNumber={celebratingChampion.seasonNumber}
          leagueName={league.name}
          sportPreset={league.sportPreset}
          onClose={() => setCelebratingChampion(null)}
        />
      )}

      {/* Sports Command Palette (⌘K) */}
      <SportsCommandPalette
        onNavigateSection={(sec) => handleNavigate(sec as SportsNavSection)}
        onSimulateNext={
          canManageLeague && activeSeason && schedule?.matches
            ? () => {
                const nextMatch = schedule.matches.find((m) => m.status === "scheduled");
                if (nextMatch) {
                  simulateMatchDay.mutate({
                    seasonId: activeSeason.id,
                    matchDay: nextMatch.matchDay,
                  });
                }
              }
            : undefined
        }
        teams={league.teams?.map((t) => ({ id: t.id, name: t.name, logo: t.logo }))}
      />
    </>
  );
}
