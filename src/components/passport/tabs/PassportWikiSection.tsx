"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  OpenBook as BookOpen,
  Trophy,
  Medal as Award,
  FireFlame as Flame,
  GraphUp as TrendingUp,
  Calendar,
  Page as FileText,
  Clock,
  Shield,
  PageEdit as EditPencil,
  ArrowUpRight,
  ArrowDownRight,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Hashtag as Hash,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import type { PassportWiki } from "../types";

interface PassportWikiSectionProps {
  wiki: PassportWiki;
  cleanUsername: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export const PassportWikiSection = React.memo(function PassportWikiSection({
  wiki,
  cleanUsername,
}: PassportWikiSectionProps) {
  const wikiUsername = wiki?.username || cleanUsername;
  const stats = wiki?.lorewards;
  const recentEdits = wiki?.recentEdits ?? [];
  const awardHistory = wiki?.awardHistory ?? [];
  const groups = wiki?.groups ?? [];

  // Streak Calendar State
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const { data: calData } = api.lorewards.getStreakCalendar.useQuery(
    { username: wikiUsername, year: calYear, month: calMonth },
    { enabled: Boolean(wikiUsername), staleTime: 60_000 }
  );

  const days = calData?.days ?? {};
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();

  const prevMonth = () => {
    if (calMonth === 1) {
      setCalYear(calYear - 1);
      setCalMonth(12);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 12) {
      setCalYear(calYear + 1);
      setCalMonth(1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* 1. WikiOS Author Identity Banner */}
      <FacetCard
        depth={1}
        interactive="none"
        className="relative overflow-hidden rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 sm:p-6 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 shadow-2xs">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  WikiOS Author Identity
                </h3>
                <span className="rounded-md bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  VERIFIED AUTHOR
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground flex-wrap">
                <span>
                  User Handle: <strong className="text-foreground">User:{wikiUsername}</strong>
                </span>
                {wiki.registration && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 inline text-muted-foreground" /> Joined{" "}
                    {new Date(wiki.registration).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
                {wiki.editCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3 inline text-muted-foreground" />{" "}
                    {wiki.editCount.toLocaleString()} edits
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* User Permission & Group Badges */}
          {groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0">
              {groups.map((g: string) => (
                <span
                  key={g}
                  className="rounded-lg bg-stone-500/10 border border-stone-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </FacetCard>

      {/* 2. Lorewards Accolades Metric Matrix */}
      {stats && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>LOREWARDS CIVIC ACCOLADES</span>
            </h4>
            {stats.rank && (
              <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                Global Rank #{stats.rank}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Daily Laurels"
              value={stats.dailyWins}
              icon={<Award className="h-4 w-4 text-amber-500" />}
              subtext="1st Place"
            />
            <MetricCard
              label="Runner-ups"
              value={stats.dailyRunnerUps}
              icon={<TrendingUp className="h-4 w-4 text-stone-400" />}
              subtext="2nd Place"
            />
            <MetricCard
              label="Weekly Laurels"
              value={stats.weeklyWins}
              icon={<Trophy className="h-4 w-4 text-blue-500" />}
              subtext="Weekly Crown"
            />
            <MetricCard
              label="Monthly Laurels"
              value={stats.monthlyWins}
              icon={<Trophy className="h-4 w-4 text-purple-500" />}
              subtext="Monthly Best"
            />
            <MetricCard
              label="Current Streak"
              value={`${stats.currentStreak}d`}
              icon={<Flame className="h-4 w-4 text-rose-500" />}
              subtext={`Best: ${stats.longestStreak}d`}
            />
            <MetricCard
              label="Total Score"
              value={stats.totalScore.toLocaleString()}
              icon={<Hash className="h-4 w-4 text-emerald-500" />}
              subtext={`${stats.totalBytes.toLocaleString()} bytes`}
            />
          </div>
        </div>
      )}

      {/* 3. Interactive Streak Calendar & Award History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Streak Calendar (5 Cols) */}
        <FacetCard
          depth={1}
          interactive="none"
          className="lg:col-span-5 rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-black/6 dark:border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                data-cuelume-press="soft"
                className="h-7 w-7 rounded-lg border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-foreground active:scale-[0.95] transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                disabled={isCurrentMonth}
                data-cuelume-press="soft"
                className={cn(
                  "h-7 w-7 rounded-lg border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-center transition-all",
                  isCurrentMonth
                    ? "opacity-30 cursor-not-allowed"
                    : "text-stone-600 dark:text-stone-300 hover:text-foreground active:scale-[0.95] cursor-pointer"
                )}
                title="Next Month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-muted-foreground">
              {DAY_LABELS.map((d, i) => (
                <div key={i} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty leading days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-7 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = days[day];
                const isToday = isCurrentMonth && day === now.getDate();

                return (
                  <div
                    key={day}
                    className={cn(
                      "h-7 rounded-lg font-mono text-xs flex items-center justify-center transition-all select-none",
                      status === "winner" &&
                        "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/40 shadow-xs",
                      status === "runner-up" &&
                        "bg-stone-500/20 text-stone-700 dark:text-stone-300 font-medium border border-stone-500/30",
                      !status && "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5",
                      isToday && "ring-1.5 ring-blue-500 ring-offset-1 ring-offset-background"
                    )}
                    title={
                      status === "winner"
                        ? `${MONTH_NAMES[calMonth - 1]} ${day} — Loreward Winner`
                        : status === "runner-up"
                          ? `${MONTH_NAMES[calMonth - 1]} ${day} — Loreward Runner-up`
                          : `${MONTH_NAMES[calMonth - 1]} ${day}`
                    }
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="pt-2 border-t border-black/6 dark:border-white/8 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40 border border-amber-500" />
              <span>Winner</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-stone-500/40 border border-stone-500" />
              <span>Runner-up</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-blue-500" />
              <span>Today</span>
            </span>
          </div>
        </FacetCard>

        {/* Right: Loreward Laurels Award History (7 Cols) */}
        <FacetCard
          depth={1}
          interactive="none"
          className="lg:col-span-7 rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-black/6 dark:border-white/8 pb-3">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span>LOREWARD LAURELS LEDGER ({awardHistory.length})</span>
            </h4>
            <Link
              href="/wiki"
              data-cuelume-press="soft"
              className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Explore Lore</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {awardHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No previous loreward laurels recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1 scrollbar-thin">
              {awardHistory.map((award, i) => (
                <div
                  key={award.id || `${award.date}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.01] dark:bg-white/[0.015] p-3 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 border",
                        award.type === "daily" &&
                          "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
                        award.type === "weekly" &&
                          "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                        award.type === "monthly" &&
                          "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                      )}
                    >
                      {award.type}
                    </span>

                    <div className="min-w-0 flex-1">
                      {award.page ? (
                        <Link
                          href={`/wiki/${encodeURIComponent(award.page)}`}
                          data-cuelume-press="soft"
                          className="font-bold text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
                        >
                          {award.page}
                        </Link>
                      ) : (
                        <span className="font-bold text-foreground">Lore Laureate</span>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        <span>{award.date}</span>
                        <span>·</span>
                        <span
                          className={cn(
                            "font-semibold capitalize",
                            award.role === "winner" ? "text-amber-500" : "text-stone-400"
                          )}
                        >
                          {award.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {award.score !== null && award.score !== undefined && (
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      +{award.score.toLocaleString()} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </FacetCard>
      </div>

      {/* 4. Live Recent Edits & Contribution Ledger */}
      <FacetCard
        depth={1}
        interactive="none"
        className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 sm:p-6 space-y-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/6 dark:border-white/8 pb-3">
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <EditPencil className="h-3.5 w-3.5 text-blue-500" />
              <span>LIVE CONTRIBUTIONS & REVISION LEDGER ({recentEdits.length})</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct MediaWiki & WikiOS synchronized contribution stream
            </p>
          </div>

          <Link
            href={`/wiki/contributions/${encodeURIComponent(wikiUsername)}`}
            data-cuelume-press="soft"
            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <span>View All Contributions</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentEdits.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No recent wiki edits found for @{wikiUsername}.
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentEdits.map((edit: any) => (
              <div
                key={edit.revid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-black/6 dark:border-white/8 bg-black/[0.01] dark:bg-white/[0.015] p-3.5 hover:border-black/12 dark:hover:border-white/15 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/wiki/${encodeURIComponent(edit.title)}`}
                        data-cuelume-press="soft"
                        className="text-sm font-bold text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                      >
                        {edit.title}
                      </Link>

                      {edit.isNew && (
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase">
                          NEW
                        </span>
                      )}

                      {edit.minor && (
                        <span className="rounded bg-stone-500/10 border border-stone-500/20 text-stone-600 dark:text-stone-400 px-1.5 py-0.2 font-mono text-[9px] font-semibold">
                          minor
                        </span>
                      )}
                    </div>

                    {edit.comment && (
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">
                        &ldquo;{edit.comment}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-black/4 dark:border-white/4">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    {formatMWTimeAgo(edit.timestamp)}
                  </span>

                  <span
                    className={cn(
                      "px-2 py-0.5 rounded font-bold text-xs flex items-center gap-0.5",
                      edit.size > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : edit.size < 0
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-stone-500/10 text-stone-500"
                    )}
                  >
                    {edit.size > 0 ? (
                      <ArrowUpRight className="h-3 w-3 inline" />
                    ) : edit.size < 0 ? (
                      <ArrowDownRight className="h-3 w-3 inline" />
                    ) : null}
                    {edit.size > 0 ? `+${edit.size.toLocaleString()}` : edit.size.toLocaleString()} B
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </FacetCard>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Metric Card Primitive (Apple Design Restrained Information Unit)
// ---------------------------------------------------------------------------
function MetricCard({
  label,
  value,
  icon,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  subtext?: string;
}) {
  return (
    <FacetCard
      depth={1}
      interactive="hover"
      className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-3.5 space-y-1 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-lg font-bold text-foreground tracking-tight font-mono">{value}</div>
      {subtext && (
        <div className="font-mono text-[10px] text-muted-foreground truncate">{subtext}</div>
      )}
    </FacetCard>
  );
}
