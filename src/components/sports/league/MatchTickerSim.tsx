"use client";

import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Play, Pause, RotateCcw, Flame, Shield, Users, Activity, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";

interface MatchTickerSimProps {
  homeTeam: { name: string; color: string; shortName?: string | null };
  awayTeam: { name: string; color: string; shortName?: string | null };
  trace: any[];
  homeScoreFinal?: number;
  awayScoreFinal?: number;
  onFinished?: () => void;
}

export function MatchTickerSim({
  homeTeam,
  awayTeam,
  trace,
  homeScoreFinal,
  awayScoreFinal,
  onFinished,
}: MatchTickerSimProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [traceIndex, setTraceIndex] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [alertEvent, setAlertEvent] = useState<any | null>(null);

  const currentStep = trace[traceIndex];

  useEffect(() => {
    if (!isPlaying) return;

    if (traceIndex >= trace.length) {
      setIsPlaying(false);
      if (onFinished) onFinished();
      return;
    }

    const timer = setTimeout(() => {
      const step = trace[traceIndex];
      if (step) {
        // Update scores if event is goal
        if (step.type === "goal") {
          if (step.team === "home") {
            setHomeScore((s) => s + 1);
          } else {
            setAwayScore((s) => s + 1);
          }
          // Trigger goal overlay alert
          setAlertEvent(step);
          setTimeout(() => setAlertEvent(null), 2500);
        } else if (step.type === "card" || step.type === "injury" || step.type === "tactic_shift") {
          // Trigger notification popup
          setAlertEvent(step);
          setTimeout(() => setAlertEvent(null), 2000);
        }
      }
      setTraceIndex((idx) => idx + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [traceIndex, isPlaying, trace, onFinished]);

  const handleReset = () => {
    setTraceIndex(0);
    setHomeScore(0);
    setAwayScore(0);
    setIsPlaying(true);
    setAlertEvent(null);
  };

  const currentMinute = currentStep ? currentStep.t : 90;

  return (
    <Card className="facet-hierarchy-child border-border relative overflow-hidden rounded-3xl">
      {/* Background glow highlights dynamically using home & away team colors */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(135deg, ${homeTeam.color}20, transparent, ${awayTeam.color}20)`,
        }}
      />

      <CardContent className="relative z-10 space-y-6 p-6">
        {/* Header Live / Sim control panel */}
        <div className="flex items-center justify-between">
          <Badge className="flex animate-pulse items-center gap-1 bg-red-600 px-2 py-0.5 font-bold text-white dark:bg-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            LIVE SIMULATOR
          </Badge>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-foreground hover:bg-muted"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              className="text-foreground hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Dynamic Island Alert Overlay */}
        <div className="flex h-16 items-center justify-center">
          <AnimatePresence mode="wait">
            {alertEvent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                className={cn(
                  "z-20 flex items-center gap-3 rounded-full border px-6 py-2.5 text-sm font-semibold shadow-xl backdrop-blur-xl",
                  alertEvent.type === "goal"
                    ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : alertEvent.type === "card"
                      ? "border-yellow-500/30 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                      : alertEvent.type === "injury"
                        ? "border-rose-500/30 bg-rose-500/20 text-rose-600 dark:text-rose-400"
                        : "border-blue-500/30 bg-blue-500/20 text-blue-600 dark:text-blue-400"
                )}
              >
                {alertEvent.type === "goal" && (
                  <Flame className="h-4 w-4 animate-bounce text-emerald-600 dark:text-emerald-400" />
                )}
                {alertEvent.type === "card" && <Shield className="h-4 w-4" />}
                {alertEvent.type === "injury" && (
                  <Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
                {alertEvent.type === "tactic_shift" && <Users className="h-4 w-4" />}
                <span>
                  {alertEvent.type === "goal" && `GOAL! (${alertEvent.t}')`}
                  {alertEvent.type === "card" && `CARD / PENALTY (${alertEvent.t}')`}
                  {alertEvent.type === "injury" && `INJURY DETECTED (${alertEvent.t}')`}
                  {alertEvent.type === "tactic_shift" && `TACTICAL SHIFT (${alertEvent.t}')`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scoreboard display */}
        <div className="relative flex items-center justify-around py-4">
          {/* Home team */}
          <div className="flex w-1/3 flex-col items-center text-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-md"
              style={{
                backgroundColor: `${homeTeam.color}20`,
                border: `2px solid ${homeTeam.color}`,
              }}
            >
              {homeTeam.shortName || homeTeam.name.slice(0, 3).toUpperCase()}
            </div>
            <p className="mt-2 max-w-full truncate text-sm font-bold">{homeTeam.name}</p>
          </div>

          {/* Scores & Clock */}
          <div className="w-1/3 space-y-2 text-center">
            <div className="flex items-center justify-center gap-3 text-5xl font-bold tracking-tight tabular-nums">
              <span>{homeScore}</span>
              <span className="text-foreground/20">:</span>
              <span>{awayScore}</span>
            </div>
            <Badge
              variant="outline"
              className="border-border bg-muted/40 text-muted-foreground font-mono"
            >
              {currentMinute}' min
            </Badge>
          </div>

          {/* Away team */}
          <div className="flex w-1/3 flex-col items-center text-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-md"
              style={{
                backgroundColor: `${awayTeam.color}20`,
                border: `2px solid ${awayTeam.color}`,
              }}
            >
              {awayTeam.shortName || awayTeam.name.slice(0, 3).toUpperCase()}
            </div>
            <p className="mt-2 max-w-full truncate text-sm font-bold">{awayTeam.name}</p>
          </div>
        </div>

        {/* Live commentary feeds banner */}
        <div className="border-border border-t pt-4">
          <p className="text-muted-foreground mb-2 text-[10px] font-bold tracking-wider uppercase">
            Live Commentary
          </p>
          <div className="relative h-12 overflow-hidden">
            <AnimatePresence mode="wait">
              {currentStep && (
                <motion.p
                  key={traceIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-muted-foreground text-xs leading-relaxed italic"
                >
                  {currentStep.description || "Both squads vying for possession."}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
