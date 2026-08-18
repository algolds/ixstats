"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, ChevronRight, Shield, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { SportsBulletinData } from "~/lib/sports/feed-bulletins";

interface SportsBulletinCardProps {
  data: SportsBulletinData;
  author?: {
    displayName?: string;
    username?: string;
    profileImageUrl?: string;
  } | null;
  className?: string;
}

export function SportsBulletinCard({ data, author, className }: SportsBulletinCardProps) {
  const {
    league,
    sportEmoji,
    matchDay,
    results = [],
    movers = [],
    isChampionBulletin,
    isPlayoffBulletin,
    roundName,
    championName,
    championId,
    llmSummary,
  } = data;

  const hasMovers = movers.length > 0;
  const hasSummary = !!llmSummary;
  const [activeTab, setActiveTab] = useState<"matches" | "movers" | "summary">("matches");

  const leagueHref = league.id ? `/myclub/${league.id}` : undefined;

  return (
    <div
      className={cn(
        "group dark:border-border dark:bg-card/85 dark:hover:border-border-secondary relative my-3.5 overflow-hidden rounded-3xl border border-black/10 bg-white/70 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-black/15 hover:shadow-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className
      )}
    >
      {/* Ambient Background Radial Glows */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 dark:bg-amber-500/15" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 dark:bg-cyan-500/15" />

      {/* Apple Sports Header Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-black/[0.02] px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent shadow-inner">
            <span className="text-xl select-none">{sportEmoji || "🏆"}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight text-slate-900 drop-shadow-sm dark:text-white">
                {league.name}
              </h4>
              {isChampionBulletin && (
                <Badge className="border-amber-500/30 bg-amber-500/15 text-[9px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                  Champion Crowned
                </Badge>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-slate-500 tabular-nums dark:text-slate-400">
              {isChampionBulletin ? (
                <span>Final Season Standings</span>
              ) : isPlayoffBulletin ? (
                <span>{roundName || "Playoffs"}</span>
              ) : matchDay ? (
                <span>Matchday {matchDay}</span>
              ) : (
                <span>Official League Bulletin</span>
              )}
            </p>
          </div>
        </div>

        {/* Tab Selector (Apple Segmented Control) */}
        {(hasMovers || hasSummary) && results.length > 0 && (
          <div className="flex items-center rounded-xl border border-black/10 bg-black/5 p-1 shadow-inner dark:border-white/10 dark:bg-black/40">
            <button
              onClick={() => setActiveTab("matches")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight transition-all duration-150 active:scale-[0.96]",
                activeTab === "matches"
                  ? "border border-black/10 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/15 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              Matches ({results.length})
            </button>
            {hasMovers && (
              <button
                onClick={() => setActiveTab("movers")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight transition-all duration-150 active:scale-[0.96]",
                  activeTab === "movers"
                    ? "border border-black/10 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/15 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                Rankings ({movers.length})
              </button>
            )}
            {hasSummary && (
              <button
                onClick={() => setActiveTab("summary")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight transition-all duration-150 active:scale-[0.96]",
                  activeTab === "summary"
                    ? "border border-black/10 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/15 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                Summary
              </button>
            )}
          </div>
        )}
      </div>

      {/* Champion Banner View */}
      {isChampionBulletin && championName && (
        <div className="m-3.5 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/20 text-amber-500 shadow-md dark:text-amber-300">
              <Trophy className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400/90">
                League Champion
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {championName}
              </h3>
            </div>
          </div>
          {championId && (
            <Link
              href={`/myclub/${championId}`}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-500/30 active:scale-[0.96] dark:text-amber-300"
            >
              <span>View Club</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Main Tab Content */}
      <div className="p-3.5">
        {/* MATCHES GRID */}
        {activeTab === "matches" && (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {results.map((res, idx) => {
              const homeWon = res.homeScore > res.awayScore;
              const awayWon = res.awayScore > res.homeScore;

              return (
                <div
                  key={idx}
                  className="group/match relative flex items-center justify-between rounded-2xl border border-black/5 bg-white/60 p-3 shadow-sm transition-all duration-150 hover:border-black/15 hover:bg-white/80 active:scale-[0.98] dark:border-white/5 dark:bg-black/30 dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                >
                  {/* Teams Column */}
                  <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                    {/* Home Team */}
                    <div className="flex items-center gap-2">
                      <Shield
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          homeWon
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      />
                      {res.home.id ? (
                        <Link
                          href={`/myclub/${res.home.id}`}
                          className={cn(
                            "truncate text-xs tracking-tight transition-colors hover:text-amber-600 dark:hover:text-amber-300",
                            homeWon
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {res.home.name}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "truncate text-xs tracking-tight",
                            homeWon
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {res.home.name}
                        </span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center gap-2">
                      <Shield
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          awayWon
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      />
                      {res.away.id ? (
                        <Link
                          href={`/myclub/${res.away.id}`}
                          className={cn(
                            "truncate text-xs tracking-tight transition-colors hover:text-amber-600 dark:hover:text-amber-300",
                            awayWon
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {res.away.name}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "truncate text-xs tracking-tight",
                            awayWon
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {res.away.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Pill & Indicators */}
                  <div className="flex shrink-0 items-center gap-2">
                    {res.isUpset && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        UPSET
                      </span>
                    )}
                    <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white/90 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-slate-900 tabular-nums shadow-inner dark:border-white/10 dark:bg-black/60 dark:text-white">
                      <span className={cn(homeWon && "text-amber-600 dark:text-amber-300")}>
                        {res.homeScore}
                      </span>
                      <span className="text-slate-400 dark:text-white/40">–</span>
                      <span className={cn(awayWon && "text-amber-600 dark:text-amber-300")}>
                        {res.awayScore}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RANKINGS TAB (UFC Style) */}
        {activeTab === "movers" && (
          <div className="space-y-2">
            {movers.map((mover, idx) => {
              const jump = mover.oldRank - mover.newRank;
              const isUp = jump > 0;
              const isDown = jump < 0;

              return (
                <div
                  key={idx}
                  className="group/rank flex items-center justify-between rounded-2xl border border-black/5 bg-white/60 px-3.5 py-2.5 shadow-sm transition-all duration-150 hover:border-black/15 hover:bg-white/80 active:scale-[0.98] dark:border-white/5 dark:bg-black/30 dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Rank Number Badge (UFC style) */}
                    <div className="flex h-7 min-w-8 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/5 px-2 font-mono text-xs font-bold tracking-tight text-slate-900 tabular-nums shadow-inner dark:border-white/10 dark:bg-white/10 dark:text-white">
                      #{mover.newRank}
                    </div>

                    {/* Rank Delta Movement Indicator */}
                    <div
                      className={cn(
                        "flex h-5 items-center gap-0.5 rounded-lg border px-1.5 text-[10px] font-bold tracking-tight tabular-nums",
                        isUp
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : isDown
                            ? "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "border-black/10 bg-black/5 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
                      )}
                    >
                      {isUp ? `▲${jump}` : isDown ? `▼${Math.abs(jump)}` : "—"}
                    </div>

                    {/* Team/Club Name */}
                    {mover.id ? (
                      <Link
                        href={`/myclub/${mover.id}`}
                        className="truncate text-xs font-bold tracking-tight text-slate-900 transition-colors hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                      >
                        {mover.name}
                      </Link>
                    ) : (
                      <span className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                        {mover.name}
                      </span>
                    )}
                  </div>

                  {/* Right side: UFC Style Current Rank Badge */}
                  <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold tracking-tight text-amber-600 tabular-nums dark:text-amber-400">
                    <span>Rank #{mover.newRank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUMMARY TAB */}
        {activeTab === "summary" && llmSummary && (
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-slate-300">
            {llmSummary}
          </div>
        )}
      </div>

      {/* Integrated League Footer */}
      {leagueHref && (
        <div className="flex items-center justify-end border-t border-black/5 bg-black/[0.02] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.02]">
          <Link
            href={leagueHref}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white/80 px-3 py-1 text-xs font-bold tracking-tight text-slate-900 transition-all hover:bg-black/5 active:scale-[0.96] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <span>Open League</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </Link>
        </div>
      )}
    </div>
  );
}
