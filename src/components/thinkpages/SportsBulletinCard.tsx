"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { SportsBulletinData } from "~/lib/sports/feed-bulletins";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** A team name, deep-linked to its club page when an id is known. */
function TeamName({
  team,
  won,
  align,
}: {
  team: { name: string; id?: string };
  won: boolean;
  align: "left" | "right";
}) {
  const cls = cn(
    "truncate text-[15px]",
    won ? "font-semibold text-slate-100" : "text-slate-300",
    align === "right" ? "text-right" : "text-left"
  );
  if (!team.id) return <span className={cls}>{team.name}</span>;
  return (
    <Link
      href={`/myclub/${team.id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(cls, "hover:text-amber-300 hover:underline")}
    >
      {team.name}
    </Link>
  );
}

/**
 * Rich feed card for an auto-generated SportsNews matchday bulletin. Replaces the
 * markdown wall-of-text with an organized score table + table movers + deep links.
 */
export function SportsBulletinCard({ data }: { data: SportsBulletinData }) {
  const [activeTab, setActiveTab] = useState<"results" | "movers" | "summary">("results");
  // Champion Crowned Layout
  if (data.isChampionBulletin) {
    return (
      <Card className="glass-hierarchy-child mt-2 overflow-hidden border-amber-500/30 bg-amber-500/[0.03] p-0 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-amber-500/50">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.05] px-4 py-2.5">
          <span className="text-lg">{data.sportEmoji}</span>
          {data.league.id ? (
            <Link
              href={`/myleague/${data.league.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[15px] font-bold text-amber-300 hover:text-amber-200 hover:underline"
            >
              {data.league.name}
            </Link>
          ) : (
            <span className="text-[15px] font-bold text-amber-300">{data.league.name}</span>
          )}
          <span className="ml-auto animate-pulse rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
            CHAMPION
          </span>
        </div>

        {/* Celebration Body */}
        <div className="flex flex-col items-center justify-center bg-radial from-amber-500/[0.08] to-transparent px-6 py-8 text-center">
          <div className="relative mb-3 flex items-center justify-center">
            <span className="animate-bounce text-5xl">🏆</span>
            <span className="absolute -top-1 -right-1 text-lg">✨</span>
            <span className="absolute -bottom-1 -left-2 text-lg">✨</span>
          </div>
          <h3 className="text-lg font-extrabold tracking-tight text-amber-300 uppercase">
            Season Champion Crowned!
          </h3>
          <p className="mt-2 max-w-md text-sm text-slate-300">
            Congratulations to{" "}
            {data.championId ? (
              <Link
                href={`/myclub/${data.championId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[16px] font-bold text-white underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-amber-200"
              >
                {data.championName}
              </Link>
            ) : (
              <span className="text-[16px] font-bold text-white underline decoration-amber-400 decoration-2 underline-offset-4">
                {data.championName}
              </span>
            )}{" "}
            for winning the championship!
          </p>
        </div>

        {/* LLM narration / Season Summary */}
        {data.llmSummary && (
          <div className="border-t border-amber-500/20 bg-amber-950/[0.03] px-4 py-3">
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-amber-400 uppercase">
              Season Summary
            </span>
            <p className="text-[14px] leading-relaxed text-slate-300 italic">{data.llmSummary}</p>
          </div>
        )}
      </Card>
    );
  }

  // Playoff Results Layout
  if (data.isPlayoffBulletin) {
    return (
      <Card className="glass-hierarchy-child mt-2 overflow-hidden border-cyan-500/30 bg-cyan-500/[0.02] p-0 shadow-md backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-cyan-500/20 bg-cyan-500/[0.05] px-4 py-2.5">
          <span className="text-lg">{data.sportEmoji}</span>
          {data.league.id ? (
            <Link
              href={`/myleague/${data.league.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[15px] font-bold text-cyan-300 hover:text-cyan-200 hover:underline"
            >
              {data.league.name}
            </Link>
          ) : (
            <span className="text-[15px] font-bold text-cyan-300">{data.league.name}</span>
          )}
          <span className="ml-auto rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-200 uppercase">
            {data.roundName}
          </span>
        </div>

        {/* Results table */}
        {data.results && data.results.length > 0 && (
          <div className="divide-y divide-white/5 bg-black/10">
            {data.results.map((r, i) => {
              const homeWon = r.homeScore > r.awayScore;
              const awayWon = r.awayScore > r.homeScore;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 text-slate-200 transition-colors hover:bg-white/[0.02]"
                >
                  <TeamName team={r.home} won={homeWon} align="right" />
                  <div className="flex items-center gap-1.5 font-mono text-[15px] font-semibold tabular-nums">
                    <span className={homeWon ? "font-bold text-cyan-400" : "text-slate-400"}>
                      {r.homeScore}
                    </span>
                    <span className="text-slate-600">–</span>
                    <span className={awayWon ? "font-bold text-cyan-400" : "text-slate-400"}>
                      {r.awayScore}
                    </span>
                    {r.isUpset && (
                      <span className="ml-0.5 text-[11px]" title="Upset of the day">
                        ⭐
                      </span>
                    )}
                  </div>
                  <TeamName team={r.away} won={awayWon} align="left" />
                </div>
              );
            })}
          </div>
        )}

        {/* LLM narration / Round Summary */}
        {data.llmSummary && (
          <div className="border-t border-cyan-500/20 bg-cyan-950/[0.03] px-4 py-3">
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-cyan-400 uppercase">
              Round Summary
            </span>
            <p className="text-[14px] leading-relaxed text-slate-300 italic">{data.llmSummary}</p>
          </div>
        )}
      </Card>
    );
  }

  // Default Matchday Results Layout
  const hasResults = !!(data.results && data.results.length > 0);
  const hasMovers = !!(data.movers && data.movers.length > 0);
  const hasSummary = !!data.llmSummary;

  return (
    <Card className="glass-hierarchy-child mt-2 overflow-hidden border-white/10 bg-slate-950/20 p-0 shadow-md backdrop-blur-md transition-all duration-300 hover:border-white/15">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="text-lg">{data.sportEmoji}</span>
        {data.league.id ? (
          <Link
            href={`/myleague/${data.league.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[15px] font-bold text-amber-400 hover:text-amber-300 hover:underline"
          >
            {data.league.name}
          </Link>
        ) : (
          <span className="text-[15px] font-bold text-slate-100">{data.league.name}</span>
        )}
        <span className="ml-auto rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-300 uppercase">
          Matchday {data.matchDay}
        </span>
      </div>

      {/* Tabs Selector */}
      {(hasMovers || hasSummary) && (
        <div className="flex gap-1.5 border-b border-white/5 bg-black/25 px-4 py-1.5 text-[13px]">
          {hasResults && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("results");
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 font-medium transition-all duration-200",
                activeTab === "results"
                  ? "border border-amber-500/25 bg-amber-500/15 text-amber-300"
                  : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              📅 Matches
            </button>
          )}
          {hasMovers && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("movers");
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 font-medium transition-all duration-200",
                activeTab === "movers"
                  ? "border border-amber-500/25 bg-amber-500/15 text-amber-300"
                  : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              📈 Movers ({data.movers?.length})
            </button>
          )}
          {hasSummary && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab("summary");
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 font-medium transition-all duration-200",
                activeTab === "summary"
                  ? "border border-amber-500/25 bg-amber-500/15 text-amber-300"
                  : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              📝 Summary
            </button>
          )}
        </div>
      )}

      {/* Results Tab Content */}
      {activeTab === "results" && hasResults && (
        <div className="grid grid-cols-1 gap-2 bg-black/10 p-3 md:grid-cols-2">
          {data.results!.map((r, i) => {
            const homeWon = r.homeScore > r.awayScore;
            const awayWon = r.awayScore > r.homeScore;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-slate-200 transition-all hover:border-white/10 hover:bg-white/[0.04]",
                  r.isUpset && "border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/30"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center justify-end text-right">
                  <TeamName team={r.home} won={homeWon} align="right" />
                </div>

                <div className="flex items-center gap-1 rounded border border-white/5 bg-black/30 px-2 py-0.5 font-mono text-[14px] font-bold tabular-nums">
                  <span className={homeWon ? "text-amber-400" : "text-slate-400"}>
                    {r.homeScore}
                  </span>
                  <span className="text-slate-600">–</span>
                  <span className={awayWon ? "text-amber-400" : "text-slate-400"}>
                    {r.awayScore}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-left">
                  <TeamName team={r.away} won={awayWon} align="left" />
                  {r.isUpset && (
                    <span
                      className="animate-pulse cursor-help text-[11px]"
                      title="Upset of the day"
                    >
                      ⭐
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Movers Tab Content */}
      {activeTab === "movers" && hasMovers && (
        <div className="flex flex-col gap-2 bg-black/10 p-3">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Table Movers
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.movers!.map((m, i) => {
              const up = m.newRank < m.oldRank;
              const Icon = up ? TrendingUp : TrendingDown;
              const body = (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-white/[0.01] px-3 py-2 text-[13px] font-medium transition-all duration-200 hover:scale-[1.01]",
                    up
                      ? "border-emerald-500/10 bg-emerald-500/[0.02] text-emerald-300 hover:border-emerald-500/20 hover:bg-emerald-500/[0.05]"
                      : "border-rose-500/10 bg-rose-500/[0.02] text-rose-300 hover:border-rose-500/20 hover:bg-rose-500/[0.05]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{m.name}</span>
                  </div>
                  <span className="text-[12px] text-slate-400">
                    {ordinal(m.oldRank)} →{" "}
                    <strong className="text-white">{ordinal(m.newRank)}</strong>
                  </span>
                </div>
              );
              return m.id ? (
                <Link key={i} href={`/myclub/${m.id}`} onClick={(e) => e.stopPropagation()}>
                  {body}
                </Link>
              ) : (
                <div key={i}>{body}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commentary Tab Content */}
      {activeTab === "summary" && hasSummary && (
        <div className="bg-black/10 p-4">
          <span className="mb-2 block text-[11px] font-semibold tracking-wide text-amber-400 uppercase">
            Matchday Narration
          </span>
          <p className="border-l-2 border-amber-500/30 pl-3 text-[14px] leading-relaxed text-slate-300 italic">
            {data.llmSummary}
          </p>
        </div>
      )}
    </Card>
  );
}
