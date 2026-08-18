"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Loader2, Sparkles } from "lucide-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { MatchPredictionWidget } from "~/components/myleague/MatchPredictionWidget";
import Link from "next/link";

interface MatchDetailModalProps {
  matchId: string | null;
  isOpen: boolean;
  onClose: () => void;
  sportColors?: { accentColor: string; highlightColor: string } | null;
}

export default function MatchDetailModal({
  matchId,
  isOpen,
  onClose,
  sportColors = null,
}: MatchDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "stats">("timeline");
  const [matchReport, setMatchReport] = useState<string | null>(null);

  const { data: match, isLoading } = api.sports.getMatchDetails.useQuery(
    { matchId: matchId ?? "" },
    { enabled: !!matchId && isOpen }
  );

  const generateReportMutation = api.sports.generateMatchReport.useMutation({
    onSuccess: (data) => {
      setMatchReport(data.report);
    },
  });

  const handleClose = () => {
    setMatchReport(null);
    setActiveTab("timeline");
    onClose();
  };

  const handleGenerateReport = () => {
    if (matchId) {
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
      generateReportMutation.mutate({ matchId, config });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="border-border/40 bg-card/90 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border p-6 shadow-2xl backdrop-blur-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Match Details</DialogTitle>
          <DialogDescription>
            Detailed view of simulated sports match events, stats, and narrative commentary.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-6 py-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-12 w-24 rounded-xl" />
              <Skeleton className="h-16 w-32 rounded-xl" />
              <Skeleton className="h-12 w-24 rounded-xl" />
            </div>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}

        {!isLoading && match && (
          <div className="space-y-6">
            {/* Header / Score Board */}
            <div className="bg-muted/30 border-border/10 grid grid-cols-3 items-center gap-2 rounded-2xl border p-4 text-center dark:bg-secondary/40">
              {/* Home Team */}
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <div className="border-border/40 bg-background flex h-14 w-14 items-center justify-center rounded-full border p-1 shadow-md">
                  {match.homeTeam.logo ? (
                    <img
                      src={withBasePath(match.homeTeam.logo)}
                      alt={match.homeTeam.name}
                      className="h-full w-full rounded-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: match.homeTeam.color ?? "#3b82f6" }}
                    >
                      {match.homeTeam.shortName || match.homeTeam.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-foreground truncate text-sm font-extrabold">
                  {match.homeTeam.name}
                </span>
                {match.homeTeam.wikiSlug && (
                  <Link
                    href={titleToWikiOSPath(match.homeTeam.wikiSlug)}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    Wiki Page
                  </Link>
                )}
              </div>

              {/* Score & Info */}
              <div className="flex flex-col items-center justify-center">
                <span className="text-muted-foreground text-[10px] font-black tracking-wider uppercase">
                  Matchday {match.matchDay}
                </span>
                <div className="text-foreground my-1.5 flex items-center gap-3 font-mono text-4xl font-black tracking-tight">
                  <span>{match.homeScore ?? 0}</span>
                  <span className="opacity-30">-</span>
                  <span>{match.awayScore ?? 0}</span>
                </div>
                <BadgeCheck status={match.status} />
              </div>

              {/* Away Team */}
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <div className="border-border/40 bg-background flex h-14 w-14 items-center justify-center rounded-full border p-1 shadow-md">
                  {match.awayTeam.logo ? (
                    <img
                      src={withBasePath(match.awayTeam.logo)}
                      alt={match.awayTeam.name}
                      className="h-full w-full rounded-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: match.awayTeam.color ?? "#ef4444" }}
                    >
                      {match.awayTeam.shortName || match.awayTeam.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-foreground truncate text-sm font-extrabold">
                  {match.awayTeam.name}
                </span>
                {match.awayTeam.wikiSlug && (
                  <Link
                    href={titleToWikiOSPath(match.awayTeam.wikiSlug)}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    Wiki Page
                  </Link>
                )}
              </div>
            </div>

            {/* Prediction market — only before kickoff */}
            {match.status === "scheduled" && (
              <MatchPredictionWidget
                matchId={matchId!}
                homeName={match.homeTeam.name}
                awayName={match.awayTeam.name}
                bettingOpen
              />
            )}

            {/* AI Narration / Match Report Area */}
            <div className="space-y-3">
              {matchReport ? (
                <div
                  className={cn(
                    "relative rounded-2xl border p-4 shadow-sm",
                    sportColors ? "" : "border-purple-500/20 bg-purple-500/10"
                  )}
                  style={{
                    backgroundColor: sportColors?.accentColor
                      ? `hsla(${sportColors.accentColor}, 0.1)`
                      : undefined,
                    borderColor: sportColors?.accentColor
                      ? `hsla(${sportColors.accentColor}, 0.2)`
                      : undefined,
                  }}
                >
                  <div
                    className={cn(
                      "absolute top-3 right-3 flex items-center gap-1",
                      sportColors ? "" : "text-purple-400"
                    )}
                    style={{
                      color: sportColors?.highlightColor
                        ? `hsl(${sportColors.highlightColor})`
                        : undefined,
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase">AI Report</span>
                  </div>
                  <div className="prose prose-invert text-foreground/90 max-w-none pr-6 text-xs leading-relaxed whitespace-pre-line">
                    {matchReport}
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-700 font-bold text-white hover:bg-zinc-600"
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating AI Match Report...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Generate Newspaper Match Report
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Tabs for Timeline and Stats */}
            <div className="flex gap-4 border-b border-white/10">
              <button
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "cursor-pointer border-b-2 pb-2 text-sm font-bold transition-colors outline-none",
                  activeTab === "timeline"
                    ? sportColors
                      ? ""
                      : "border-purple-500 text-purple-400"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                )}
                style={
                  activeTab === "timeline" && sportColors?.highlightColor
                    ? {
                        borderColor: `hsl(${sportColors.highlightColor})`,
                        color: `hsl(${sportColors.highlightColor})`,
                      }
                    : undefined
                }
              >
                Timeline & Commentary
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={cn(
                  "cursor-pointer border-b-2 pb-2 text-sm font-bold transition-colors outline-none",
                  activeTab === "stats"
                    ? sportColors
                      ? ""
                      : "border-purple-500 text-purple-400"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                )}
                style={
                  activeTab === "stats" && sportColors?.highlightColor
                    ? {
                        borderColor: `hsl(${sportColors.highlightColor})`,
                        color: `hsl(${sportColors.highlightColor})`,
                      }
                    : undefined
                }
              >
                Player Stats
              </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-4">
              {activeTab === "timeline" && (
                <div className="space-y-3">
                  {match.trace && (match.trace as any[]).length > 0 ? (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {(match.trace as any[]).map((step, idx) => {
                        const hasLLMCommentary =
                          match.commentary && (match.commentary as string[])[idx];
                        const text = hasLLMCommentary || step.description;

                        return (
                          <div
                            key={idx}
                            className="bg-muted/10 border-border/10 flex items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed"
                            style={
                              step.type !== "tactic_shift" && sportColors?.accentColor
                                ? {
                                    borderColor: `hsla(${sportColors.accentColor}, 0.45)`,
                                    boxShadow: `0 0 8px hsla(${sportColors.accentColor}, 0.15)`,
                                  }
                                : undefined
                            }
                          >
                            <span className="text-muted-foreground w-8 shrink-0 text-right font-mono font-bold">
                              {step.t}'
                            </span>
                            <div className="flex-1">
                              <p
                                className={cn(
                                  "text-foreground/90 font-medium",
                                  hasLLMCommentary && !sportColors && "text-purple-300"
                                )}
                                style={
                                  hasLLMCommentary && sportColors?.highlightColor
                                    ? { color: `hsl(${sportColors.highlightColor})` }
                                    : undefined
                                }
                              >
                                {text}
                              </p>
                              {hasLLMCommentary && (
                                <span className="text-muted-foreground/60 mt-1 block text-[9px] font-semibold tracking-wider uppercase">
                                  Narrated Live
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-6 text-center text-xs italic">
                      No key events recorded for this match.
                    </p>
                  )}
                </div>
              )}

              {activeTab === "stats" && (
                <div className="overflow-x-auto">
                  {match.playerStats && (match.playerStats as any[]).length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-white/10 text-[10px] font-black tracking-wider uppercase">
                          <th className="py-2">Player</th>
                          <th className="py-2">Position</th>
                          <th className="py-2 text-right">Goals</th>
                          <th className="py-2 text-right">Assists</th>
                          <th className="py-2 text-right">Shots</th>
                        </tr>
                      </thead>
                      <tbody className="text-foreground/80 divide-y divide-white/5">
                        {(match.playerStats as any[]).map((stat, idx) => {
                          const playerStatsObj = (stat.stats as Record<string, any>) || {};
                          return (
                            <tr key={idx} className="transition-colors hover:bg-white/5">
                              <td className="py-2.5 font-bold">
                                {stat.player.firstName} {stat.player.lastName}
                              </td>
                              <td className="text-muted-foreground py-2.5 font-medium capitalize">
                                {stat.player.position}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold">
                                {playerStatsObj.goals ?? 0}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold">
                                {playerStatsObj.assists ?? 0}
                              </td>
                              <td className="text-muted-foreground py-2.5 text-right font-mono">
                                {playerStatsObj.shots ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted-foreground py-6 text-center text-xs italic">
                      No player statistics recorded for this match.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BadgeCheck({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-400 uppercase">
        Full Time
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="animate-pulse rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-400 uppercase">
        Live
      </span>
    );
  }
  return (
    <span className="bg-muted border-border/20 text-muted-foreground rounded-full border px-2 py-0.5 text-[9px] font-black uppercase">
      Scheduled
    </span>
  );
}
