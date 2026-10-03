"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Play, SystemRestart as Loader2, Trophy, Activity, ArrowLeft, Clock } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { soundCues } from "~/lib/sound/cuelume";
import { getSportTheme } from "~/lib/sports/theming";
import { MatchSurface } from "~/components/sports/surfaces/MatchSurface";
import { MatchPredictionPanel } from "~/components/sports/match/MatchPredictionPanel";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Stat } from "~/components/ui/stat";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { generateMatchAnalysisFacts, type MatchAnalysisFacts } from "~/lib/sports/analysis";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

interface MatchCenterProps {
  matchId: string;
  onClose?: () => void;
  sportPreset?: string;
  className?: string;
}

type CompeteStatus = "READY" | "SIMULATING" | "RESULT" | "ANALYSIS";

interface TraceEvent {
  minute?: number;
  period?: number;
  type: string;
  actorName?: string;
  teamName?: string;
  description?: string;
}

export function MatchCenter({ matchId, onClose, sportPreset, className }: MatchCenterProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { focusOrganization } = useSportsFocus();

  const [activeTab, setActiveTab] = useState<"surface" | "timeline" | "analysis">("surface");
  const [simulationSpeed, setSimulationSpeed] = useState<"instant" | "brief">("instant");
  const [isSimulatingState, setIsSimulatingState] = useState(false);

  const { data: match, isLoading } = api.sports.getMatchDetails.useQuery(
    { matchId },
    { enabled: !!matchId }
  );

  const simulateMutation = api.sports.simulateSingleMatch.useMutation({
    onSuccess: async () => {
      soundCues.success();
      setIsSimulatingState(false);
      notify.success("Match simulation concluded");
      await utils.sports.getMatchDetails.invalidate({ matchId });
      await utils.sports.getLeague.invalidate();
      await utils.sports.getStandings.invalidate();
    },
    onError: (err) => {
      setIsSimulatingState(false);
      notify.error(err.message || "Failed to simulate match");
    },
  });

  const isCompleted = match?.status === "completed";
  // The server decides with the same rule it enforces (sports/league-access.ts).
  const canSimulate = Boolean(match?.viewerCanManage);

  // Derive COMPETE State Machine status
  const competeStatus: CompeteStatus =
    isSimulatingState || simulateMutation.isPending
      ? "SIMULATING"
      : isCompleted
        ? activeTab === "analysis"
          ? "ANALYSIS"
          : "RESULT"
        : "READY";

  const handleSimulate = useCallback(() => {
    if (!canSimulate || isCompleted || isSimulatingState || simulateMutation.isPending) return;

    setIsSimulatingState(true);

    if (simulationSpeed === "brief") {
      setTimeout(() => {
        simulateMutation.mutate({ matchId });
      }, 1500);
    } else {
      simulateMutation.mutate({ matchId });
    }
  }, [canSimulate, isCompleted, isSimulatingState, simulateMutation, simulationSpeed, matchId]);

  // Spacebar trigger for Simulate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        canSimulate &&
        competeStatus === "READY" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleSimulate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSimulate, competeStatus, handleSimulate]);

  const effectiveSportPreset =
    sportPreset || (match as any)?.season?.league?.sportPreset || "soccer";
  const theme = getSportTheme(effectiveSportPreset);

  // Parse match stats safely
  const statsRecord = useMemo(() => {
    if (!match?.matchStats) return null;
    if (typeof match.matchStats === "string") {
      try {
        return JSON.parse(match.matchStats) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return match.matchStats as Record<string, unknown>;
  }, [match?.matchStats]);

  const trace = useMemo(() => {
    return (Array.isArray(statsRecord?.trace) ? statsRecord.trace : []) as TraceEvent[];
  }, [statsRecord]);

  const analysisFacts = useMemo<MatchAnalysisFacts | null>(() => {
    if (statsRecord?.analysisFacts && typeof statsRecord.analysisFacts === "object") {
      const af = statsRecord.analysisFacts as MatchAnalysisFacts;
      if (Array.isArray(af.tacticalKeynotes) && af.tacticalKeynotes.length > 0) {
        return af;
      }
    }
    if (!match || match.status !== "completed") return null;
    try {
      return generateMatchAnalysisFacts({
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        sportPreset: effectiveSportPreset,
        events: trace as any[],
      });
    } catch {
      return null;
    }
  }, [statsRecord, match, effectiveSportPreset, trace]);

  if (isLoading) {
    return (
      <div className="rounded-sheet border-separator bg-surface space-y-6 border p-6">
        <Skeleton className="rounded-card h-20 w-full" />
        <Skeleton className="rounded-sheet h-64 w-full" />
        <Skeleton className="rounded-card h-40 w-full" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-label-secondary rounded-sheet border-separator bg-surface border p-12 text-center">
        <Activity className="text-label-tertiary mx-auto mb-3 h-12 w-12" />
        <p className="text-headline">Match fixture not found</p>
        {onClose && (
          <Button onClick={onClose} variant="outline" className="mt-4">
            Return
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Top Control & Status Bar */}
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              <ArrowLeft />
              <span>Back</span>
            </Button>
          )}

          <Badge variant="default" className="tabular-nums">
            Matchday {match.matchDay ?? 1}
          </Badge>

          <Badge variant={isCompleted ? "success" : "info"}>
            {competeStatus === "SIMULATING"
              ? "Simulating..."
              : isCompleted
                ? "Completed"
                : "Scheduled"}
          </Badge>
        </div>

        {/* Speed Controls & Simulate Action */}
        <div className="flex items-center gap-2">
          {!isCompleted && canSimulate && (
            <>
              <SegmentedControl
                size="sm"
                aria-label="Simulation speed"
                value={simulationSpeed}
                onValueChange={setSimulationSpeed}
                options={[
                  { value: "instant", label: "Instant" },
                  { value: "brief", label: "Brief" },
                ]}
              />

              <Button onClick={handleSimulate} disabled={competeStatus === "SIMULATING"}>
                {competeStatus === "SIMULATING" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Play className="fill-current" />
                    <span>Simulate (Space)</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scoreboard HUD */}
      <Card padding="lg" className="overflow-hidden">
        <div className="grid grid-cols-3 items-center gap-4 text-center">
          {/* Home Team */}
          <Button
            variant="ghost"
            aria-label={`Focus ${match.homeTeam.name}`}
            onClick={() => {
              onClose?.();
              focusOrganization(match.homeTeam.id);
            }}
            className="rounded-row h-auto flex-col gap-2 p-2 font-normal whitespace-normal"
          >
            <div
              className="border-separator bg-surface-secondary rounded-row text-title-1 flex size-16 items-center justify-center overflow-hidden border sm:size-20"
              style={match.homeTeam.color ? { borderColor: match.homeTeam.color } : undefined}
            >
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{theme.emoji}</span>
              )}
            </div>
            <h3 className="text-headline text-label max-w-[140px] truncate sm:max-w-[200px]">
              {match.homeTeam.name}
            </h3>
            <span className="text-footnote text-label-secondary">Home</span>
          </Button>

          {/* Central Scoreboard */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="bg-surface-secondary rounded-row flex items-center gap-3 px-4 py-2 tabular-nums sm:gap-5">
              <span className="text-large-title text-label">
                {isCompleted ? (match.homeScore ?? 0) : "—"}
              </span>
              <span className="text-headline text-label-tertiary">:</span>
              <span className="text-large-title text-label">
                {isCompleted ? (match.awayScore ?? 0) : "—"}
              </span>
            </div>

            <span className="text-footnote text-label-secondary">
              {isCompleted ? "Final Result" : "Not Started"}
            </span>
          </div>

          {/* Away Team */}
          <Button
            variant="ghost"
            aria-label={`Focus ${match.awayTeam.name}`}
            onClick={() => {
              onClose?.();
              focusOrganization(match.awayTeam.id);
            }}
            className="rounded-row h-auto flex-col gap-2 p-2 font-normal whitespace-normal"
          >
            <div
              className="border-separator bg-surface-secondary rounded-row text-title-1 flex size-16 items-center justify-center overflow-hidden border sm:size-20"
              style={match.awayTeam.color ? { borderColor: match.awayTeam.color } : undefined}
            >
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{theme.emoji}</span>
              )}
            </div>
            <h3 className="text-headline text-label max-w-[140px] truncate sm:max-w-[200px]">
              {match.awayTeam.name}
            </h3>
            <span className="text-footnote text-label-secondary">Away</span>
          </Button>
        </div>
      </Card>

      {/* Prediction market (scheduled matches only) */}
      {match.status === "scheduled" && (
        <MatchPredictionPanel
          matchId={matchId}
          homeName={match.homeTeam.name}
          awayName={match.awayTeam.name}
        />
      )}

      {/* Match Surface & Event Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "surface" | "timeline" | "analysis");
        }}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="surface">Sport surface</TabsTrigger>
          <TabsTrigger value="timeline">
            Event Timeline <span className="tabular-nums">({trace.length})</span>
          </TabsTrigger>
          <TabsTrigger value="analysis">Match analysis</TabsTrigger>
        </TabsList>

        {/* 1. Vector Sport Surface View */}
        <TabsContent value="surface" className="space-y-4 pt-2">
          <Card padding="md" className="relative overflow-hidden">
            <MatchSurface sportPreset={effectiveSportPreset}>
              {/* Event Markers Overlay */}
              {trace.slice(0, 8).map((evt, idx) => (
                <div
                  key={idx}
                  className="bg-surface-elevated text-caption shadow-floating absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 tabular-nums"
                  style={{
                    left: `${20 + ((idx * 9) % 60)}%`,
                    top: `${30 + ((idx * 13) % 40)}%`,
                  }}
                >
                  {evt.minute ? `${evt.minute}'` : ""}{" "}
                  {evt.type === "goal" ? "⚽" : evt.type === "score" ? "🏈" : "•"}
                </div>
              ))}
            </MatchSurface>
          </Card>
        </TabsContent>

        {/* 2. Chronological Timeline */}
        <TabsContent value="timeline" className="space-y-3 pt-2">
          {trace.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={<Clock />}
                title="No recorded events for this fixture yet."
              />
            </Card>
          ) : (
            <div className="bg-surface border-separator divide-separator rounded-row divide-y overflow-hidden border">
              {trace.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="tabular-nums">
                      {event.minute ? `${event.minute}'` : `P${event.period ?? 1}`}
                    </Badge>
                    <div>
                      <p className="text-headline text-label">
                        {event.actorName ? `${event.actorName} · ` : ""}
                        <span className="capitalize">{event.type}</span>
                      </p>
                      {event.description && (
                        <p className="text-footnote text-label-secondary mt-0.5">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {event.teamName && (
                    <span className="text-footnote text-label-secondary">{event.teamName}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. Deterministic Match Analysis */}
        <TabsContent value="analysis" className="space-y-4 pt-2">
          {!analysisFacts ? (
            <Card>
              <EmptyState
                compact
                icon={<Activity />}
                title="Simulate this match to see its analysis."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Tactical Keynotes */}
              {Array.isArray(analysisFacts.tacticalKeynotes) &&
                analysisFacts.tacticalKeynotes.length > 0 && (
                  <Card padding="md" className="space-y-2">
                    <h4 className="text-subhead text-label-secondary">
                      Tactical breakdown & key insights
                    </h4>
                    <div className="space-y-2">
                      {analysisFacts.tacticalKeynotes.map((note, idx) => (
                        <p key={idx} className="text-body text-label flex items-start gap-2">
                          <span className="text-tint font-semibold">•</span>
                          {note}
                        </p>
                      ))}
                    </div>
                  </Card>
                )}

              {/* Conversion & Advantage Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <Card padding="md">
                  <Stat
                    label="Possession delta"
                    value={
                      (analysisFacts.possessionDeltaPct ?? 0) > 0
                        ? `+${analysisFacts.possessionDeltaPct}%`
                        : `${analysisFacts.possessionDeltaPct ?? 0}%`
                    }
                  />
                </Card>

                <Card padding="md">
                  <Stat
                    label="Dominant phase"
                    value={
                      <span className="capitalize">
                        {analysisFacts.dominantPhase ?? "balanced"}
                      </span>
                    }
                  />
                </Card>
              </div>

              {/* Key Performer */}
              {analysisFacts.keyPerformer && (
                <Card padding="md" className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="text-yellow size-6 shrink-0" aria-hidden />
                    <div>
                      <Eyebrow>Standout athlete</Eyebrow>
                      <p className="text-headline text-label">
                        {analysisFacts.keyPerformer.athleteName} (
                        {analysisFacts.keyPerformer.teamName})
                      </p>
                      <p className="text-footnote text-label-secondary">
                        {analysisFacts.keyPerformer.metric}
                      </p>
                    </div>
                  </div>

                  <Badge variant="warning" className="tabular-nums">
                    Impact: {analysisFacts.keyPerformer.impactScore}
                  </Badge>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
