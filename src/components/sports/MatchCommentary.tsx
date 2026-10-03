"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  SystemRestart as Loader2,
  Activity,
  Trophy,
  WarningTriangle as AlertTriangle,
  StatUp as TrendingUp,
  Sparks as Sparkles,
  Clock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";

interface MatchCommentaryProps {
  matchId: string;
  autoExpand?: boolean;
  className?: string;
}

interface MatchEvaluation {
  winProbability?: number;
  dominance?: number;
  tempo?: number;
  volatility?: number;
  homeExpectedGoals?: number;
  awayExpectedGoals?: number;
}

export function MatchCommentary({ matchId, autoExpand = false, className }: MatchCommentaryProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [configOpen, setConfigOpen] = useState(false);

  const utils = api.useUtils();
  const {
    data: match,
    isLoading,
    error,
  } = api.sports.getMatchDetails.useQuery({ matchId }, { enabled: !!matchId });

  const generateCommentaryMutation = api.sports.generateMatchCommentary.useMutation({
    onSuccess: () => {
      // Invalidate query to display new commentary
      utils.sports.getMatchDetails.invalidate({ matchId });
    },
  });

  if (isLoading) {
    return (
      <div className="text-label-secondary rounded-card border-separator bg-surface-secondary text-footnote flex flex-col items-center justify-center gap-3 border py-10">
        <Loader2 className="text-teal h-5 w-5 animate-spin" />
        <span className="font-semibold">Retrieving match event timeline...</span>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="rounded-card border-red/20 bg-red/5 text-footnote text-red border py-6 text-center">
        Failed to load match commentary: {error?.message ?? "Match details not found"}
      </div>
    );
  }

  const evaluation = (match.matchStats as MatchEvaluation | null) ?? null;
  const trace = (Array.isArray(match.trace) ? match.trace : null) as Array<{
    t: number;
    type: string;
    description: string;
  }> | null;
  const commentary = (Array.isArray(match.commentary) ? match.commentary : null) as string[] | null;

  const hasCommentary = commentary && commentary.length > 0;
  const isGenerating = generateCommentaryMutation.isPending;

  const handleGenerate = async (e: React.MouseEvent, force = false) => {
    e.stopPropagation();
    let config:
      | {
          provider?: "openai" | "anthropic" | "custom" | "server";
          apiKey?: string;
          apiUrl?: string;
          modelName?: string;
          temperature?: number;
        }
      | undefined = undefined;
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
    <div className="bg-surface-secondary rounded-row relative mt-3 space-y-4 overflow-hidden p-4 text-left">
      {/* Volatility & Volumetric metrics */}
      {evaluation && (
        <div className="border-separator text-footnote grid grid-cols-2 gap-3 border-b pb-3 select-none md:grid-cols-4">
          <div>
            <span className="text-eyebrow text-label-tertiary block">Win prob</span>
            <span className="text-label font-semibold tabular-nums">
              {Math.round((evaluation.winProbability ?? 0.5) * 100)}% Home
            </span>
          </div>
          <div>
            <span className="text-eyebrow text-label-tertiary block">Possession</span>
            <span className="text-label font-semibold tabular-nums">
              {Math.round((evaluation.dominance ?? 0.5) * 100)}% Dom
            </span>
          </div>
          <div>
            <span className="text-eyebrow text-label-tertiary block">Tempo</span>
            <span className="text-label font-semibold tabular-nums">
              {(evaluation.tempo ?? 1.0).toFixed(1)}x Speed
            </span>
          </div>
          <div>
            <span className="text-eyebrow text-label-tertiary block">Upset volatility</span>
            <span className="text-label font-semibold tabular-nums">
              {(evaluation.volatility ?? 0.5).toFixed(1)} Index
            </span>
          </div>
        </div>
      )}

      {/* Main timeline trace or generation CTA */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-subhead text-label-secondary select-none">Live match feed</h4>
          {hasCommentary && !isGenerating && (
            <Button size="sm" variant="ghost" onClick={(e) => handleGenerate(e, true)}>
              <Sparkles />
              Regenerate
            </Button>
          )}
        </div>

        {trace && trace.length > 0 ? (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {isGenerating ? (
              <div
                role="status"
                className="bg-surface rounded-row flex flex-col items-center justify-center space-y-3 py-12 text-center"
              >
                <Sparkles
                  className="text-tint size-6 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                <div>
                  <p className="text-headline text-label">Tuning AI Narration Transmitters...</p>
                  <p className="text-footnote text-label-secondary mt-1 max-w-[280px]">
                    Drafting play-by-play descriptions with high-fidelity commentary.
                  </p>
                </div>
              </div>
            ) : !hasCommentary ? (
              <EmptyState
                compact
                className="bg-surface rounded-row"
                icon={<Sparkles />}
                title="No AI commentary generated"
                message="Generate commentary for this match."
                action={
                  <Button size="sm" variant="secondary" onClick={handleGenerate}>
                    <Sparkles />
                    Generate AI commentary
                  </Button>
                }
              />
            ) : (
              trace.map((step, idx) => {
                let Icon = Activity;
                let iconColor = "text-label-secondary border-separator bg-fill-3";
                if (step.type === "goal") {
                  Icon = Trophy;
                  iconColor = "text-yellow border-yellow/30 bg-yellow/15";
                } else if (step.type === "card") {
                  Icon = AlertTriangle;
                  iconColor = "text-red border-red/30 bg-red/15";
                } else if (step.type === "tactic_shift") {
                  Icon = TrendingUp;
                  iconColor = "text-teal border-teal/30 bg-teal/15";
                }

                return (
                  <div key={idx} className="rounded-row flex items-start gap-3 p-2">
                    <span className="text-footnote text-label-tertiary min-w-[24px] shrink-0 pt-0.5 text-right font-semibold tabular-nums select-none">
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
                    <span className="text-callout text-label pt-0.5">
                      {(commentary && commentary[idx]) || step.description}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="text-footnote text-label-secondary flex flex-col items-center justify-center py-6 text-center select-none">
            <Clock className="text-label-tertiary mb-1 size-5" aria-hidden />
            No key events recorded for this match.
          </div>
        )}
      </div>
    </div>
  );
}
