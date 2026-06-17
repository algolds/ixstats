"use client";

import React from "react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  Loader2,
  Activity,
  Trophy,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Clock,
} from "lucide-react";
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
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-10 text-xs border border-white/5 bg-black/10 rounded-2xl backdrop-blur-md">
        <Loader2 className="text-cyan-400 h-5 w-5 animate-spin" />
        <span className="font-semibold tracking-wide animate-pulse">Retrieving match event timeline...</span>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="text-rose-400 py-6 text-center text-xs border border-rose-500/20 bg-rose-500/5 rounded-2xl">
        Failed to load match commentary: {error?.message ?? "Match details not found"}
      </div>
    );
  }

  const evaluation = (match as any).evaluation as Record<string, any> | null;
  const trace = (match as any).trace as Array<Record<string, any>> | null;
  const commentary = (match as any).commentary as string[] | null;

  const hasCommentary = commentary && commentary.length > 0;
  const isGenerating = generateCommentaryMutation.isPending;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    generateCommentaryMutation.mutate({ matchId });
  };

  return (
    <div className="border border-white/10 bg-slate-950/40 mt-3 space-y-4 rounded-2xl p-4 text-left backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Background radial accent */}
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      {/* Volatility & Volumetric metrics */}
      {evaluation && (
        <div className="border-b border-white/5 grid grid-cols-2 gap-3 pb-3 text-[10px] md:grid-cols-4 select-none">
          <div>
            <span className="text-white/40 block font-bold tracking-wider uppercase text-[8px]">
              Win Prob
            </span>
            <span className="font-mono font-bold text-white/90">
              {Math.round((evaluation.winProbability ?? 0.5) * 100)}% Home
            </span>
          </div>
          <div>
            <span className="text-white/40 block font-bold tracking-wider uppercase text-[8px]">
              Possession
            </span>
            <span className="font-mono font-bold text-white/90">
              {Math.round((evaluation.dominance ?? 0.5) * 100)}% Dom
            </span>
          </div>
          <div>
            <span className="text-white/40 block font-bold tracking-wider uppercase text-[8px]">
              Tempo
            </span>
            <span className="font-mono font-bold text-white/90">
              {(evaluation.tempo ?? 1.0).toFixed(1)}x Speed
            </span>
          </div>
          <div>
            <span className="text-white/40 block font-bold tracking-wider uppercase text-[8px]">
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
        <p className="text-white/40 mb-3 text-[9px] font-black tracking-widest uppercase select-none">
          Live Match Feed
        </p>

        {trace && trace.length > 0 ? (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-black/20 rounded-xl border border-white/5 animate-pulse">
                <Sparkles className="h-6 w-6 text-cyan-400 animate-spin" />
                <div>
                  <p className="text-xs font-bold text-white">Tuning AI Narration Transmitters...</p>
                  <p className="text-[10px] text-white/50 mt-1 max-w-[280px]">Drafting play-by-play descriptions with high-fidelity commentary.</p>
                </div>
              </div>
            ) : !hasCommentary ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-black/10 rounded-xl border border-white/5 p-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Sparkles className="h-7 w-7 text-cyan-400 mb-2.5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                <h4 className="text-xs font-extrabold text-white">No AI Commentary Generated</h4>
                <p className="text-[10px] text-white/50 mt-1 mb-4 max-w-[280px]">
                  Experience this match through the eyes of our premium AI sports broadcast team.
                </p>
                <Button
                  onClick={handleGenerate}
                  className="relative overflow-hidden bg-white/10 border border-white/10 text-white text-[10px] font-bold px-4 py-1.5 h-auto rounded-full hover:bg-white/20 transition-all shadow-md group-hover:border-cyan-500/30 group-hover:shadow-cyan-500/10"
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
                    className="hover:bg-white/5 flex items-start gap-3 rounded-xl p-2 transition-colors duration-200 border border-transparent hover:border-white/5"
                  >
                    <span className="text-white/40 min-w-[24px] shrink-0 text-right font-mono text-xs font-black select-none pt-0.5">
                      {step.t}'
                    </span>
                    <div className={cn("flex items-center justify-center h-6 w-6 rounded-full border shrink-0", iconColor)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-white/80 text-xs leading-relaxed font-medium pt-0.5">
                      {(commentary && commentary[idx]) || step.description}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-white/40 text-xs italic select-none">
            <Clock className="h-5 w-5 mb-1 opacity-55" />
            No key events recorded for this match.
          </div>
        )}
      </div>
    </div>
  );
}
