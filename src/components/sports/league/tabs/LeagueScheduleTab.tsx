"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { springSmooth } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Play,
  SystemRestart as Loader2,
  Calendar,
  Check,
  FireFlame as Flame,
  ArrowRight,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { soundCues } from "~/lib/sound/cuelume";
import { Card } from "~/components/ui/card";

interface LeagueScheduleTabProps {
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
      soundCues.success();
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
      <Card>
        <EmptyState
          icon={<Calendar />}
          title="No schedule available"
          message="Start a season to generate fixtures."
        />
      </Card>
    );
  }

  if (seasonLoading || scheduleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-card h-16 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="rounded-card h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!season || !schedule) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-footnote text-label-secondary">Unable to load competition fixtures.</p>
      </Card>
    );
  }

  const selectedRoundMatches = matchDaysMap.get(selectedRound) ?? [];
  const isRoundCompleted =
    selectedRoundMatches.length > 0 && selectedRoundMatches.every((m) => m.status === "completed");
  const isRoundActive = selectedRoundMatches.some((m) => m.status === "scheduled");

  return (
    <div className="space-y-6">
      {/* ─── 1. TIMELINE SCRUBBER RIBBON ─── */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-footnote text-label-secondary tabular-nums">
              Season {season.seasonNumber} · {allRounds.length} rounds
            </span>
            <h3 className="text-title-2 text-label mt-1">Round {selectedRound} fixtures</h3>
          </div>

          <div className="flex items-center gap-2">
            {initialActiveRound !== selectedRound && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedRound(initialActiveRound)}
              >
                Jump to Active (R{initialActiveRound})
              </Button>
            )}

            {isRoundActive && (
              <Button
                size="sm"
                onClick={() => {
                  simulateMatchDay.mutate({
                    seasonId: season.id,
                    matchDay: selectedRound,
                  });
                }}
                disabled={simulateMatchDay.isPending}
              >
                {simulateMatchDay.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Simulating Round {selectedRound}...</span>
                  </>
                ) : (
                  <>
                    <Play className="fill-current" />
                    <span>Simulate Round {selectedRound}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Horizontal Round Scrubber */}
        <SegmentedControl
          size="sm"
          scrollable
          aria-label="Round"
          value={String(selectedRound)}
          onValueChange={(value) => setSelectedRound(Number(value))}
          options={allRounds.map((round) => {
            const matchesInDay = matchDaysMap.get(round) ?? [];
            const isCompleted =
              matchesInDay.length > 0 && matchesInDay.every((m) => m.status === "completed");
            const isCurrentActive = round === initialActiveRound;
            return {
              value: String(round),
              label: `R${round}`,
              icon: isCompleted ? (
                <Check className="text-green" aria-label="Completed" />
              ) : isCurrentActive ? (
                <Play className="text-yellow fill-current" aria-label="Active" />
              ) : undefined,
            };
          })}
        />
      </Card>

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
                transition={springSmooth}
              >
                <Card
                  padding="md"
                  onClick={() => onMatchClick?.(m.id)}
                  className="group flex flex-col justify-between overflow-hidden"
                  interactive
                >
                  {/* Top Bar: Match status & Rivalry Tag */}
                  <div className="border-separator flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={isCompleted ? "success" : "warning"}>
                        {isCompleted ? "Final Result" : "Scheduled"}
                      </Badge>
                      {m.isRivalry && (
                        <Badge variant="destructive">
                          <Flame />
                          Rivalry
                        </Badge>
                      )}
                    </div>

                    <span className="text-label-secondary text-footnote font-mono">
                      Match #{m.id.slice(-4).toUpperCase()}
                    </span>
                  </div>

                  {/* Teams & Score Row */}
                  <div className="grid grid-cols-5 items-center gap-2 py-4">
                    {/* Home Team */}
                    <div
                      className="col-span-2 flex min-w-0 items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTeamClick?.(m.homeTeam.id);
                      }}
                    >
                      <div className="border-separator bg-surface-secondary rounded-row flex size-9 shrink-0 items-center justify-center overflow-hidden border">
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
                        <span className="text-label-secondary text-footnote block">Home</span>
                        <h4 className="text-headline text-label group-hover:text-tint line-clamp-1 transition-colors">
                          {m.homeTeam.name}
                        </h4>
                      </div>
                    </div>

                    {/* Center Score / VS Badge */}
                    <div className="col-span-1 text-center">
                      {isCompleted ? (
                        <div className="text-title-3 text-label flex items-center justify-center gap-2 tabular-nums">
                          <span className={cn(homeScore > awayScore && "text-green")}>
                            {homeScore}
                          </span>
                          <span className="text-label-secondary font-normal">-</span>
                          <span className={cn(awayScore > homeScore && "text-green")}>
                            {awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-caption text-label-secondary bg-fill-3 rounded-control-sm px-2 py-1">
                          VS
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div
                      className="col-span-2 flex min-w-0 items-center justify-end gap-2 text-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTeamClick?.(m.awayTeam.id);
                      }}
                    >
                      <div className="min-w-0">
                        <span className="text-label-secondary text-footnote block">Away</span>
                        <h4 className="text-headline text-label group-hover:text-tint line-clamp-1 transition-colors">
                          {m.awayTeam.name}
                        </h4>
                      </div>
                      <div className="border-separator bg-surface-secondary rounded-row flex size-9 shrink-0 items-center justify-center overflow-hidden border">
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
                  <div className="border-separator flex items-center justify-between border-t pt-3">
                    <span className="text-footnote text-label-secondary">
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
                        >
                          <Play className="fill-current" />
                          Simulate
                        </Button>
                      )}
                      <ArrowRight
                        className="text-label-tertiary group-hover:text-tint size-4 transition-colors"
                        aria-hidden
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
