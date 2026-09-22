"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { MatchTickerSim } from "~/components/sports/league/MatchTickerSim";
import { ClubResultsCard } from "~/components/sports/club/ClubResultsCard";
import { TeamTrainingButton } from "~/components/sports/club/TeamTrainingButton";
import { Scoreboard } from "~/components/sports/Scoreboard";
import {
  Calendar,
  Group as Users,
  ArrowSeparate as ArrowLeftRight,
  StatsReport as BarChart3,
  Dollar as DollarSign,
  Trophy,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";

export interface ClubOverviewSectionProps {
  team: {
    id: string;
    name: string;
    city?: string | null;
    color?: string | null;
    logo?: string | null;
    budget?: number | null;
    notifyResults?: boolean;
    players?: Array<{
      id: string;
      ratings?: { overall?: number } | Record<string, unknown> | null;
    }>;
  };
  activeSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
  } | null;
  currentStandings?: {
    wins: number;
    losses: number;
    draws: number;
    points: number;
    pointsFor: number;
    pointsAgainst: number;
  } | null;
  upcomingMatches?: Array<{
    id: string;
    matchDay: number;
    status: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
  }> | null;
  history?: Array<{
    seasonId: string;
    seasonNumber: number;
    wins: number;
    losses: number;
    isChampion?: boolean;
  }> | null;
  liveMatch?: {
    homeTeam: { name: string; color?: string; shortName?: string | null };
    awayTeam: { name: string; color?: string; shortName?: string | null };
    trace?: unknown;
    finalHomeScore?: number | null;
    finalAwayScore?: number | null;
  } | null;
  isUpdatingNotifications?: boolean;
  onUpdateNotifications: (enabled: boolean) => void;
  onTrained: () => void;
}

export function ClubOverviewSection({
  team,
  activeSeason,
  currentStandings,
  upcomingMatches,
  history,
  liveMatch,
  isUpdatingNotifications,
  onUpdateNotifications,
  onTrained,
}: ClubOverviewSectionProps) {
  const router = useRouter();
  const teamColor = team.color || "#3b82f6";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left side info & Live match simulator / Off-season view */}
      <div className="space-y-6 lg:col-span-2">
        {activeSeason ? (
          <>
            {liveMatch ? (
              <MatchTickerSim
                homeTeam={{
                  name: liveMatch.homeTeam.name,
                  color: liveMatch.homeTeam.color ?? "#3b82f6",
                  shortName: liveMatch.homeTeam.shortName,
                }}
                awayTeam={{
                  name: liveMatch.awayTeam.name,
                  color: liveMatch.awayTeam.color ?? "#ef4444",
                  shortName: liveMatch.awayTeam.shortName,
                }}
                trace={liveMatch.trace as unknown[]}
                homeScoreFinal={liveMatch.finalHomeScore ?? undefined}
                awayScoreFinal={liveMatch.finalAwayScore ?? undefined}
              />
            ) : (
              <ClubResultsCard teamId={team.id} />
            )}

            {/* Match notifications toggle */}
            <div className="facet-hierarchy-child border-border/40 bg-card/60 flex items-center justify-between rounded-2xl border p-4 backdrop-blur-md">
              <div className="min-w-0 pr-4">
                <p className="text-sm font-bold text-foreground">Match Notifications</p>
                <p className="text-muted-foreground text-xs font-semibold">
                  Receive notification push alerts when {team.name} competes.
                </p>
              </div>
              <Switch
                checked={team.notifyResults ?? true}
                disabled={isUpdatingNotifications}
                onCheckedChange={onUpdateNotifications}
              />
            </div>

            {/* Record widgets */}
            {currentStandings && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      Record
                    </p>
                    <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
                      {currentStandings.wins}-{currentStandings.losses}
                      {currentStandings.draws > 0 ? `-${currentStandings.draws}` : ""}
                    </p>
                  </CardContent>
                </Card>
                <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      League Points
                    </p>
                    <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
                      {currentStandings.points}
                    </p>
                  </CardContent>
                </Card>
                <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      Scored / Conceded
                    </p>
                    <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
                      {currentStandings.pointsFor} : {currentStandings.pointsAgainst}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        ) : (
          <>
            <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-amber-500 shadow-inner"
                    style={{ color: teamColor, backgroundColor: `${teamColor}20` }}
                  >
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground text-lg font-bold">
                      Off-Season Operations
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-xs font-semibold">
                      The competition is currently in the off-season. Utilize this cycle to tune tactics, train athletes, and manage transfers.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="border-border/30 bg-muted/20 hover:bg-muted/40 rounded-2xl border p-4 transition-all duration-200">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" style={{ color: teamColor }} />
                    <h4 className="text-foreground text-xs font-bold">Train Squad</h4>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Improve specific athlete attributes by conducting targeted drills or initiating team-wide training camps.
                  </p>
                </div>

                <div className="border-border/30 bg-muted/20 hover:bg-muted/40 rounded-2xl border p-4 transition-all duration-200">
                  <div className="mb-2 flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" style={{ color: teamColor }} />
                    <h4 className="text-foreground text-xs font-bold">Scout Transfers</h4>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Explore the sealed-bid transfer market to sign promising athletes or put your own players up for sale.
                  </p>
                </div>

                <div className="border-border/30 bg-muted/20 hover:bg-muted/40 rounded-2xl border p-4 transition-all duration-200">
                  <div className="mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: teamColor }} />
                    <h4 className="text-foreground text-xs font-bold">Tweak Tactics</h4>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Adjust tactical layouts, team shapes, and player roles to outclass your rivals in upcoming matches.
                  </p>
                </div>

                <div className="border-border/30 bg-muted/20 hover:bg-muted/40 rounded-2xl border p-4 transition-all duration-200">
                  <div className="mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" style={{ color: teamColor }} />
                    <h4 className="text-foreground text-xs font-bold">Collect Revenue</h4>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Manage commercial deals, collect gate receipts, and ensure stadium operations align with financial goals.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Club Statistics Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Squad Members
                  </p>
                  <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
                    {team.players?.length ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Avg Roster OVR
                  </p>
                  <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
                    {team.players && team.players.length > 0
                      ? Math.round(
                          team.players.reduce(
                            (acc, p) =>
                              acc +
                              ((p.ratings as { overall?: number } | undefined)?.overall ?? 50),
                            0
                          ) / team.players.length
                        )
                      : 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Available Budget
                  </p>
                  <p className="text-foreground mt-1 text-3xl font-black tabular-nums">
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
          onTrained={onTrained}
        />
        {upcomingMatches && upcomingMatches.length > 0 && (
          <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
                <Calendar className="h-4 w-4 text-cyan-400" />
                Upcoming Fixtures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingMatches.map((m) => {
                const isHome = m.homeTeamId === team.id;
                const homeTeamInfo = {
                  id: m.homeTeam.id,
                  name: m.homeTeam.name,
                  city: isHome ? team.city : null,
                  color: isHome ? team.color ?? undefined : undefined,
                  logo: isHome ? team.logo : null,
                };
                const awayTeamInfo = {
                  id: m.awayTeam.id,
                  name: m.awayTeam.name,
                  city: !isHome ? team.city : null,
                  color: !isHome ? team.color ?? undefined : undefined,
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
        <Card className="facet-hierarchy-child bg-card/45 border-border/40 rounded-2xl backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
              Season Campaign History
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-border/20 divide-y">
            {history && history.length > 0 ? (
              history.map((entry) => (
                <div
                  key={entry.seasonId}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-xs"
                >
                  <div>
                    <p className="text-foreground font-bold">
                      Season {entry.seasonNumber}
                    </p>
                    <p className="text-muted-foreground font-semibold">
                      {entry.wins}W - {entry.losses}L
                    </p>
                  </div>
                  {entry.isChampion && (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold text-xs">
                      <Trophy className="mr-1 h-3.5 w-3.5" /> Champion
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-xs font-semibold">No season records yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClubOverviewSection;
