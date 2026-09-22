"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { withBasePath } from "~/lib/base-path";
import { SPORT_PRESETS } from "~/lib/sports/presets";
import { SportsShell } from "~/components/sports/core/SportsShell";
import { SportsCommandBar } from "~/components/sports/core/SportsCommandBar";
import { type SportsNavSection, CLUB_NAV_ITEMS } from "~/components/sports/core/SportsSidebarNav";
import { TeamSettingsModal } from "~/components/sports/league/TeamSettingsModal";
import { SPORT_EMOJIS, getSportTheme } from "~/lib/sports/theming";
import {
  ArrowLeft,
  Trophy,
  Shield,
  Settings,
  OpenNewWindow as ExternalLink,
  MapPin,
  WhiteFlag as Flag,
} from "iconoir-react";

// Modular Sections
import { ClubOverviewSection } from "~/components/sports/club/sections/ClubOverviewSection";
import { ClubRosterSection, type RosterPlayerItem } from "~/components/sports/club/sections/ClubRosterSection";
import { ClubTacticsSection } from "~/components/sports/club/sections/ClubTacticsSection";
import { ClubTransfersSection } from "~/components/sports/club/sections/ClubTransfersSection";
import { ClubManagementSection } from "~/components/sports/club/sections/ClubManagementSection";

export interface ClubRouterProps {
  teamId: string;
}

export function ClubRouter({ teamId }: ClubRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const notify = useNotify();

  const sectionParam = (searchParams.get("section") || searchParams.get("tab")) as SportsNavSection | null;
  const [activeSection, setActiveSection] = useState<SportsNavSection>(sectionParam || "overview");

  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayerItem | null>(null);
  const [listPrice, setListPrice] = useState<number>(100);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync state if search params change externally
  useEffect(() => {
    if (sectionParam && sectionParam !== activeSection) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam, activeSection]);

  // Client-side instant navigation with URL synchronization
  const handleNavigate = useCallback((section: SportsNavSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", section);
      url.searchParams.delete("tab");
      window.history.pushState(null, "", url.toString());
    }
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

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = api.sports.getTeamOverview.useQuery({ teamId }, { enabled: !!teamId });

  const { data: teamPublic } = api.sports.getTeam.useQuery(
    { id: teamId },
    { enabled: !overview && !overviewLoading && !!teamId }
  );

  const { data: liveActivities } = api.sports.getLiveMatches.useQuery(undefined, {
    refetchInterval: 10000,
    enabled: activeSection === "overview",
  });

  const { data: history } = api.sports.getTeamSeasonHistory.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  const updateTeamTactics = api.sports.updateTeamTactics.useMutation({
    onSuccess: () => {
      notify.success("Tactics updated successfully");
      void refetchOverview();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update tactics");
    },
  });

  const setClubNotifications = api.sports.setClubNotifications.useMutation({
    onSuccess: () => {
      notify.success("Match notification preferences updated");
      void refetchOverview();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update notifications");
    },
  });

  const listPlayer = api.sports.listPlayerForTransfer.useMutation({
    onSuccess: () => {
      notify.success("Player listed on the transfer market!");
      setSelectedPlayer(null);
      void refetchOverview();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to list player");
    },
  });

  const claimTeam = api.sports.claimTeam.useMutation({
    onSuccess: () => {
      notify.success("Team claimed successfully!");
      void refetchOverview();
      router.refresh();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to claim team");
    },
  });

  usePageTitle({
    title: overview?.team?.name
      ? `MyClub - ${overview.team.name}`
      : teamPublic?.name
        ? `MyClub - ${teamPublic.name}`
        : "MyClub",
  });

  if (overviewLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-6 sm:grid-cols-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 sm:col-span-3 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!overview && teamPublic) {
    const publicEmoji = SPORT_EMOJIS[teamPublic.league?.sportPreset ?? ""] ?? "🏆";
    const isClaimed = !!teamPublic.ownerUserId;
    const isOwnedByMe = isClaimed && teamPublic.ownerUserId === user?.id;

    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card className="facet-hierarchy-parent rounded-3xl border border-border/40 p-8 text-center backdrop-blur-2xl">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-border/50 text-4xl shadow-inner"
            style={{ backgroundColor: `${teamPublic.color}25` }}
          >
            {teamPublic.logo ? (
              <img src={teamPublic.logo} alt={teamPublic.name} className="h-full w-full object-cover rounded-3xl" />
            ) : (
              publicEmoji
            )}
          </div>
          <h2 className="text-foreground text-2xl font-black">{teamPublic.name}</h2>
          <p className="text-muted-foreground mt-1 text-xs font-semibold">
            {teamPublic.league?.name} • {teamPublic.city ?? "Imperial League"}
          </p>

          {!isClaimed ? (
            <div className="mt-6 space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                This franchise is currently unclaimed. Take ownership of {teamPublic.name} to set lineups, hire talent, and compete for league honors.
              </p>
              <Button
                className="font-bold cursor-pointer rounded-xl px-6 py-2.5 active:scale-[0.98]"
                onClick={() => claimTeam.mutate({ teamId })}
                disabled={claimTeam.isPending}
              >
                {claimTeam.isPending ? "Claiming..." : "Claim Club"}
              </Button>
            </div>
          ) : isOwnedByMe ? (
            <div className="mt-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                You own this club. Refreshing session data...
              </p>
              <Button
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => void refetchOverview()}
              >
                Reload Dashboard
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Shield className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                This club is managed by another registered director.
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Card className="facet-hierarchy-parent text-center p-8 rounded-3xl">
          <CardContent className="space-y-4">
            <Trophy className="text-muted-foreground/40 mx-auto h-12 w-12" />
            <h3 className="text-foreground text-lg font-bold">Club not found</h3>
            <p className="text-muted-foreground text-xs">
              The franchise you are looking for does not exist or has been relocated.
            </p>
            <Button
              className="mt-4 cursor-pointer font-semibold rounded-xl"
              onClick={() => router.push(withBasePath("/myclub"))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to MyClub Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { team, activeSeason, currentStandings, upcomingMatches } = overview;
  const liveMatch =
    liveActivities?.find((m: { homeTeamId: string; awayTeamId: string }) => m.homeTeamId === teamId || m.awayTeamId === teamId) ?? null;
  const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "🏆";
  const sportPresetAttrs =
    SPORT_PRESETS.find((p) => p.key === team.league?.sportPreset)?.ratingVector ?? [];

  const sportTheme = getSportTheme(team.league?.sportPreset);

  const heroSection = (
    <div className="facet-hierarchy-parent relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-lg backdrop-blur-xl">
      {team.coverImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={withBasePath(team.coverImage)}
            alt=""
            className="h-full w-full object-cover opacity-30 blur-[1px] filter"
          />
          <div className="from-card via-card/60 absolute inset-0 bg-gradient-to-t to-transparent" />
        </div>
      )}

      <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 text-3xl shadow-inner"
            style={{ backgroundColor: team.color ? `${team.color}25` : "rgba(255,255,255,0.05)" }}
          >
            {team.logo ? (
              <img src={team.logo} alt={team.name} className="h-full w-full object-cover" />
            ) : (
              emoji
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-foreground text-2xl font-black tracking-tight">{team.name}</h1>
              {team.shortName && (
                <Badge variant="outline" className="border-border/60 text-xs font-bold">
                  {team.shortName}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold">
              {team.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {team.city}
                </span>
              )}
              {team.league && (
                <Link
                  href={withBasePath(`/myleague/${team.leagueId}`)}
                  className="hover:text-foreground flex items-center gap-1 hover:underline"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{team.league.name}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            data-cuelume-press="subtle"
            className="h-8 border-border/50 bg-card/60 text-xs font-medium hover:bg-muted/40 active:scale-[0.98]"
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Manage Club
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <ClubOverviewSection
            team={team as unknown as Parameters<typeof ClubOverviewSection>[0]["team"]}
            activeSeason={activeSeason}
            currentStandings={currentStandings}
            upcomingMatches={upcomingMatches}
            history={history}
            liveMatch={liveMatch}
            isUpdatingNotifications={setClubNotifications.isPending}
            onUpdateNotifications={(enabled) =>
              setClubNotifications.mutate({ teamId, enabled })
            }
            onTrained={() => void refetchOverview()}
          />
        );

      case "roster":
        return (
          <ClubRosterSection
            team={team as unknown as Parameters<typeof ClubRosterSection>[0]["team"]}
            sportPresetAttributes={sportPresetAttrs}
            onListPlayer={(player) => setSelectedPlayer(player)}
            onTrained={() => void refetchOverview()}
          />
        );

      case "tactics":
        return (
          <ClubTacticsSection
            team={team as unknown as Parameters<typeof ClubTacticsSection>[0]["team"]}
            onUpdateTactics={(params) =>
              updateTeamTactics.mutate({
                teamId: team.id,
                tacticalIntent: params.tacticalIntent ?? team.tacticalIntent ?? "neutral",
                attackFocus: params.attackFocus ?? 50,
                teamIntensity: params.teamIntensity ?? 50,
              })
            }
            isUpdatingTactics={updateTeamTactics.isPending}
            onSavedLineup={() => void refetchOverview()}
          />
        );

      case "transfers":
        return (
          <ClubTransfersSection
            teamId={team.id}
            teamColor={team.color ?? "#3b82f6"}
            squadPlayers={(team.players ?? []) as unknown as Parameters<typeof ClubTransfersSection>[0]["squadPlayers"]}
            onRefreshOverview={() => void refetchOverview()}
          />
        );

      case "management":
        return (
          <ClubManagementSection
            team={team as unknown as Parameters<typeof ClubManagementSection>[0]["team"]}
            onRefetchOverview={() => void refetchOverview()}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <SportsShell
        activeSection={activeSection}
        onNavigate={handleNavigate}
        mode="club"
        sportPreset={team.league?.sportPreset}
        commandBar={
          <SportsCommandBar
            title={team.name}
            subtitle={team.league?.name ?? "Club"}
            lobbyHref="/myclub"
            lobbyLabel="MyClub Lobby"
            activeSectionLabel={CLUB_NAV_ITEMS.find((item) => item.id === activeSection)?.label}
            sportPreset={team.league?.sportPreset}
            logo={team.logo}
            color={team.color}
            canManage={true}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }
        heroSection={heroSection}
      >
        {renderSectionContent()}
      </SportsShell>

      {/* List Player on Transfer Market Dialog */}
      <Dialog open={!!selectedPlayer} onOpenChange={(o) => !o && setSelectedPlayer(null)}>
        <DialogContent className="border-border/40 bg-card/95 max-w-md rounded-3xl p-6 backdrop-blur-2xl">
          <DialogHeader className="px-0">
            <DialogTitle className="text-lg font-bold">
              List {selectedPlayer?.firstName} {selectedPlayer?.lastName}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              List this athlete on the open transfer marketplace for sealed escrow bidding.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-bold uppercase tracking-wider">
                Asking Valuation (Sovereigns)
              </label>
              <Input
                type="number"
                min={10}
                value={listPrice}
                onChange={(e) => setListPrice(Number(e.target.value))}
                className="border-border/50 bg-background/50 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl"
              onClick={() => setSelectedPlayer(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedPlayer) {
                  listPlayer.mutate({ playerId: selectedPlayer.id, price: listPrice });
                }
              }}
              disabled={listPlayer.isPending}
              style={{ backgroundColor: team.color ?? "#3b82f6" }}
              className="font-bold text-xs text-white rounded-xl shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {listPlayer.isPending ? "Listing..." : "Confirm Listing"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TeamSettingsModal
        team={team as unknown as Parameters<typeof TeamSettingsModal>[0]["team"]}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => void refetchOverview()}
      />
    </>
  );
}
