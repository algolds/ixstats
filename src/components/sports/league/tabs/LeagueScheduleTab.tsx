"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Play,
  FastArrowRight as FastForward,
  SystemRestart as Loader2,
  Calendar,
  Check,
  FireFlame as Flame,
  ArrowRight,
  Clock,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { soundEffects } from "~/lib/sound/cuelume";

export interface LeagueScheduleTabProps {
  leagueId: string;
  activeSeasonId?: string;
  latestSeasonId?: string;
  sportPreset: string;
  archetype: string;
  onSeasonTransition?: (newSeasonId: string) => void;
  onTeamClick?: (teamId: string) => void;
  onMatchClick?: (matchId: string) => void;
}

export function LeagueScheduleTab({
  leagueId,
  activeSeasonId,
  latestSeasonId,
  sportPreset,
  archetype,
  onSeasonTransition,
  onTeamClick,
  onMatchClick,
}: LeagueScheduleTabProps) {
  const seasonId = activeSeasonId ?? latestSeasonId;
  const utils = api.useUtils();
  const sportColors = getSportColors(sportPreset as SportPresetKey);

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
      void utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const simulateSingleMatch = api.sports.simulateSingleMatch.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      void utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const simulateFullSeason = api.sports.simulateFullSeason.useMutation({
    onSuccess: () => {
      void utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getLeague.invalidate({ id: leagueId });
    },
  });

  const transitionToNextSeason = api.sports.transitionToNextSeason.useMutation({
    onSuccess: (data) => {
      void utils.sports.getSeason.invalidate({ id: seasonId ?? "" });
      void utils.sports.getSchedule.invalidate({ seasonId: seasonId ?? "" });
      void utils.sports.getLeague.invalidate({ id: leagueId });
      onSeasonTransition?.(data?.newSeasonId ?? "");
    },
  });

  // Group matches by MatchDay
  const matchDaysMap = useMemo(() => {
    const map = new Map<number, NonNullable<typeof schedule>["matches"]>();
    if (schedule?.matches) {
      for (const m of schedule.matches) {
        const day = m.matchDay;
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(m);
      }
    }
    return map;
  }, [schedule]);

  const allRounds = useMemo(() => {
    return Array.from(matchDaysMap.keys()).sort((a, b) => a - b);
  }, [matchDaysMap]);

  // Determine the active round
  const initialActiveRound = useMemo(() => {
    if (allRounds.length === 0) return 1;
    const firstUnfinished = allRounds.find((round) =>
      matchDaysMap.get(round)?.some((m) => m.status === "scheduled")
    );
    return firstUnfinished ?? allRounds[allRounds.length - 1] ?? 1;
  }, [allRounds, matchDaysMap]);

  const [selectedRound, setSelectedRound] = useState<number>(initialActiveRound);

  // Sync state if round data loads
  React.useEffect(() => {
    if (initialActiveRound && selectedRound === 1 && allRounds.length > 0) {
      setSelectedRound(initialActiveRound);
    }
  }, [initialActiveRound, allRounds.length]);

  if (!seasonId) {
    return (
      <Card className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h3 className="text-base font-bold text-foreground">No Schedule Available</h3>
        <p className="text-xs text-muted-foreground mt-1">Start a season to generate fixtures.</p>
      </Card>
    );
  }

  if (seasonLoading || scheduleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!season || !schedule) {
    return (
      <Card className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center">
        <p className="text-xs text-muted-foreground">Unable to load competition fixtures.</p>
      </Card>
    );
  }

  const selectedRoundMatches = matchDaysMap.get(selectedRound) ?? [];
  const isRoundCompleted =
    selectedRoundMatches.length > 0 &&
    selectedRoundMatches.every((m) => m.status === "completed");
  const isRoundActive = selectedRoundMatches.some((m) => m.status === "scheduled");

  return (
    <div className="space-y-6">
      {/* ─── 1. TIMELINE SCRUBBER RIBBON ─── */}
      <div className="rounded-3xl border border-border/40 bg-card/70 p-5 shadow-lg backdrop-blur-xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-500/30 bg-cyan-500/10 text-xs font-black uppercase tracking-wider text-cyan-400"
              >
                COMPETITION TIMELINE
              </Badge>
              <span className="text-xs text-muted-foreground font-semibold">
                Season {season.seasonNumber} • {allRounds.length} Total Rounds
              </span>
            </div>
            <h3 className="mt-1 text-xl font-black text-foreground">
              Round {selectedRound} Fixtures
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {initialActiveRound !== selectedRound && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedRound(initialActiveRound)}
                className="h-9 rounded-xl text-xs font-bold border-border/60 hover:bg-muted/40 cursor-pointer"
              >
                Jump to Active (R{initialActiveRound})
              </Button>
            )}

            {isRoundActive && (
              <Button
                size="sm"
                onClick={() => {
                  soundEffects.bloom();
                  simulateMatchDay.mutate({
                    seasonId: season.id,
                    matchDay: selectedRound,
                  });
                }}
                disabled={simulateMatchDay.isPending}
                data-cuelume-press="subtle"
                className="h-9 rounded-xl bg-foreground text-background font-bold text-xs shadow-md transition hover:bg-foreground/90 active:scale-[0.98] cursor-pointer"
              >
                {simulateMatchDay.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    <span>Simulating Round {selectedRound}...</span>
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5 fill-background" />
                    <span>Simulate Round {selectedRound}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Horizontal Round Scrubber Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
          {allRounds.map((round) => {
            const matchesInDay = matchDaysMap.get(round) ?? [];
            const isCompleted =
              matchesInDay.length > 0 && matchesInDay.every((m) => m.status === "completed");
            const isCurrentActive = round === initialActiveRound;
            const isSelected = round === selectedRound;

            return (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={cn(
                  "group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black uppercase transition-all duration-200 active:scale-[0.98]",
                  isSelected
                    ? "border-foreground bg-foreground text-background shadow-md"
                    : isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : isCurrentActive
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-400 animate-pulse"
                        : "border-border/40 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isCurrentActive ? (
                  <Play className="h-3 w-3 fill-amber-400" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                )}
                <span>R{round}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 2. MATCHDAY FIXTURE CARDS GRID ─── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {selectedRoundMatches.map((m) => {
            const isCompleted = m.status === "completed";
            const homeScore = m.homeScore ?? 0;
            const awayScore = m.awayScore ?? 0;

            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  onClick={() => onMatchClick?.(m.id)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  {/* Top Bar: Match status & Rivalry Tag */}
                  <div className="flex items-center justify-between border-b border-border/20 pb-2.5 text-xs font-bold uppercase">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-black",
                          isCompleted
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {isCompleted ? "Final Result" : "Scheduled"}
                      </span>
                      {m.isRivalry && (
                        <Badge
                          variant="outline"
                          className="border-red-500/30 bg-red-500/10 text-xs font-bold text-red-400 flex items-center gap-1"
                        >
                          <Flame className="h-3 w-3" />
                          Rivalry
                        </Badge>
                      )}
                    </div>

                    <span className="text-muted-foreground text-xs font-medium">
                      Match #{m.id.slice(-4).toUpperCase()}
                    </span>
                  </div>

                  {/* Teams & Score Row */}
                  <div className="grid grid-cols-5 items-center gap-2 py-4">
                    {/* Home Team */}
                    <div
                      className="col-span-2 flex items-center gap-2.5 min-w-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTeamClick?.(m.homeTeam.id);
                      }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-background/80 shadow-xs">
                        {m.homeTeam.logo ? (
                          <img
                            src={withBasePath(m.homeTeam.logo)}
                            alt={m.homeTeam.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: m.homeTeam.color ?? "#3b82f6" }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-xs font-medium block">Home</span>
                        <h4 className="line-clamp-1 text-sm font-extrabold text-foreground group-hover:text-primary transition-colors">
                          {m.homeTeam.name}
                        </h4>
                      </div>
                    </div>

                    {/* Center Score / VS Badge */}
                    <div className="col-span-1 text-center">
                      {isCompleted ? (
                        <div className="flex items-center justify-center gap-1.5 font-mono text-lg font-black text-foreground">
                          <span className={cn(homeScore > awayScore && "text-emerald-400")}>
                            {homeScore}
                          </span>
                          <span className="text-muted-foreground font-normal">-</span>
                          <span className={cn(awayScore > homeScore && "text-emerald-400")}>
                            {awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1 text-xs font-black uppercase text-muted-foreground">
                          VS
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div
                      className="col-span-2 flex items-center justify-end gap-2.5 min-w-0 text-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTeamClick?.(m.awayTeam.id);
                      }}
                    >
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-xs font-medium block">Away</span>
                        <h4 className="line-clamp-1 text-sm font-extrabold text-foreground group-hover:text-primary transition-colors">
                          {m.awayTeam.name}
                        </h4>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-background/80 shadow-xs">
                        {m.awayTeam.logo ? (
                          <img
                            src={withBasePath(m.awayTeam.logo)}
                            alt={m.awayTeam.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: m.awayTeam.color ?? "#ef4444" }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="flex items-center justify-between border-t border-border/20 pt-2.5">
                    <span className="text-xs text-muted-foreground font-medium">
                      {isCompleted ? "Click to view analysis" : "Fixture scheduled"}
                    </span>

                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            simulateSingleMatch.mutate({ matchId: m.id });
                          }}
                          disabled={simulateSingleMatch.isPending}
                          className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <Play className="mr-1 h-3 w-3 fill-current" />
                          Simulate
                        </Button>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LeagueScheduleTab;
