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
  return (
    <Card className="glass-hierarchy-child mt-2 overflow-hidden border-amber-500/15 bg-amber-950/10 p-0 shadow-md backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="text-lg">{data.sportEmoji}</span>
        {data.league.id ? (
          <Link
            href={`/myleague/${data.league.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[15px] font-bold text-amber-200 hover:underline"
          >
            {data.league.name}
          </Link>
        ) : (
          <span className="text-[15px] font-bold text-amber-200">{data.league.name}</span>
        )}
        <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
          Matchday {data.matchDay}
        </span>
      </div>

      {/* Results table */}
      <div className="divide-y divide-white/5">
        {data.results.map((r, i) => {
          const homeWon = r.homeScore > r.awayScore;
          const awayWon = r.awayScore > r.homeScore;
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 text-slate-200"
            >
              <TeamName team={r.home} won={homeWon} align="right" />
              <div className="flex items-center gap-1.5 font-mono text-[15px] font-semibold tabular-nums">
                <span className={homeWon ? "text-amber-200" : "text-slate-400"}>{r.homeScore}</span>
                <span className="text-slate-500">–</span>
                <span className={awayWon ? "text-amber-200" : "text-slate-400"}>{r.awayScore}</span>
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

      {/* Table movers */}
      {data.movers && data.movers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Table Movers
          </span>
          {data.movers.map((m, i) => {
            const up = m.newRank < m.oldRank;
            const Icon = up ? TrendingUp : TrendingDown;
            const body = (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]",
                  up ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                )}
              >
                <Icon className="h-3 w-3" />
                {m.name}{" "}
                <span className="text-slate-400">
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
        <p className="border-t border-white/10 px-4 py-2.5 text-[14px] leading-relaxed text-slate-300 italic">
          {data.llmSummary}
        </p>
      )}
    </Card>
  );
}
