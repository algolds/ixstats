// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
import { cn } from "~/lib/utils";
import { SPORT_PRESETS } from "~/lib/sports/presets";
import { MyLeagueSidebarLayout } from "~/components/myleague/MyLeagueSidebarLayout";
import { type MyLeagueSection } from "~/components/myleague/MyLeagueSidebarNav";
import { TeamSettingsModal } from "~/components/myleague/TeamSettingsModal";
import { Settings } from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { GlareCard } from "~/components/ui/glare-card";
import SportyPlayerCard from "~/components/sports/player-cards/PlayerCard1";
import Scoreboard from "~/components/sports/scoreboards/Scoreboard1";
import PlayerMatchup1 from "~/components/sports/player-matchups/PlayerMatchup1";
import { SponsorWalletDeck } from "~/components/myclub/SponsorWalletDeck";
import { MatchTickerSim } from "~/components/myleague/MatchTickerSim";
import { PlayerTrainingButton } from "~/components/myclub/PlayerTrainingButton";
import { LineupBuilder } from "~/components/myclub/LineupBuilder";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { RevenueCollector } from "~/components/myclub/RevenueCollector";
import { TeamTrainingButton } from "~/components/myclub/TeamTrainingButton";
import {
  ArrowLeft,
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Flag,
  MapPin,
  Shield,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Check,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Flame,
  ArrowLeftRight,
  // eslint-disable-next-line unused-imports/no-unused-imports
  TrendingUp,
  DollarSign,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Briefcase,
  Search,
  ExternalLink,
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
  rookie: { label: "Rookie", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  developing: {
    label: "Developing",
    className: "border-green-500/30 bg-green-500/10 text-green-400",
  },
  prime: { label: "Prime", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  plateau: {
    label: "Plateau",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  },
  declining: {
    label: "Declining",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  retired: { label: "Retired", className: "border-gray-500/30 bg-gray-500/10 text-gray-500" },
};

function PlayerCard({
  player,
  team,
  teamId,
  attributes,
  onList,
  onTrained,
}: {
  player: any;
  team?: any;
  teamId?: string;
  attributes?: string[];
  onList?: (p: any) => void;
  onTrained?: () => void;
}) {
  const ratings = (player.ratings as Record<string, number>) ?? {};

  return (
    <div className="flex flex-col items-center gap-3">
      <SportyPlayerCard player={player} team={team} />
      {onList && (
        <div className="relative z-10 flex w-[320px] gap-1 px-2">
          <Button
            size="sm"
            variant="outline"
            className="border-border bg-muted/40 text-foreground hover:bg-muted/80 h-8 w-full text-[10px]"
            onClick={() => onList(player)}
          >
            Manage Listing
          </Button>
          {teamId && attributes && (
            <div className="relative">
              <PlayerTrainingButton
                playerId={player.id}
                playerName={`${player.firstName} ${player.lastName}`}
                teamId={teamId}
                attributes={attributes}
                currentRatings={ratings}
                onTrained={onTrained}
              />
            </div>
          )}
        </div>
      )}
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
      <div className="space-y-3">
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
  const [activeSection, setActiveSection] = useState<MyLeagueSection>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Transfer Board states
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [listPrice, setListPrice] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [bidAmount, setBidAmount] = useState<number>(150);
  const [biddingTeamId, setBiddingTeamId] = useState("");
  const [comparePlayer, setComparePlayer] = useState<any | null>(null);
  const [attackFocus, setAttackFocus] = useState(50);
  const [teamIntensity, setTeamIntensity] = useState(50);

  const utils = api.useUtils();

  const updateTeamTactics = api.sports.updateTeamTactics.useMutation({
    onSuccess: () => {
      utils.sports.getMyClubOverview.invalidate({ teamId });
      utils.sports.getTeam.invalidate({ id: teamId });
    },
  });

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = api.sports.getMyClubOverview.useQuery({ teamId }, { enabled: !!teamId });

  const { data: teamPublic } = api.sports.getTeam.useQuery(
    { id: teamId },
    { enabled: !!teamId && !overview && !overviewLoading }
  );

  const { data: history } = api.sports.getTeamHistory.useQuery({ teamId }, { enabled: !!teamId });

  const teamLineup = overview?.team?.lineup as any;
  useEffect(() => {
    if (teamLineup) {
      if (typeof teamLineup.attackFocus === "number") {
        setAttackFocus(teamLineup.attackFocus);
      } else {
        setAttackFocus(50);
      }
      if (typeof teamLineup.teamIntensity === "number") {
        setTeamIntensity(teamLineup.teamIntensity);
      } else {
        setTeamIntensity(50);
      }
    }
  }, [teamLineup]);

  const listPlayer = api.sports.listPlayerForTransfer.useMutation({
    onSuccess: () => {
      setSelectedPlayer(null);
      refetchOverview();
      alert("Player listed on Transfer board successfully!");
    },
    onError: (err) => {
      alert(err.message || "Failed to list player");
    },
  });

  const placeBid = api.sports.placeTransferBid.useMutation({
    onSuccess: () => {
      alert("Transfer bid placed successfully! Sovereigns held in escrow.");
      refetchBids?.();
    },
    onError: (err) => {
      alert(err.message || "Failed to place bid");
    },
  });

  const { data: searchResults } = api.sports.searchSportsEntities.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 2 }
  );

  const claimTeam = api.sports.claimTeam.useMutation({
    onSuccess: () => {
      alert("Team claimed successfully!");
      refetchOverview();
      utils.sports.getTeam.invalidate({ id: teamId });
      router.refresh();
    },
    onError: (err) => {
      alert(err.message || "Failed to claim team");
    },
  });

  const { data: bidsData, refetch: refetchBids } = api.sports.getTeamBids.useQuery(
    { teamId },
    { enabled: activeSection === "transfers" }
  );

  const { data: listingsData, refetch: refetchListings } =
    api.sports.getOpenTransferListings.useQuery(undefined, {
      enabled: activeSection === "transfers",
    });

  const respondToBid = api.sports.respondToTransferBid.useMutation({
    onSuccess: (res) => {
      alert(res.message || "Bid processed successfully!");
      refetchBids();
      refetchListings();
      refetchOverview();
    },
    onError: (err) => {
      alert(err.message || "Failed to process bid");
    },
  });

  usePageTitle({
    title: overview?.team?.name
      ? `MyClub - ${overview.team.name}`
      : teamPublic?.name
        ? `MyClub - ${teamPublic.name}`
        : "MyClub",
  });

  const squadComparePlayer = useMemo(() => {
    const players = overview?.team?.players;
    if (!comparePlayer || !players) return null;
    const comparePos = comparePlayer.position || "";
    const samePos = players.filter(
      (p: any) => p.position && p.position.toUpperCase() === comparePos.toUpperCase()
    );
    if (samePos.length === 0) return players[0] || null;
    return (
      [...samePos].sort(
        (a: any, b: any) => (b.ratings?.overall ?? 0) - (a.ratings?.overall ?? 0)
      )[0] || null
    );
  }, [comparePlayer, overview?.team?.players]);

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
            className="border-border/30 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border text-3xl"
            style={{ backgroundColor: `${teamPublic.color}20` }}
          >
            {teamPublic.logo ? (
              <img
                src={teamPublic.logo}
                alt={teamPublic.name}
                className="h-full w-full object-cover"
              />
            ) : (
              publicEmoji
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {teamPublic.logo && (
                <img
                  src={teamPublic.logo}
                  alt=""
                  className="h-8 w-8 rounded-lg border object-cover"
                />
              )}
              <h1 className="truncate text-3xl font-bold">{teamPublic.name}</h1>
            </div>
            <p className="text-muted-foreground">
              {teamPublic.league && (
                <Link
                  href={withBasePath(`/myleague/${teamPublic.leagueId}`)}
                  className="hover:text-foreground inline-flex items-center gap-1 hover:underline"
                >
                  <span>{teamPublic.league.name}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
        </div>

        {!isClaimed ? (
          <Card className="facet-hierarchy-parent">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Shield className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">This team is unclaimed</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Take ownership of {teamPublic.name} and manage its roster, track seasons, and
                compete for championships.
              </p>
              <Button
                className="mt-6"
                onClick={() => claimTeam.mutate({ teamId })}
                disabled={claimTeam.isPending}
              >
                {claimTeam.isPending ? "Claiming..." : "Claim Team"}
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
              <p className="text-muted-foreground mt-2">This team is owned by another user.</p>
            </CardContent>
          </Card>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const { team, activeSeason, currentStandings, upcomingMatches, seasonsCount, championships } =
    overview;
  const emoji = SPORT_EMOJIS[team.league?.sportPreset ?? ""] ?? "\uD83C\uDFC6";
  const sportPresetAttrs =
    SPORT_PRESETS.find((p) => p.key === team.league?.sportPreset)?.ratingVector ?? [];

  const renderSectionContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left side info & Live match simulator / Off-season view */}
            <div className="space-y-6 lg:col-span-2">
              {activeSeason ? (
                <>
                  <MatchTickerSim
                    homeTeam={{ name: team.name, color: team.color }}
                    awayTeam={{ name: "Rival Athletic", color: "#e11d48" }}
                    trace={[
                      {
                        t: 0,
                        type: "tactic_shift",
                        commentary: "Kickoff! Both teams set default shapes.",
                      },
                      {
                        t: 14,
                        type: "tactic_shift",
                        commentary: `${team.name} advances midfielders.`,
                      },
                      {
                        t: 34,
                        type: "goal",
                        teamId: "home",
                        minute: 34,
                        commentary: `WHAT A STRIKE! ${team.name} takes the lead!`,
                      },
                      {
                        t: 45,
                        type: "tactic_shift",
                        commentary: "Half time adjustments underway.",
                      },
                      {
                        t: 62,
                        type: "card",
                        cardType: "yellow",
                        minute: 62,
                        commentary: "Yellow card issued for late challenge.",
                      },
                      {
                        t: 78,
                        type: "goal",
                        teamId: "away",
                        minute: 78,
                        commentary: "Equalizer! Rival Athletic converts the cross.",
                      },
                      {
                        t: 90,
                        type: "tactic_shift",
                        commentary: "Full time whistle. Match ends drawn.",
                      },
                    ]}
                  />

                  {/* Record widgets */}
                  {currentStandings && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card className="facet-hierarchy-child bg-card/45 border-border">
                        <CardContent className="pt-6 text-center">
                          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Record
                          </p>
                          <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                            {currentStandings.wins}-{currentStandings.losses}
                            {currentStandings.draws > 0 ? `-${currentStandings.draws}` : ""}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="facet-hierarchy-child bg-card/45 border-border">
                        <CardContent className="pt-6 text-center">
                          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            League Points
                          </p>
                          <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                            {currentStandings.points}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="facet-hierarchy-child bg-card/45 border-border">
                        <CardContent className="pt-6 text-center">
                          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Scored / Conceded
                          </p>
                          <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                            {currentStandings.pointsFor} : {currentStandings.pointsAgainst}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Card className="facet-hierarchy-child bg-card/45 border-border">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl text-amber-500"
                          style={{ color: team.color, backgroundColor: `${team.color}15` }}
                        >
                          <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-foreground text-lg font-bold">
                            Off-Season Status
                          </CardTitle>
                          <CardDescription className="text-muted-foreground text-xs">
                            The league is currently in the off-season. Make the most of this time to
                            optimize your squad.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="border-border bg-muted/30 hover:bg-muted/50 rounded-2xl border p-4 transition-all duration-300">
                        <div className="mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" style={{ color: team.color }} />
                          <h4 className="text-foreground text-sm font-semibold">Train Roster</h4>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Boost specific player attributes by conducting daily drills or initiating
                          team-wide training camps.
                        </p>
                      </div>

                      <div className="border-border bg-muted/30 hover:bg-muted/50 rounded-2xl border p-4 transition-all duration-300">
                        <div className="mb-2 flex items-center gap-2">
                          <ArrowLeftRight className="h-4 w-4" style={{ color: team.color }} />
                          <h4 className="text-foreground text-sm font-semibold">Scout Transfers</h4>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Explore the transfer market to sign promising athletes or put your own
                          players up for sale.
                        </p>
                      </div>

                      <div className="border-border bg-muted/30 hover:bg-muted/50 rounded-2xl border p-4 transition-all duration-300">
                        <div className="mb-2 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" style={{ color: team.color }} />
                          <h4 className="text-foreground text-sm font-semibold">Tweak Tactics</h4>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Adjust tactical layouts, team shapes, and player roles to outclass your
                          rivals in upcoming matches.
                        </p>
                      </div>

                      <div className="border-border bg-muted/30 hover:bg-muted/50 rounded-2xl border p-4 transition-all duration-300">
                        <div className="mb-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" style={{ color: team.color }} />
                          <h4 className="text-foreground text-sm font-semibold">Collect Revenue</h4>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Manage commercial deals, collect gate receipts, and ensure stadium
                          operations align with financial goals.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Club Statistics Grid */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="facet-hierarchy-child bg-card/45 border-border">
                      <CardContent className="pt-6 text-center">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Squad Members
                        </p>
                        <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                          {team.players?.length ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="facet-hierarchy-child bg-card/45 border-border">
                      <CardContent className="pt-6 text-center">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Avg Roster OVR
                        </p>
                        <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                          {team.players && team.players.length > 0
                            ? Math.round(
                                team.players.reduce(
                                  (acc: number, p: any) => acc + (p.ratings?.overall ?? 0),
                                  0
                                ) / team.players.length
                              )
                            : 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="facet-hierarchy-child bg-card/45 border-border">
                      <CardContent className="pt-6 text-center">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Available Budget
                        </p>
                        <p className="text-foreground mt-1 text-3xl font-extrabold tabular-nums">
                          ₷{team.budget ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>

            {/* Right side matches & history list */}
            <div className="space-y-6">
              <TeamTrainingButton
                teamId={team.id}
                playerCount={team.players?.length ?? 0}
                onTrained={refetchOverview}
              />
              {upcomingMatches && upcomingMatches.length > 0 && (
                <Card className="facet-hierarchy-child bg-card/45 border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                      <Calendar className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                      Upcoming Matches
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingMatches.map((m: any) => {
                      const isHome = m.homeTeamId === team.id;
                      const homeTeamInfo = {
                        id: m.homeTeam.id,
                        name: m.homeTeam.name,
                        city: isHome ? team.city : null,
                        color: isHome ? team.color : undefined,
                        logo: isHome ? team.logo : null,
                      };
                      const awayTeamInfo = {
                        id: m.awayTeam.id,
                        name: m.awayTeam.name,
                        city: !isHome ? team.city : null,
                        color: !isHome ? team.color : undefined,
                        logo: !isHome ? team.logo : null,
                      };

                      return (
                        <Scoreboard
                          key={m.id}
                          homeTeam={homeTeamInfo}
                          awayTeam={awayTeamInfo}
                          title={`Matchday ${m.matchDay}`}
                          status={m.status}
                          onTeamClick={(id) => {
                            if (id === team.id) return;
                            router.push(withBasePath(`/myclub/${id}`));
                          }}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* History list */}
              <Card className="facet-hierarchy-child bg-card/45 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                    <BarChart3 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                    Season Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-border divide-y">
                  {history && history.length > 0 ? (
                    history.map((entry: any) => (
                      <div
                        key={entry.seasonId}
                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                      >
                        <div>
                          <p className="text-foreground text-xs font-bold">
                            Season {entry.seasonNumber}
                          </p>
                          <p className="text-muted-foreground text-[10px]">
                            {entry.wins}W - {entry.losses}L
                          </p>
                        </div>
                        {entry.isChampion && (
                          <Badge className="bg-amber-500 text-[9px] font-bold text-white uppercase">
                            CHAMP
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground py-4 text-center text-xs">
                      No records yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "roster":
        return (
          <div className="space-y-6">
            {/* Player binder card grid */}
            <div>
              <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-bold">
                <Users className="h-5 w-5" style={{ color: team.color }} />
                Active Squad Binder
              </h3>
              <div className="grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {team.players && team.players.length > 0 ? (
                  team.players.map((player: any) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      team={team}
                      teamId={team.id}
                      attributes={sportPresetAttrs}
                      onList={(p) => setSelectedPlayer(p)}
                      onTrained={refetchOverview}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No active players on the roster</p>
                )}
              </div>
            </div>

            {/* List overlay dialog */}
            <Dialog
              open={!!selectedPlayer}
              onOpenChange={(open) => !open && setSelectedPlayer(null)}
            >
              <DialogContent className="border-border bg-background/95 [&>button]:text-muted-foreground [&>button]:hover:text-foreground max-w-md rounded-3xl p-6 backdrop-blur-xl">
                <DialogHeader className="px-0">
                  <DialogTitle className="text-lg font-bold">
                    List {selectedPlayer?.firstName} {selectedPlayer?.lastName}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Put this player on the Transfer marketplace.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-4">
                  <div>
                    <label className="text-muted-foreground mb-1.5 block text-xs font-bold uppercase">
                      Asking Price (Sovereigns)
                    </label>
                    <Input
                      type="number"
                      min={10}
                      value={listPrice}
                      onChange={(e) => setListPrice(Number(e.target.value))}
                      className="border-border bg-background/40"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={() => setSelectedPlayer(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      selectedPlayer &&
                      listPlayer.mutate({ playerId: selectedPlayer.id, price: listPrice })
                    }
                    disabled={listPlayer.isPending}
                    style={{ backgroundColor: team.color }}
                    className="font-semibold text-white transition-all hover:opacity-90"
                  >
                    {listPlayer.isPending ? "Listing..." : "Confirm List"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Coaching Staff */}
            {team.coaches && team.coaches.length > 0 && (
              <Card className="facet-hierarchy-child bg-card/40 border-border mt-6">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Coaching & Strategy Staff</CardTitle>
                </CardHeader>
                <CardContent className="divide-border divide-y">
                  {team.coaches.map((c: any) => {
                    const cStage = CAREER_STAGE_STYLES[c.careerStage] ?? CAREER_STAGE_STYLES.prime;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {c.role} &middot; Age {c.age}
                          </p>
                        </div>
                        <Badge className={cStage.className}>{cStage.label}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "tactics":
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tactical shapes */}
            <div className="lg:col-span-2">
              <Card className="facet-hierarchy-child bg-card/45 border-border">
                <CardHeader>
                  <CardTitle>Team Tactics & Strategy</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Select your default tactical intent. Underlying formulas adjust offense,
                    defense, and match volatility ratings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      key: "neutral",
                      name: "Neutral (Balanced)",
                      description:
                        "Standard balanced formation. No attribute modifications. Best for even matchups or when scouted data is unavailable.",
                      stats: "Offense: Baseline · Defense: Baseline · Volatility: Baseline",
                    },
                    {
                      key: "all_out_attack",
                      name: "All-Out Attack",
                      description:
                        "Commits players forward. Significantly boosts goal scoring chance but leaves the backline highly vulnerable to counters.",
                      stats: "Offense: +10 · Defense: -12 · Volatility & Tempo: High (+0.8)",
                    },
                    {
                      key: "catenaccio",
                      name: "Catenaccio (Bus Parking)",
                      description:
                        "Extreme defensive lock-out. Maximizes defensive resistance while shutting down offense and dropping match volatility to a minimum.",
                      stats: "Offense: -12 · Defense: +15 · Volatility & Tempo: Very Low (-1.0)",
                    },
                    {
                      key: "counter_attack",
                      name: "Counter-Attack",
                      description:
                        "Absorbs pressure and breaks rapidly. Moderately buffs both offense and defense. Automatically counters All-Out Attack (+8 overall bonus).",
                      stats: "Offense: +5 · Defense: +5 · Counter bonus vs All-Out Attack",
                    },
                    {
                      key: "tiki_taka",
                      name: "Tiki-Taka",
                      description:
                        "Focuses on short passing, high possession, and spatial control. Buffs offense and defense while keeping volatility low.",
                      stats: "Offense: +8 · Defense: +4 · Volatility & Tempo: Low (-0.5)",
                    },
                    {
                      key: "gegenpressing",
                      name: "Gegenpressing",
                      description:
                        "Aggressive press upon losing possession. Heavy offensive bonus, high volatility, but leaves backline exposed if bypassed.",
                      stats: "Offense: +12 · Defense: -5 · Volatility & Tempo: High (+0.6)",
                    },
                    {
                      key: "kick_and_rush",
                      name: "Kick and Rush",
                      description:
                        "Direct, high-tempo long-ball play. Direct offensive threat at the cost of defensive organization and higher volatility.",
                      stats: "Offense: +6 · Defense: -8 · Volatility & Tempo: Very High (+1.0)",
                    },
                  ].map((tactic) => {
                    const isActive = team.tacticalIntent === tactic.key;
                    return (
                      <div
                        key={tactic.key}
                        style={
                          isActive
                            ? {
                                borderColor: team.color,
                                backgroundColor: `${team.color}15`,
                                boxShadow: `0 0 0 2px ${team.color}20`,
                              }
                            : {}
                        }
                        className={cn(
                          "cursor-pointer rounded-2xl border p-4 transition-all duration-300",
                          isActive
                            ? "scale-[1.01] border-transparent"
                            : "border-border/50 bg-muted/40 hover:bg-muted/80 text-foreground"
                        )}
                        onClick={() => {
                          if (updateTeamTactics.isPending) return;
                          updateTeamTactics.mutate({
                            teamId: team.id,
                            tacticalIntent: tactic.key,
                            attackFocus,
                            teamIntensity,
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold">{tactic.name}</h4>
                          {isActive && (
                            <Badge
                              style={{ backgroundColor: team.color }}
                              className="font-bold text-white"
                            >
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                          {tactic.description}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Apple Watch style radial control panel */}
            <div>
              <Card className="facet-hierarchy-child bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Strategic Weighting</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-stretch space-y-6 py-6">
                  {/* Offense Ring */}
                  <div className="flex w-full items-center justify-start gap-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg className="h-full w-full -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          className="stroke-muted/30 fill-none"
                          strokeWidth="6"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          className="fill-none transition-all duration-500"
                          style={{ stroke: team.color }}
                          strokeWidth="6"
                          strokeDasharray="163.3"
                          strokeDashoffset={
                            team.tacticalIntent === "all_out_attack"
                              ? "32"
                              : team.tacticalIntent === "park_the_bus" ||
                                  team.tacticalIntent === "catenaccio"
                                ? "130"
                                : team.tacticalIntent === "tiki_taka"
                                  ? "45"
                                  : team.tacticalIntent === "gegenpressing"
                                    ? "20"
                                    : team.tacticalIntent === "kick_and_rush"
                                      ? "60"
                                      : team.tacticalIntent === "counter_attack"
                                        ? "80"
                                        : "90"
                          }
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
                        {team.tacticalIntent === "all_out_attack"
                          ? "+10"
                          : team.tacticalIntent === "park_the_bus" ||
                              team.tacticalIntent === "catenaccio"
                            ? "-12"
                            : team.tacticalIntent === "tiki_taka"
                              ? "+8"
                              : team.tacticalIntent === "gegenpressing"
                                ? "+12"
                                : team.tacticalIntent === "kick_and_rush"
                                  ? "+6"
                                  : team.tacticalIntent === "counter_attack"
                                    ? "+5"
                                    : "0"}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm leading-none font-bold">Offense Bias</h5>
                      <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
                        Adjusts match scoring chances
                      </p>
                    </div>
                  </div>

                  {/* Defense Ring */}
                  <div className="flex w-full items-center justify-start gap-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg className="h-full w-full -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          className="stroke-muted/30 fill-none"
                          strokeWidth="6"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          className="fill-none transition-all duration-500"
                          style={{ stroke: team.color || "#10b981" }}
                          strokeWidth="6"
                          strokeDasharray="163.3"
                          strokeDashoffset={
                            team.tacticalIntent === "all_out_attack"
                              ? "125"
                              : team.tacticalIntent === "park_the_bus" ||
                                  team.tacticalIntent === "catenaccio"
                                ? "20"
                                : team.tacticalIntent === "tiki_taka"
                                  ? "70"
                                  : team.tacticalIntent === "gegenpressing"
                                    ? "110"
                                    : team.tacticalIntent === "kick_and_rush"
                                      ? "120"
                                      : team.tacticalIntent === "counter_attack"
                                        ? "80"
                                        : "90"
                          }
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
                        {team.tacticalIntent === "all_out_attack"
                          ? "-12"
                          : team.tacticalIntent === "park_the_bus" ||
                              team.tacticalIntent === "catenaccio"
                            ? "+15"
                            : team.tacticalIntent === "tiki_taka"
                              ? "+4"
                              : team.tacticalIntent === "gegenpressing"
                                ? "-5"
                                : team.tacticalIntent === "kick_and_rush"
                                  ? "-8"
                                  : team.tacticalIntent === "counter_attack"
                                    ? "+5"
                                    : "0"}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm leading-none font-bold">Defense Bias</h5>
                      <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
                        Concede probability coefficient
                      </p>
                    </div>
                  </div>

                  {/* Sliders Separator */}
                  <div className="my-4 space-y-4 border-t border-white/10 pt-4">
                    <h5 className="text-foreground text-xs font-extrabold tracking-widest uppercase">
                      Custom Sliders
                    </h5>

                    {/* Attack Focus Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground">Attack Focus</span>
                        <span style={{ color: team.color }}>{attackFocus}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={attackFocus}
                        onChange={(e) => setAttackFocus(Number(e.target.value))}
                        onMouseUp={() => {
                          updateTeamTactics.mutate({
                            teamId: team.id,
                            tacticalIntent: team.tacticalIntent,
                            attackFocus,
                            teamIntensity,
                          });
                        }}
                        onTouchEnd={() => {
                          updateTeamTactics.mutate({
                            teamId: team.id,
                            tacticalIntent: team.tacticalIntent,
                            attackFocus,
                            teamIntensity,
                          });
                        }}
                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800"
                        style={{ accentColor: team.color }}
                      />
                      <div className="text-muted-foreground/60 flex justify-between text-[9px]">
                        <span>Defensive (-8 Off)</span>
                        <span>Balanced</span>
                        <span>Attacking (+8 Off)</span>
                      </div>
                    </div>

                    {/* Team Intensity Slider */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground">Team Intensity</span>
                        <span style={{ color: team.color }}>{teamIntensity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={teamIntensity}
                        onChange={(e) => setTeamIntensity(Number(e.target.value))}
                        onMouseUp={() => {
                          updateTeamTactics.mutate({
                            teamId: team.id,
                            tacticalIntent: team.tacticalIntent,
                            attackFocus,
                            teamIntensity,
                          });
                        }}
                        onTouchEnd={() => {
                          updateTeamTactics.mutate({
                            teamId: team.id,
                            tacticalIntent: team.tacticalIntent,
                            attackFocus,
                            teamIntensity,
                          });
                        }}
                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800"
                        style={{ accentColor: team.color }}
                      />
                      <div className="text-muted-foreground/60 flex justify-between text-[9px]">
                        <span>Conservative (-0.5 Vol)</span>
                        <span>Standard</span>
                        <span>Intense (+0.5 Vol)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Lineup Builder */}
            <div className="lg:col-span-3">
              <LineupBuilder
                teamId={team.id}
                teamName={team.name}
                teamColor={team.color}
                players={team.players ?? []}
                presets={SPORT_PRESETS}
                sportPreset={team.league?.sportPreset ?? ""}
                currentLineup={team.lineup as any}
                onSaved={refetchOverview}
              />
            </div>
          </div>
        );

      case "transfers":
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: search and bid action */}
            <div className="space-y-6 lg:col-span-2">
              <Card className="facet-hierarchy-child bg-card/45 border-border">
                <CardHeader>
                  <CardTitle>Transfer Marketplace Search</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Search athletes across leagues to draft or bid.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                      <Input
                        placeholder="Search player name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-border bg-background/40 pl-9"
                      />
                    </div>
                  </div>

                  {searchResults && (
                    <div className="divide-border divide-y pt-2">
                      {searchResults.players?.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-bold">{p.name}</p>
                            <p className="text-muted-foreground text-xs">
                              <PositionTooltip position={p.position}>
                                <span className="hover:text-foreground cursor-help font-medium transition-colors">
                                  {p.position}
                                </span>
                              </PositionTooltip>{" "}
                              &middot; {p.teamName}
                            </p>
                            {p.listing && (
                              <p className="mt-0.5 text-[10px] font-semibold text-cyan-400">
                                Listed for ₷{p.listing.price}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {p.listing && p.listing.status === "open" ? (
                              <>
                                <Input
                                  type="number"
                                  className="border-border bg-background/40 h-8 w-16 text-center text-xs"
                                  placeholder="Bid"
                                  value={bidAmount}
                                  onChange={(e) => setBidAmount(Number(e.target.value))}
                                />
                                <Button
                                  size="sm"
                                  style={{ backgroundColor: team.color }}
                                  className="h-8 text-xs font-semibold text-white transition-all hover:opacity-90"
                                  onClick={() => {
                                    setBiddingTeamId(teamId);
                                    placeBid.mutate({
                                      listingId: p.listing.id,
                                      amount: bidAmount,
                                      bidderTeamId: teamId,
                                    });
                                  }}
                                  disabled={placeBid.isPending}
                                >
                                  Bid
                                </Button>
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-border/50 text-muted-foreground text-[10px]"
                              >
                                Not Listed
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {searchResults.players?.length === 0 && (
                        <p className="text-muted-foreground py-4 text-center text-xs">
                          No athletes found matching query.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Marketplace Listings */}
              <Card className="facet-hierarchy-child bg-card/45 border-border">
                <CardHeader>
                  <CardTitle>Active Transfer Listings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    All players currently listed for transfer in the league.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-border divide-y">
                  {listingsData && listingsData.length > 0 ? (
                    listingsData.map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-bold">
                            {l.player.firstName} {l.player.lastName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            <PositionTooltip position={l.player.position}>
                              <span className="hover:text-foreground cursor-help font-medium transition-colors">
                                {l.player.position}
                              </span>
                            </PositionTooltip>{" "}
                            &middot; {l.player.team.name} &middot; OVR{" "}
                            {l.player.ratings?.overall ?? 50}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-cyan-500 dark:text-cyan-400">
                            Asking Price: ₷{l.price}
                          </p>
                        </div>
                        {l.player.teamId !== teamId ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border text-muted-foreground hover:bg-muted/80 h-8 text-xs"
                              onClick={() => setComparePlayer(l.player)}
                            >
                              Compare
                            </Button>
                            <Input
                              type="number"
                              className="border-border bg-background/40 h-8 w-16 text-center text-xs"
                              placeholder="Bid"
                              defaultValue={l.price}
                              id={`bid-amount-${l.id}`}
                            />
                            <Button
                              size="sm"
                              style={{ backgroundColor: team.color }}
                              className="h-8 text-xs font-semibold text-white transition-all hover:opacity-90"
                              onClick={() => {
                                const inputVal = (
                                  document.getElementById(`bid-amount-${l.id}`) as HTMLInputElement
                                )?.value;
                                const amt = Number(inputVal || l.price);
                                placeBid.mutate({
                                  listingId: l.id,
                                  amount: amt,
                                  bidderTeamId: teamId,
                                });
                              }}
                              disabled={placeBid.isPending}
                            >
                              Bid
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground text-[10px]"
                          >
                            My Player
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      No active listings on the market.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Inbound/Outbound bid list */}
            <div className="space-y-6">
              {comparePlayer && squadComparePlayer && (
                <Card className="facet-hierarchy-child bg-card/45 border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-muted-foreground text-sm font-bold tracking-wider uppercase">
                      Comparison Detail
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-6 px-2 text-[10px]"
                      onClick={() => setComparePlayer(null)}
                    >
                      Clear
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    <PlayerMatchup1
                      playerA={{
                        id: squadComparePlayer.id,
                        firstName: squadComparePlayer.firstName,
                        lastName: squadComparePlayer.lastName,
                        position: squadComparePlayer.position,
                        number: squadComparePlayer.number,
                        overallRating: squadComparePlayer.ratings?.overall ?? 50,
                        teamColor: team.color ?? "#3b82f6",
                        ratings: (squadComparePlayer.ratings as Record<string, number>) ?? {},
                      }}
                      playerB={{
                        id: comparePlayer.id,
                        firstName: comparePlayer.firstName,
                        lastName: comparePlayer.lastName,
                        position: comparePlayer.position,
                        number: comparePlayer.number,
                        overallRating: comparePlayer.ratings?.overall ?? 50,
                        teamColor: comparePlayer.team?.color ?? "#ef4444",
                        ratings: (comparePlayer.ratings as Record<string, number>) ?? {},
                      }}
                      className="border-none bg-transparent p-0 shadow-none dark:bg-transparent"
                    />
                  </CardContent>
                </Card>
              )}
              {/* Inbound Bids */}
              <Card className="facet-hierarchy-child bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <ArrowLeftRight className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    Inbound Bids (Offers on My Players)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bidsData?.inboundBids && bidsData.inboundBids.length > 0 ? (
                    bidsData.inboundBids.map((b: any) => (
                      <div
                        key={b.id}
                        className="border-border bg-muted/40 space-y-2 rounded-xl border p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold">
                              {b.listing.player.firstName} {b.listing.player.lastName}
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              Bid amount: ₷{b.amount}
                            </p>
                          </div>
                          <Badge className="border border-amber-500/20 bg-amber-500/20 text-[9px] font-bold text-amber-500 uppercase dark:text-amber-400">
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            style={{ backgroundColor: team.color }}
                            className="h-7 flex-1 text-xs font-semibold text-white transition-all hover:opacity-90"
                            onClick={() => respondToBid.mutate({ bidId: b.id, action: "accept" })}
                            disabled={respondToBid.isPending}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 flex-1 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => respondToBid.mutate({ bidId: b.id, action: "reject" })}
                            disabled={respondToBid.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      No pending offers on your roster.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Outbound Bids */}
              <Card className="facet-hierarchy-child bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <ArrowLeftRight className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                    My Outbound Bids
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bidsData?.outboundBids && bidsData.outboundBids.length > 0 ? (
                    bidsData.outboundBids.map((b: any) => (
                      <div
                        key={b.id}
                        className="border-border bg-muted/40 flex items-center justify-between rounded-xl border p-3"
                      >
                        <div>
                          <p className="text-xs font-bold">
                            {b.listing.player.firstName} {b.listing.player.lastName}
                          </p>
                          <p className="text-muted-foreground text-[10px]">Bid: ₷{b.amount}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold uppercase",
                            b.status === "accepted" &&
                              "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
                            b.status === "rejected" &&
                              "border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400",
                            b.status === "pending" &&
                              "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                          )}
                        >
                          {b.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      You have no active outbound bids.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "management":
        return (
          <div className="mx-auto max-w-3xl space-y-6">
            <SponsorWalletDeck team={team} refetchTeam={refetchOverview} />
            <RevenueCollector
              teamId={team.id}
              teamBudget={team.budget ?? 0}
              stadiumCapacity={team.stadiumCapacity ?? 5000}
              ticketPrice={team.ticketPrice ?? 15}
              popularity={team.popularity ?? 50}
              sponsor={team.sponsor}
              onCollected={refetchOverview}
              teamColor={team.color}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <MyLeagueSidebarLayout
        activeSection={activeSection}
        onNavigate={setActiveSection}
        teamColor={team.color}
        heroSection={
          <div className="facet-hierarchy-parent border-border bg-card relative mb-4 overflow-hidden rounded-xl border">
            {team.coverImage && (
              <div className="absolute inset-0 z-0">
                <img
                  src={withBasePath(team.coverImage)}
                  alt=""
                  className="h-full w-full object-cover opacity-45 blur-[1px] filter"
                />
                <div className="from-card via-card/50 absolute inset-0 bg-gradient-to-t to-transparent" />
              </div>
            )}
            <div className="relative z-10 p-4 sm:p-5">
              <Button
                variant="ghost"
                onClick={() => router.push(withBasePath("/myclub"))}
                className="text-muted-foreground hover:text-foreground mb-4 h-8 px-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to MyClub
              </Button>

              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl"
                  style={{
                    backgroundColor: `${team.color}20`,
                    border: `1px solid ${team.color}40`,
                  }}
                >
                  {team.logo ? (
                    <img
                      src={withBasePath(team.logo)}
                      alt="Club logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    emoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {team.logo && (
                      <img
                        src={withBasePath(team.logo)}
                        alt=""
                        className="h-8 w-8 rounded-lg border object-cover"
                      />
                    )}
                    <h1 className="text-foreground truncate text-2xl font-bold">{team.name}</h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8 rounded-full"
                      onClick={() => setSettingsOpen(true)}
                      title="Club Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {team.league && (
                      <Link
                        href={withBasePath(`/myleague/${team.leagueId}`)}
                        className="hover:text-foreground inline-flex items-center gap-1 hover:underline"
                      >
                        <span>{team.league.name}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {team.city && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground flex items-center gap-1"
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    {team.city}
                  </Badge>
                )}
                {team.nation && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground flex items-center gap-1"
                  >
                    <Flag className="h-2.5 w-2.5" />
                    {(team.nation as Record<string, string>).name}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="border-border bg-muted/60 text-muted-foreground flex items-center gap-1"
                >
                  <Trophy className="h-2.5 w-2.5 text-amber-500" />
                  {seasonsCount} season{seasonsCount !== 1 ? "s" : ""}
                </Badge>
                {championships > 0 && (
                  <Badge
                    variant="default"
                    className="flex items-center gap-1 bg-amber-500 font-bold text-white hover:bg-amber-500"
                  >
                    <Trophy className="h-2.5 w-2.5" />
                    {championships}x Champion
                  </Badge>
                )}
              </div>

              {/* Quick Stats Grid */}
              <div className="border-border/20 mt-5 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <div className="border-border/30 bg-muted/20 relative overflow-hidden rounded-xl border p-3 backdrop-blur-md">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Current Record
                  </span>
                  <span className="text-foreground mt-1 block text-lg font-black">
                    {currentStandings
                      ? `${currentStandings.wins}W - ${currentStandings.losses}L${
                          currentStandings.draws > 0 ? ` - ${currentStandings.draws}D` : ""
                        }`
                      : "0W - 0L (Offseason)"}
                  </span>
                  {currentStandings?.rank && (
                    <span className="text-muted-foreground/80 mt-1 block text-[10px]">
                      League Rank: #{currentStandings.rank}
                      {currentStandings.points !== undefined && ` (${currentStandings.points} pts)`}
                    </span>
                  )}
                </div>

                <div className="border-border/30 bg-muted/20 relative overflow-hidden rounded-xl border p-3 backdrop-blur-md">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Championships
                  </span>
                  <span className="text-foreground mt-1 block flex items-center gap-1 text-lg font-black">
                    <Trophy className="inline h-4 w-4 text-amber-500" /> {championships}
                  </span>
                  <span className="text-muted-foreground/80 mt-1 block text-[10px]">
                    Over {seasonsCount} season{seasonsCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="border-border/30 bg-muted/20 relative overflow-hidden rounded-xl border p-3 backdrop-blur-md">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Club Budget
                  </span>
                  <span className="text-foreground mt-1 block text-lg font-black">
                    ₷{team.budget?.toLocaleString() ?? "0"}
                  </span>
                  <span className="text-muted-foreground/80 mt-1 block truncate text-[10px]">
                    Sponsor: {(team.sponsor as any)?.name ?? "None"}
                  </span>
                </div>

                <div className="border-border/30 bg-muted/20 relative overflow-hidden rounded-xl border p-3 backdrop-blur-md">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Stadium & Fans
                  </span>
                  <span className="text-foreground mt-1 block text-lg font-black">
                    {team.stadiumCapacity?.toLocaleString() ?? "5,000"} cap
                  </span>
                  <span className="text-muted-foreground/80 mt-1 block text-[10px]">
                    Popularity: {team.popularity ?? 50}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        }
      >
        {renderSectionContent()}
      </MyLeagueSidebarLayout>

      <TeamSettingsModal
        team={{
          id: team.id,
          name: team.name,
          logo: team.logo,
          coverImage: team.coverImage,
          color: team.color,
        }}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
