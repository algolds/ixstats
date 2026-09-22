"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  SystemRestart as Loader2,
  Trophy,
  CheckCircle,
  Activity,
  ArrowLeft,
  Calendar,
  Shield,
  Clock,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useSportsFocus } from "~/components/sports/core/SportsFocusProvider";
import { soundEffects } from "~/lib/sound/cuelume";
import { getSportTheme } from "~/lib/sports/theming";
import { MatchSurface } from "~/components/sports/surfaces/MatchSurface";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { generateMatchAnalysisFacts, type MatchAnalysisFacts } from "~/lib/sports/analysis";
import { cn } from "~/lib/utils";

export interface MatchCenterProps {
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

export function MatchCenter({
  matchId,
  onClose,
  sportPreset,
  className,
}: MatchCenterProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { focusOrganization, focusAthlete } = useSportsFocus();

  const [activeTab, setActiveTab] = useState<"surface" | "timeline" | "analysis">("surface");
  const [simulationSpeed, setSimulationSpeed] = useState<"instant" | "brief">("instant");
  const [isSimulatingState, setIsSimulatingState] = useState(false);

  const { data: match, isLoading, refetch } = api.sports.getMatchDetails.useQuery(
    { matchId },
    { enabled: !!matchId }
  );

  const simulateMutation = api.sports.simulateSingleMatch.useMutation({
    onSuccess: async (data) => {
      soundEffects.bloom();
      setIsSimulatingState(false);
      notify.success("Match simulation concluded!");
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

  // Derive COMPETE State Machine status
  const competeStatus: CompeteStatus = isSimulatingState || simulateMutation.isPending
    ? "SIMULATING"
    : isCompleted
      ? activeTab === "analysis" ? "ANALYSIS" : "RESULT"
      : "READY";

  const handleSimulate = useCallback(() => {
    if (isCompleted || isSimulatingState || simulateMutation.isPending) return;

    soundEffects.press();
    setIsSimulatingState(true);

    if (simulationSpeed === "brief") {
      setTimeout(() => {
        simulateMutation.mutate({ matchId });
      }, 1500);
    } else {
      simulateMutation.mutate({ matchId });
    }
  }, [isCompleted, isSimulatingState, simulateMutation, simulationSpeed, matchId]);

  // Spacebar trigger for Simulate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        competeStatus === "READY" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleSimulate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [competeStatus, handleSimulate]);

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
      <div className="space-y-6 p-6 rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="p-12 text-center text-muted-foreground rounded-3xl border border-border/40 bg-card/60">
        <Activity className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm font-semibold">Match fixture not found</p>
        {onClose && (
          <Button onClick={onClose} variant="outline" className="mt-4 font-bold text-xs">
            Return
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* ─── Top Control & Status Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              data-cuelume-press="subtle"
              className="h-8 gap-1.5 rounded-xl border-border/50 bg-card/60 text-xs font-bold hover:bg-muted/40 active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          )}

          <Badge variant="outline" className="text-xs font-black uppercase tracking-wider">
            Matchday {match.matchDay ?? 1}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              isCompleted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-400"
            )}
          >
            {competeStatus === "SIMULATING" ? "Simulating..." : isCompleted ? "Completed" : "Scheduled"}
          </Badge>
        </div>

        {/* Speed Controls & Simulate Action */}
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <div className="flex items-center rounded-xl border border-border/40 bg-muted/20 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSimulationSpeed("instant")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition cursor-pointer",
                    simulationSpeed === "instant"
                      ? "bg-card text-foreground shadow-xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Instant
                </button>
                <button
                  type="button"
                  onClick={() => setSimulationSpeed("brief")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition cursor-pointer",
                    simulationSpeed === "brief"
                      ? "bg-card text-foreground shadow-xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Brief
                </button>
              </div>

              <Button
                onClick={handleSimulate}
                disabled={competeStatus === "SIMULATING"}
                data-cuelume-press="subtle"
                className="h-9 gap-2 rounded-xl bg-primary px-4 font-black text-xs text-primary-foreground shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
              >
                {competeStatus === "SIMULATING" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Simulate (Space)</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Scoreboard HUD ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-b from-card/90 via-card/60 to-card/90 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="relative z-10 grid grid-cols-3 items-center gap-4 text-center">
          {/* Home Team */}
          <button
            type="button"
            onClick={() => {
              onClose?.();
              focusOrganization(match.homeTeam.id);
            }}
            data-cuelume-press="subtle"
            className="flex flex-col items-center gap-2 p-2 rounded-2xl transition hover:bg-muted/20 cursor-pointer active:scale-[0.98]"
          >
            <div
              className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/50 text-2xl shadow-lg"
              style={{ backgroundColor: match.homeTeam.color ? `${match.homeTeam.color}20` : "rgba(255,255,255,0.05)" }}
            >
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{theme.emoji}</span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-black text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {match.homeTeam.name}
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Home</span>
          </button>

          {/* Central Scoreboard */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-3 sm:gap-5 px-4 py-2 rounded-2xl border border-border/40 bg-muted/30 backdrop-blur-md shadow-inner">
              <span className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                {isCompleted ? match.homeScore ?? 0 : "—"}
              </span>
              <span className="text-sm font-bold text-muted-foreground/60">:</span>
              <span className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                {isCompleted ? match.awayScore ?? 0 : "—"}
              </span>
            </div>

            <span className="text-[11px] font-semibold text-muted-foreground">
              {isCompleted ? "Final Result" : "Not Started"}
            </span>
          </div>

          {/* Away Team */}
          <button
            type="button"
            onClick={() => {
              onClose?.();
              focusOrganization(match.awayTeam.id);
            }}
            data-cuelume-press="subtle"
            className="flex flex-col items-center gap-2 p-2 rounded-2xl transition hover:bg-muted/20 cursor-pointer active:scale-[0.98]"
          >
            <div
              className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/50 text-2xl shadow-lg"
              style={{ backgroundColor: match.awayTeam.color ? `${match.awayTeam.color}20` : "rgba(255,255,255,0.05)" }}
            >
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{theme.emoji}</span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-black text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {match.awayTeam.name}
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Away</span>
          </button>
        </div>
      </div>

      {/* ─── Match Surface & Event Tabs ─── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          soundEffects.press();
          setActiveTab(v as "surface" | "timeline" | "analysis");
        }}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-border/40 bg-muted/20 p-1">
          <TabsTrigger
            value="surface"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Sport Surface
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Event Timeline ({trace.length})
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer"
          >
            Match Analysis
          </TabsTrigger>
        </TabsList>

        {/* 1. Vector Sport Surface View */}
        <TabsContent value="surface" className="space-y-4 pt-2">
          <div className="relative rounded-3xl overflow-hidden border border-border/40 bg-card/40 p-4 shadow-xl backdrop-blur-xl">
            <MatchSurface sportPreset={effectiveSportPreset}>
              {/* Event Markers Overlay */}
              {trace.slice(0, 8).map((evt, idx) => (
                <div
                  key={idx}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-card/80 p-1 text-[9px] font-bold shadow-md"
                  style={{
                    left: `${20 + (idx * 9) % 60}%`,
                    top: `${30 + (idx * 13) % 40}%`,
                  }}
                >
                  {evt.minute ? `${evt.minute}'` : ""} {evt.type === "goal" ? "⚽" : evt.type === "score" ? "🏈" : "•"}
                </div>
              ))}
            </MatchSurface>
          </div>
        </TabsContent>

        {/* 2. Chronological Timeline */}
        <TabsContent value="timeline" className="space-y-3 pt-2">
          {trace.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground rounded-2xl border border-border/30 bg-card/40">
              <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs font-semibold">No recorded events for this fixture yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trace.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-border/30 bg-card/50 p-3 shadow-xs backdrop-blur-md transition hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] font-mono font-bold">
                      {event.minute ? `${event.minute}'` : `P${event.period ?? 1}`}
                    </Badge>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {event.actorName ? `${event.actorName} · ` : ""}
                        <span className="capitalize">{event.type}</span>
                      </p>
                      {event.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{event.description}</p>
                      )}
                    </div>
                  </div>

                  {event.teamName && (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {event.teamName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. Deterministic Match Analysis */}
        <TabsContent value="analysis" className="space-y-4 pt-2">
          {!analysisFacts ? (
            <div className="py-12 text-center text-muted-foreground rounded-2xl border border-border/30 bg-card/40">
              <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs font-semibold">
                Simulate this match to generate deterministic analysis facts.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tactical Keynotes */}
              {Array.isArray(analysisFacts.tacticalKeynotes) && analysisFacts.tacticalKeynotes.length > 0 && (
                <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Tactical Breakdown & Key Insights
                  </h4>
                  <div className="space-y-1.5">
                    {analysisFacts.tacticalKeynotes.map((note, idx) => (
                      <p key={idx} className="text-xs text-foreground font-medium flex items-start gap-2">
                        <span className="text-primary font-bold">•</span>
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion & Advantage Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Possession Delta
                  </span>
                  <p className="text-xl font-black text-foreground mt-1">
                    {(analysisFacts.possessionDeltaPct ?? 0) > 0
                      ? `+${analysisFacts.possessionDeltaPct}%`
                      : `${analysisFacts.possessionDeltaPct ?? 0}%`}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/30 bg-card/50 p-4 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Dominant Phase
                  </span>
                  <p className="text-xl font-black text-foreground capitalize mt-1">
                    {analysisFacts.dominantPhase ?? "balanced"}
                  </p>
                </div>
              </div>

              {/* Key Performer */}
              {analysisFacts.keyPerformer && (
                <div className="rounded-2xl border border-border/40 bg-card/70 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Standout Athlete
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        {analysisFacts.keyPerformer.athleteName} ({analysisFacts.keyPerformer.teamName})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {analysisFacts.keyPerformer.metric}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-400 text-xs font-black">
                    Impact: {analysisFacts.keyPerformer.impactScore}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MatchCenter;
