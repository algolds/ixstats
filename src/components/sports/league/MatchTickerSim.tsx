"use client";

import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { springGentle } from "~/lib/design/motion";
import {
  Play,
  Pause,
  Undo as RotateCcw,
  FireFlame as Flame,
  Shield,
  Group as Users,
  Activity,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

interface MatchTickerSimProps {
  homeTeam: { name: string; color: string; shortName?: string | null };
  awayTeam: { name: string; color: string; shortName?: string | null };
  trace: any[];
  onFinished?: () => void;
}

export function MatchTickerSim({ homeTeam, awayTeam, trace, onFinished }: MatchTickerSimProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [traceIndex, setTraceIndex] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [alertEvent, setAlertEvent] = useState<any | null>(null);

  const currentStep = trace[traceIndex];

  useEffect(() => {
    if (!isPlaying) return;

    if (traceIndex >= trace.length) {
      // oxlint-disable-next-line
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
    <Card padding="lg" className="space-y-6 overflow-hidden">
      {/* Header Live / Sim control panel */}
      <div className="flex items-center justify-between">
        <Badge variant="destructive">
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          Live simulator
        </Badge>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Restart" onClick={handleReset}>
            <RotateCcw />
          </Button>
        </div>
      </div>

      {/* Dynamic Island Alert Overlay */}
      <div className="flex h-16 items-center justify-center">
        <AnimatePresence mode="wait">
          {alertEvent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={springGentle}
              className={cn(
                "text-headline flex items-center gap-2 rounded-full px-4 py-2",
                alertEvent.type === "goal"
                  ? "bg-green/15 text-green"
                  : alertEvent.type === "card"
                    ? "bg-yellow/15 text-yellow"
                    : alertEvent.type === "injury"
                      ? "bg-red/15 text-red"
                      : "bg-blue/15 text-blue"
              )}
            >
              {alertEvent.type === "goal" && <Flame className="size-4" aria-hidden />}
              {alertEvent.type === "card" && <Shield className="h-4 w-4" />}
              {alertEvent.type === "injury" && <Activity className="text-red h-4 w-4" />}
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
            className="text-caption text-label bg-surface-secondary flex size-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${homeTeam.color}20`,
              border: `2px solid ${homeTeam.color}`,
            }}
          >
            {homeTeam.shortName || homeTeam.name.slice(0, 3).toUpperCase()}
          </div>
          <p className="text-headline mt-2 max-w-full truncate">{homeTeam.name}</p>
        </div>

        {/* Scores & Clock */}
        <div className="w-1/3 space-y-2 text-center">
          <div className="text-large-title text-label flex items-center justify-center gap-3 tabular-nums">
            <span>{homeScore}</span>
            <span className="text-label-tertiary">:</span>
            <span>{awayScore}</span>
          </div>
          <Badge variant="default" className="tabular-nums">
            {currentMinute}' min
          </Badge>
        </div>

        {/* Away team */}
        <div className="flex w-1/3 flex-col items-center text-center">
          <div
            className="text-caption text-label bg-surface-secondary flex size-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: `${awayTeam.color}20`,
              border: `2px solid ${awayTeam.color}`,
            }}
          >
            {awayTeam.shortName || awayTeam.name.slice(0, 3).toUpperCase()}
          </div>
          <p className="text-headline mt-2 max-w-full truncate">{awayTeam.name}</p>
        </div>
      </div>

      {/* Live commentary feeds banner */}
      <div className="border-separator border-t pt-4">
        <h4 className="text-subhead text-label-secondary mb-2">Live commentary</h4>
        <div className="relative h-12 overflow-hidden">
          <AnimatePresence mode="wait">
            {currentStep && (
              <motion.p
                key={traceIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-label-secondary text-callout"
              >
                {currentStep.description || "Both squads vying for possession."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}
