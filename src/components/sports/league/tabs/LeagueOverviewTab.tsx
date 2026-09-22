"use client";

import React, { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Trophy,
  Play,
  SystemRestart as Loader2,
  Activity,
  FireFlame as Flame,
  Calendar,
  ArrowRight,
  Shield,
  Clock,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { NextMatchCountdown } from "~/components/sports/league/NextMatchCountdown";
import { LatestResults, type MatchEvent } from "~/components/sports/LatestResults";
import { StandingsTable, type StandingsRow } from "~/components/sports/StandingsTable";
import type { SportsNavSection } from "~/components/sports/core/SportsSidebarNav";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

interface StandingLeader {
  teamId: string;
  position?: number | null;
  wins: number;
  losses: number;
  draws?: number | null;
  points: number;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  team: {
    id: string;
    name: string;
    logo?: string | null;
    color?: string | null;
  };
}

export interface LeagueOverviewTabProps {
  leagueId: string;
  seasonId?: string;
  activeSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
  } | null;
  latestSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
    champion?: {
      id: string;
      name: string;
    } | null;
  } | null;
  standings?: StandingLeader[];
  standingsLoading?: boolean;
  latestResultsMatches: MatchEvent[];
  nextMatchDay?: number | null;
  nextMatchIxTime?: number | null;
  progressPct: number;
  sportColors?: {
    accentColor: string;
    highlightColor: string;
  } | null;
  onNavigate: (section: SportsNavSection) => void;
  onTeamClick: (teamId: string) => void;
  onMatchClick: (matchId: string) => void;
  onSimulateMatchDay: (seasonId: string, matchDay: number) => void;
  isSimulatingMatchDay?: boolean;
  onSimulateFullSeason?: (seasonId: string) => void;
  isSimulatingFullSeason?: boolean;
  onTransitionSeason?: (seasonId: string) => void;
  isTransitioningSeason?: boolean;
  onStartSeason?: (leagueId: string) => void;
  isStartingSeason?: boolean;
}

export function LeagueOverviewTab({
  leagueId,
  seasonId,
  activeSeason,
  latestSeason,
  standings,
  standingsLoading,
  latestResultsMatches,
  nextMatchDay,
  nextMatchIxTime,
  progressPct,
  onNavigate,
  onTeamClick,
  onMatchClick,
  onSimulateMatchDay,
  isSimulatingMatchDay,
  onTransitionSeason,
  isTransitioningSeason,
  onStartSeason,
  isStartingSeason,
}: LeagueOverviewTabProps) {
  const topContenders = standings?.slice(0, 3) ?? [];
  const leaderPoints = topContenders[0]?.points ?? 0;

  const standingsRows: StandingsRow[] = useMemo(() => {
    return (standings ?? []).map((s, idx) => ({
      id: s.teamId,
      teamId: s.teamId,
      teamName: s.team.name,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws ?? 0,
      points: s.points,
      pointsFor: s.pointsFor ?? 0,
      pointsAgainst: s.pointsAgainst ?? 0,
      rank: s.position ?? idx + 1,
      color: s.team.color ?? undefined,
      logo: s.team.logo,
    }));
  }, [standings]);

  const handleSimulate = () => {
    if (!activeSeason || !nextMatchDay) return;
    soundEffects.bloom();
    onSimulateMatchDay(activeSeason.id, nextMatchDay);
  };

  return (
    <div className="space-y-8">
      {/* ─── SPLIT COCKPIT (OPTION A) ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3 Column: Standings Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <Trophy className="h-4 w-4 text-amber-400" />
              Standings
            </span>
            <button
              type="button"
              onClick={() => onNavigate("standings")}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition flex items-center gap-1 cursor-pointer active:scale-[0.98]"
            >
              <span>Full Table</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {standingsLoading ? (
            <div className="space-y-2 rounded-2xl border border-border/40 bg-card/60 p-6">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-lg">
              <StandingsTable
                standings={standingsRows.slice(0, 8)}
                onTeamClick={onTeamClick}
              />
            </div>
          )}
        </div>

        {/* Right 1/3 Column: Next Round & Top Teams */}
        <div className="space-y-6">
          {/* Next Up / Simulation Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/75 p-5 shadow-lg backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Next Round
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-black uppercase tracking-wider",
                  activeSeason ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-border/40"
                )}
              >
                {activeSeason ? `Round ${nextMatchDay ?? 1}` : "Completed"}
              </Badge>
            </div>

            {activeSeason ? (
              <div className="space-y-3">
                <h3 className="text-base font-black text-foreground">
                  {nextMatchDay ? `Round ${nextMatchDay}` : "Championship"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Simulate matches for this round to update standings and results.
                </p>

                {nextMatchIxTime && (
                  <div className="pt-1">
                    <NextMatchCountdown targetIxTime={nextMatchIxTime} />
                  </div>
                )}

                <Button
                  onClick={handleSimulate}
                  disabled={isSimulatingMatchDay}
                  data-cuelume-press="subtle"
                  className="w-full h-11 gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
                >
                  {isSimulatingMatchDay ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Simulating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>Simulate Round (Space)</span>
                    </>
                  )}
                </Button>
              </div>
            ) : latestSeason?.status === "completed" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span>Season {latestSeason.seasonNumber} Completed</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Won by {latestSeason.champion?.name ?? "Champion"}. Advance to start the next season.
                </p>
                {onTransitionSeason && (
                  <Button
                    onClick={() => onTransitionSeason(latestSeason.id)}
                    disabled={isTransitioningSeason}
                    data-cuelume-press="subtle"
                    className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs active:scale-[0.98] cursor-pointer"
                  >
                    {isTransitioningSeason ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Starting Season...</span>
                      </>
                    ) : (
                      <span>Start Next Season</span>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Start Season 1 to generate the schedule and standings.
                </p>
                {onStartSeason && (
                  <Button
                    onClick={() => onStartSeason(leagueId)}
                    disabled={isStartingSeason}
                    data-cuelume-press="subtle"
                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs active:scale-[0.98] cursor-pointer"
                  >
                    {isStartingSeason ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4 fill-white" />
                        <span>Start Season 1</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Top Teams */}
          {topContenders.length > 0 && (
            <div className="rounded-2xl border border-border/40 bg-card/60 p-5 backdrop-blur-xl shadow-md space-y-3">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                Top Teams
              </span>

              <div className="space-y-2">
                {topContenders.map((contender, idx) => {
                  const ptsGap = contender.points - leaderPoints;
                  return (
                    <div
                      key={contender.team.id}
                      onClick={() => onTeamClick(contender.teamId)}
                      data-cuelume-press="subtle"
                      className={cn(
                        "group flex items-center justify-between rounded-xl border p-2.5 transition hover:bg-muted/30 cursor-pointer active:scale-[0.98]",
                        idx === 0
                          ? "border-amber-400/40 bg-amber-400/10"
                          : "border-border/30 bg-card/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-black text-muted-foreground w-4 text-center">
                          {idx + 1}
                        </span>
                        <div className="h-7 w-7 rounded-lg overflow-hidden border border-border/40 bg-background/80 shrink-0 flex items-center justify-center">
                          {contender.team.logo ? (
                            <img src={withBasePath(contender.team.logo)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-bold text-foreground text-xs truncate">
                          {contender.team.name}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-xs text-foreground">
                          {contender.points} pts
                        </span>
                        {idx > 0 && (
                          <span className="block text-[9px] font-bold text-muted-foreground">
                            {ptsGap} pts
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Results ─── */}
      <section className="space-y-4 border-t border-border/20 pt-6">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Activity className="h-4 w-4 text-cyan-400" />
            Recent Results
          </span>
          <button
            type="button"
            onClick={() => onNavigate("schedule")}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition flex items-center gap-1 cursor-pointer active:scale-[0.98]"
          >
            <span>Full Schedule</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {latestResultsMatches.length > 0 ? (
          <LatestResults
            matches={latestResultsMatches}
            onTeamClick={onTeamClick}
            onMatchClick={onMatchClick}
          />
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center backdrop-blur-md">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-bold text-foreground">No Matches Played Yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulate a round above to view match results.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default LeagueOverviewTab;
