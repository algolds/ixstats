"use client";

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
                  <span className={homeWon ? "font-bold text-amber-400" : "text-slate-400"}>
                    {r.homeScore}
                  </span>
                  <span className="text-slate-600">–</span>
                  <span className={awayWon ? "font-bold text-amber-400" : "text-slate-400"}>
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

      {/* Table movers */}
      {data.movers && data.movers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
          <span className="mr-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Table Movers
          </span>
          {data.movers.map((m, i) => {
            const up = m.newRank < m.oldRank;
            const Icon = up ? TrendingUp : TrendingDown;
            const body = (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium transition-all duration-200 hover:scale-[1.02]",
                  up
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                )}
              >
                <Icon className="h-3 w-3" />
                {m.name}{" "}
                <span className="text-[11px] text-slate-400">
                  ({ordinal(m.oldRank)} → {ordinal(m.newRank)})
                </span>
              </span>
            );
            return m.id ? (
              <Link key={i} href={`/myclub/${m.id}`} onClick={(e) => e.stopPropagation()}>
                {body}
              </Link>
            ) : (
              <span key={i}>{body}</span>
            );
          })}
        </div>
      )}

      {/* LLM narration */}
      {data.llmSummary && (
        <p className="border-t border-white/10 bg-white/[0.01] px-4 py-2.5 text-[14px] leading-relaxed text-slate-300 italic">
          {data.llmSummary}
        </p>
      )}
    </Card>
  );
}
