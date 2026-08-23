"use client";

import React from "react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { SystemRestart as Loader2, Activity, Trophy, WarningTriangle as AlertTriangle, StatUp as TrendingUp, Sparks as Sparkles, Clock } from "iconoir-react";
import { Button } from "~/components/ui/button";

interface MatchCommentaryProps {
  matchId: string;
}

export function MatchCommentary({ matchId }: MatchCommentaryProps) {
  const utils = api.useUtils();
  const { data: match, isLoading, error } = api.sports.getMatchDetails.useQuery({ matchId });

  const generateCommentaryMutation = api.sports.generateMatchCommentary.useMutation({
    onSuccess: () => {
      // Invalidate query to display new commentary
      utils.sports.getMatchDetails.invalidate({ matchId });
    },
  });

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-black/10 py-10 text-xs backdrop-blur-md">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        <span className="animate-pulse font-semibold tracking-wide">
          Retrieving match event timeline...
        </span>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 py-6 text-center text-xs text-rose-400">
        Failed to load match commentary: {error?.message ?? "Match details not found"}
      </div>
    );
  }

  const evaluation = (match as any).evaluation as Record<string, any> | null;
  const trace = (match as any).trace as Array<Record<string, any>> | null;
  const commentary = (match as any).commentary as string[] | null;

  const hasCommentary = commentary && commentary.length > 0;
  const isGenerating = generateCommentaryMutation.isPending;

  const handleGenerate = async (e: React.MouseEvent, force = false) => {
    e.stopPropagation();
    let config: any = undefined;
    try {
      const saved = localStorage.getItem("ixstats:sports:ai-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        config = {
          provider: parsed.provider,
          apiKey: parsed.apiKey || undefined,
          apiUrl: parsed.apiUrl || undefined,
          modelName: parsed.modelName || undefined,
          temperature: parsed.temperature,
        };
      }
    } catch (e) {
      console.error("Failed to load AI config from localStorage", e);
    }
    generateCommentaryMutation.mutate({ matchId, config, force });
  };

  return (
    <div className="relative mt-3 space-y-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-left shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Background radial accent */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-purple-500/5 blur-3xl" />

      {/* Volatility & Volumetric metrics */}
      {evaluation && (
        <div className="grid grid-cols-2 gap-3 border-b border-white/5 pb-3 text-[10px] select-none md:grid-cols-4">
          <div>
            <span className="block text-[8px] font-bold tracking-wider text-white/40 uppercase">
              Win Prob
            </span>
            <span className="font-mono font-bold text-white/90">
              {Math.round((evaluation.winProbability ?? 0.5) * 100)}% Home
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-bold tracking-wider text-white/40 uppercase">
              Possession
            </span>
            <span className="font-mono font-bold text-white/90">
              {Math.round((evaluation.dominance ?? 0.5) * 100)}% Dom
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-bold tracking-wider text-white/40 uppercase">
              Tempo
            </span>
            <span className="font-mono font-bold text-white/90">
              {(evaluation.tempo ?? 1.0).toFixed(1)}x Speed
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-bold tracking-wider text-white/40 uppercase">
              Upset Volatility
            </span>
            <span className="font-mono font-bold text-white/90">
              {(evaluation.volatility ?? 0.5).toFixed(1)} Index
            </span>
          </div>
        </div>
      )}

      {/* Main timeline trace or generation CTA */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[9px] font-semibold tracking-wider text-white/40 uppercase select-none">
            Live Match Feed
          </p>
          {hasCommentary && !isGenerating && (
            <button
              onClick={(e) => handleGenerate(e, true)}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/60 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Regenerate
            </button>
          )}
        </div>

        {trace && trace.length > 0 ? (
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {isGenerating ? (
              <div className="flex animate-pulse flex-col items-center justify-center space-y-3 rounded-xl border border-white/5 bg-black/20 py-12 text-center">
                <Sparkles className="h-6 w-6 animate-spin text-cyan-400" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Tuning AI Narration Transmitters...
                  </p>
                  <p className="mt-1 max-w-[280px] text-[10px] text-white/50">
                    Drafting play-by-play descriptions with high-fidelity commentary.
                  </p>
                </div>
              </div>
            ) : !hasCommentary ? (
              <div className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-black/10 p-4 py-8 text-center">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <Sparkles className="mb-2.5 h-7 w-7 text-cyan-400 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12" />
                <h4 className="text-xs font-bold text-white">No AI Commentary Generated</h4>
                <p className="mt-1 mb-4 max-w-[280px] text-[10px] text-white/50">
                  Experience this match through the eyes of our premium AI sports broadcast team.
                </p>
                <Button
                  onClick={handleGenerate}
                  className="relative h-auto overflow-hidden rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-[10px] font-semibold text-white shadow-md transition-all group-hover:border-cyan-500/30 group-hover:shadow-cyan-500/10 hover:bg-white/20"
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-cyan-300" />
                    Generate AI Commentary
                  </span>
                </Button>
              </div>
            ) : (
              trace.map((step, idx) => {
                let Icon = Activity;
                let iconColor = "text-slate-400 border-slate-500/20 bg-slate-500/10";
                if (step.type === "goal") {
                  Icon = Trophy;
                  iconColor = "text-amber-300 border-amber-500/30 bg-amber-500/15";
                } else if (step.type === "card") {
                  Icon = AlertTriangle;
                  iconColor = "text-rose-400 border-rose-500/30 bg-rose-500/15";
                } else if (step.type === "tactic_shift") {
                  Icon = TrendingUp;
                  iconColor = "text-cyan-300 border-cyan-500/30 bg-cyan-500/15";
                }

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-transparent p-2 transition-colors duration-200 hover:border-white/5 hover:bg-white/5"
                  >
                    <span className="min-w-[24px] shrink-0 pt-0.5 text-right font-mono text-xs font-bold text-white/40 tabular-nums select-none">
                      {step.t}'
                    </span>
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        iconColor
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="pt-0.5 text-xs leading-relaxed font-medium text-white/80">
                      {(commentary && commentary[idx]) || step.description}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-white/40 italic select-none">
            <Clock className="mb-1 h-5 w-5 opacity-55" />
            No key events recorded for this match.
          </div>
        )}
      </div>
    </div>
  );
}
