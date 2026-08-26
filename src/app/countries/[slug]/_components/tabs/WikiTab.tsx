"use client";

import React from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  Clock,
  GraphUp as TrendingUp,
  Medal as Award,
  FireFlame as Flame,
  OpenBook as BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  OpenNewWindow as ExternalLink,
  Spark as Sparkles,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { withBasePath } from "~/lib/base-path";
import { StreakCalendar } from "~/components/wiki-os/profile/StreakCalendar";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetMetricTile } from "~/components/profile/FacetMetricTile";

export interface WikiTabData {
  linked: boolean;
  username: string | null;
  registration: string | null;
  editCount: number;
  groups: string[];
  lorewards: {
    totalScore: number;
    totalBytes: number;
    rank: number | null;
    dailyWins: number;
    dailyRunnerUps: number;
    weeklyWins: number;
    monthlyWins: number;
    currentStreak: number;
    longestStreak: number;
  } | null;
  recentEdits: Array<{
    revid: number;
    title: string;
    timestamp: string;
    size: number;
    minor: boolean;
    isNew: boolean;
  }>;
  awardHistory: Array<{
    date: string;
    type: string;
    role: "winner" | "runner-up";
    page: string | null;
    score: number | null;
  }>;
}

interface WikiTabProps {
  wiki: WikiTabData;
  countryName?: string;
  isOwnCountry?: boolean;
}

export function WikiTab({ wiki, countryName, isOwnCountry }: WikiTabProps) {
  const username = wiki.username || countryName || "Unknown";
  const stats = wiki.lorewards;
  const awards = wiki.awardHistory ?? [];
  const edits = wiki.recentEdits ?? [];

  if (!wiki.linked && !wiki.username && edits.length === 0 && !stats) {
    return (
      <FacetCard depth={1} className="p-8 sm:p-12 text-center backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 shadow-inner">
          <BookOpen className="h-7 w-7" />
        </div>
        <h3 className="text-foreground text-lg font-extrabold tracking-tight">No Wiki Account Linked</h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-xs leading-relaxed">
          This profile does not currently have a linked MediaWiki contributor account or Loreward award history.
        </p>
        {isOwnCountry && (
          <div className="mt-6">
            <Link
              href="/settings#ixnayid-section"
              data-cuelume-press="soft"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Link MediaWiki in Settings</span>
            </Link>
          </div>
        )}
      </FacetCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lorewards Accolades Bento */}
      <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
              Lorewards Accolades
            </h3>
          </div>
          {stats && stats.totalScore > 0 && (
            <span className="text-xs font-mono font-bold text-amber-500">
              {stats.totalScore.toLocaleString()} total score
            </span>
          )}
        </div>

        {stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FacetMetricTile
              label="Daily Wins"
              value={stats.dailyWins}
              icon={<Award className="h-4 w-4" />}
              accentColor="#f59e0b"
            />
            <FacetMetricTile
              label="Runner-ups"
              value={stats.dailyRunnerUps}
              icon={<TrendingUp className="h-4 w-4" />}
              accentColor="#64748b"
            />
            <FacetMetricTile
              label="Weekly Wins"
              value={stats.weeklyWins}
              icon={<Trophy className="h-4 w-4" />}
              accentColor="#3b82f6"
            />
            <FacetMetricTile
              label="Monthly Wins"
              value={stats.monthlyWins}
              icon={<Trophy className="h-4 w-4" />}
              accentColor="#8b5cf6"
            />
            <FacetMetricTile
              label="Current Streak"
              value={`${stats.currentStreak}d`}
              icon={<Flame className="h-4 w-4" />}
              accentColor={stats.currentStreak > 0 ? "#f97316" : "#64748b"}
            />
            <FacetMetricTile
              label="Best Streak"
              value={`${stats.longestStreak}d`}
              icon={<Flame className="h-4 w-4" />}
              accentColor="#ef4444"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center">
            <p className="text-xs text-stone-500">No Lorewards accolades recorded yet.</p>
          </div>
        )}
      </FacetCard>

      {/* Streak Heatmap Calendar */}
      <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
              Lore Activity Calendar
            </h3>
          </div>
        </div>
        <StreakCalendar username={username} />
      </FacetCard>

      {/* Award History */}
      {awards.length > 0 && (
        <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-500" />
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
              Award History
            </h3>
          </div>
          <div className="space-y-2">
            {awards.map((award, i) => (
              <div
                key={`${award.date}-${award.type}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/5 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.02] p-3 text-xs transition-colors hover:bg-stone-100 dark:hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase",
                      award.role === "winner"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                        : "bg-stone-500/20 text-stone-400 border border-stone-500/30"
                    )}
                  >
                    {award.type} {award.role === "winner" ? "Win" : "2nd"}
                  </span>
                  {award.page ? (
                    <Link
                      href={withBasePath(
                        `/wiki/${encodeURIComponent(award.page.replace(/ /g, "_"))}`
                      )}
                      className="truncate font-bold text-stone-900 dark:text-white hover:text-blue-500"
                    >
                      {award.page}
                    </Link>
                  ) : (
                    <span className="text-stone-400">{award.date}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {award.score && (
                    <span className="font-mono text-stone-500 text-[11px]">
                      {award.score.toLocaleString()} pts
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 font-mono">{award.date}</span>
                </div>
              </div>
            ))}
          </div>
        </FacetCard>
      )}

      {/* Live Recent Edits */}
      <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
              Live Wiki Contributions
            </h3>
          </div>
          <Link
            href={withBasePath(`/wiki/contributions/${encodeURIComponent(username)}`)}
            className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:underline"
          >
            <span>All Contributions</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {edits.length > 0 ? (
          <div className="space-y-2">
            {edits.map((edit) => (
              <div
                key={edit.revid}
                className="flex flex-col gap-1 rounded-xl border border-black/5 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.02] p-3 text-xs transition-colors hover:bg-stone-100 dark:hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={withBasePath(
                      `/wiki/${encodeURIComponent(edit.title.replace(/ /g, "_"))}`
                    )}
                    className="truncate font-bold text-stone-900 dark:text-white hover:text-blue-500"
                  >
                    {edit.title}
                  </Link>
                  <span
                    className={cn(
                      "font-mono text-[11px] font-extrabold shrink-0 flex items-center",
                      edit.size > 0
                        ? "text-emerald-500"
                        : edit.size < 0
                          ? "text-rose-500"
                          : "text-stone-400"
                    )}
                  >
                    {edit.size > 0 ? (
                      <ArrowUpRight className="h-3 w-3 inline" />
                    ) : edit.size < 0 ? (
                      <ArrowDownRight className="h-3 w-3 inline" />
                    ) : null}
                    {edit.size > 0 ? "+" : ""}
                    {edit.size.toLocaleString()}
                  </span>
                </div>
                <div className="text-stone-400 flex items-center justify-between text-[10px]">
                  <span>{formatMWTimeAgo(edit.timestamp)}</span>
                  <div className="flex items-center gap-1">
                    {edit.isNew && (
                      <span className="rounded bg-emerald-500/20 px-1 font-bold text-emerald-500">
                        new
                      </span>
                    )}
                    {edit.minor && (
                      <span className="rounded bg-stone-500/20 px-1 font-bold text-stone-400">
                        m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center">
            <p className="text-xs text-stone-500">No recent edits recorded.</p>
          </div>
        )}
      </FacetCard>
    </div>
  );
}
