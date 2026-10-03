"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
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
  liveMatch,
  isUpdatingNotifications,
  onUpdateNotifications,
  onTrained,
}: ClubOverviewSectionProps) {
  const router = useRouter();

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
            <Card padding="md" className="flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <p className="text-headline text-label">Match notifications</p>
                <p className="text-label-secondary text-footnote">
                  Receive notification push alerts when {team.name} competes.
                </p>
              </div>
              <Switch
                checked={team.notifyResults ?? true}
                disabled={isUpdatingNotifications}
                onCheckedChange={onUpdateNotifications}
                aria-label="Match notifications"
              />
            </Card>

            {/* Record widgets */}
            {currentStandings && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Card padding="md">
                  <Stat
                    label="Record"
                    value={
                      <>
                        {currentStandings.wins}-{currentStandings.losses}
                        {currentStandings.draws > 0 ? `-${currentStandings.draws}` : ""}
                      </>
                    }
                  />
                </Card>
                <Card padding="md">
                  <Stat label="League points" value={<>{currentStandings.points}</>} />
                </Card>
                <Card padding="md">
                  <Stat
                    label="Scored / Conceded"
                    value={
                      <>
                        {currentStandings.pointsFor} : {currentStandings.pointsAgainst}
                      </>
                    }
                  />
                </Card>
              </div>
            )}
          </>
        ) : (
          <>
            <Card className="flex flex-col gap-6 py-6">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-tint-fill text-tint rounded-row flex size-12 items-center justify-center">
                    <Calendar className="size-6" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-label text-title-3">Off-Season Operations</CardTitle>
                    <p className="text-label-secondary text-callout">
                      The competition is currently in the off-season. Utilize this cycle to tune
                      tactics, train athletes, and manage transfers.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="text-tint size-4" aria-hidden />
                    <h4 className="text-label text-headline">Train squad</h4>
                  </div>
                  <p className="text-label-secondary text-footnote leading-relaxed">
                    Improve specific athlete attributes by conducting targeted drills or initiating
                    team-wide training camps.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ArrowLeftRight className="text-tint size-4" aria-hidden />
                    <h4 className="text-label text-headline">Scout transfers</h4>
                  </div>
                  <p className="text-label-secondary text-footnote leading-relaxed">
                    Explore the sealed-bid transfer market to sign promising athletes or put your
                    own players up for sale.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <BarChart3 className="text-tint size-4" aria-hidden />
                    <h4 className="text-label text-headline">Tweak tactics</h4>
                  </div>
                  <p className="text-label-secondary text-footnote leading-relaxed">
                    Adjust tactical layouts, team shapes, and player roles to outclass your rivals
                    in upcoming matches.
                  </p>
                </div>

                <div className="bg-surface-secondary rounded-row p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <DollarSign className="text-tint size-4" aria-hidden />
                    <h4 className="text-label text-headline">Collect revenue</h4>
                  </div>
                  <p className="text-label-secondary text-footnote leading-relaxed">
                    Manage commercial deals, collect gate receipts, and ensure stadium operations
                    align with financial goals.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Club Statistics Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card padding="md">
                <Stat label="Squad members" value={<>{team.players?.length ?? 0}</>} />
              </Card>
              <Card padding="md">
                <Stat
                  label="Avg roster OVR"
                  value={
                    <>
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
                    </>
                  }
                />
              </Card>
              <Card padding="md">
                <Stat label="Available budget" value={<>₷{team.budget ?? 0}</>} />
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Right side: training & upcoming fixtures */}
      <div className="space-y-6">
        <TeamTrainingButton
          teamId={team.id}
          playerCount={team.players?.length ?? 0}
          onTrained={onTrained}
        />
        {upcomingMatches && upcomingMatches.length > 0 && (
          <Card className="flex flex-col gap-6 py-6">
            <CardHeader>
              <CardTitle className="text-label flex items-center gap-2">
                <Calendar className="text-label-secondary size-4" aria-hidden />
                Upcoming fixtures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingMatches.map((m) => {
                const isHome = m.homeTeamId === team.id;
                const homeTeamInfo = {
                  id: m.homeTeam.id,
                  name: m.homeTeam.name,
                  city: isHome ? team.city : null,
                  color: isHome ? (team.color ?? undefined) : undefined,
                  logo: isHome ? team.logo : null,
                };
                const awayTeamInfo = {
                  id: m.awayTeam.id,
                  name: m.awayTeam.name,
                  city: !isHome ? team.city : null,
                  color: !isHome ? (team.color ?? undefined) : undefined,
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
      </div>
    </div>
  );
}

export default ClubOverviewSection;
