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
        className="relative overflow-hidden rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5 sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-2xs">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-foreground text-base font-bold tracking-tight sm:text-lg">
                  WikiOS Author Identity
                </h3>
                <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                  VERIFIED AUTHOR
                </span>
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-xs">
                <span>
                  User Handle: <strong className="text-foreground">User:{wikiUsername}</strong>
                </span>
                {wiki.registration && (
                  <span className="flex items-center gap-1">
                    <Calendar className="text-muted-foreground inline h-3 w-3" /> Joined{" "}
                    {new Date(wiki.registration).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
                {wiki.editCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="text-muted-foreground inline h-3 w-3" />{" "}
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
                  className="flex items-center gap-1 rounded-lg border border-stone-500/20 bg-stone-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-stone-600 dark:text-stone-300"
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
            <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>LOREWARDS CIVIC ACCOLADES</span>
            </h4>
            {stats.rank && (
              <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                Global Rank #{stats.rank}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: Interactive Streak Calendar (5 Cols) */}
        <FacetCard
          depth={1}
          interactive="none"
          className="space-y-4 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm lg:col-span-5 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between border-b border-black/6 pb-3 dark:border-white/8">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                data-cuelume-press="soft"
                className="hover:text-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-black/8 bg-black/[0.02] text-stone-600 transition-all active:scale-[0.95] dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300"
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
                  "flex h-7 w-7 items-center justify-center rounded-lg border border-black/8 bg-black/[0.02] transition-all dark:border-white/10 dark:bg-white/[0.03]",
                  isCurrentMonth
                    ? "cursor-not-allowed opacity-30"
                    : "hover:text-foreground cursor-pointer text-stone-600 active:scale-[0.95] dark:text-stone-300"
                )}
                title="Next Month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold">
              {DAY_LABELS.map((d, i) => (
                <div key={i} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty leading days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="h-7 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]"
                />
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
                      "flex h-7 items-center justify-center rounded-lg font-mono text-xs transition-all select-none",
                      status === "winner" &&
                        "border border-amber-500/40 bg-amber-500/20 font-bold text-amber-600 shadow-xs dark:text-amber-400",
                      status === "runner-up" &&
                        "border border-stone-500/30 bg-stone-500/20 font-medium text-stone-700 dark:text-stone-300",
                      !status && "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5",
                      isToday && "ring-1.5 ring-offset-background ring-blue-500 ring-offset-1"
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
          <div className="text-muted-foreground flex items-center justify-between border-t border-black/6 pt-2 font-mono text-[11px] dark:border-white/8">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-amber-500 bg-amber-500/40" />
              <span>Winner</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-stone-500 bg-stone-500/40" />
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
          className="space-y-3.5 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm lg:col-span-7 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between border-b border-black/6 pb-3 dark:border-white/8">
            <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span>LOREWARD LAURELS LEDGER ({awardHistory.length})</span>
            </h4>
            <Link
              href="/wiki"
              data-cuelume-press="soft"
              className="flex items-center gap-1 font-mono text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              <span>Explore Lore</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {awardHistory.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-xs">
              No previous loreward laurels recorded yet.
            </div>
          ) : (
            <div className="max-h-[310px] scrollbar-thin space-y-2 overflow-y-auto pr-1">
              {awardHistory.map((award, i) => (
                <div
                  key={award.id || `${award.date}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/6 bg-black/[0.01] p-3 text-xs transition-colors hover:bg-black/[0.03] dark:border-white/8 dark:bg-white/[0.015] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase",
                        award.type === "daily" &&
                          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        award.type === "weekly" &&
                          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                        award.type === "monthly" &&
                          "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      )}
                    >
                      {award.type}
                    </span>

                    <div className="min-w-0 flex-1">
                      {award.page ? (
                        <Link
                          href={`/wiki/${encodeURIComponent(award.page)}`}
                          data-cuelume-press="soft"
                          className="text-foreground block truncate font-bold transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {award.page}
                        </Link>
                      ) : (
                        <span className="text-foreground font-bold">Lore Laureate</span>
                      )}
                      <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px]">
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
                    <span className="shrink-0 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
        className="space-y-4 rounded-3xl border border-black/8 bg-black/[0.015] p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/6 pb-3 dark:border-white/8">
          <div>
            <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
              <EditPencil className="h-3.5 w-3.5 text-blue-500" />
              <span>LIVE CONTRIBUTIONS & REVISION LEDGER ({recentEdits.length})</span>
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Direct MediaWiki & WikiOS synchronized contribution stream
            </p>
          </div>

          <Link
            href={`/wiki/contributions/${encodeURIComponent(wikiUsername)}`}
            data-cuelume-press="soft"
            className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            <span>View All Contributions</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentEdits.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-xs">
            No recent wiki edits found for @{wikiUsername}.
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentEdits.map((edit: any) => (
              <div
                key={edit.revid}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-black/6 bg-black/[0.01] p-3.5 transition-all hover:border-black/12 sm:flex-row sm:items-center dark:border-white/8 dark:bg-white/[0.015] dark:hover:border-white/15"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                    <FileText className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/wiki/${encodeURIComponent(edit.title)}`}
                        data-cuelume-press="soft"
                        className="text-foreground truncate text-sm font-bold transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {edit.title}
                      </Link>

                      {edit.isNew && (
                        <span className="py-0.2 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 font-mono text-[9px] font-bold text-emerald-600 uppercase dark:text-emerald-400">
                          NEW
                        </span>
                      )}

                      {edit.minor && (
                        <span className="py-0.2 rounded border border-stone-500/20 bg-stone-500/10 px-1.5 font-mono text-[9px] font-semibold text-stone-600 dark:text-stone-400">
                          minor
                        </span>
                      )}
                    </div>

                    {edit.comment && (
                      <p className="text-muted-foreground line-clamp-1 text-xs italic">
                        &ldquo;{edit.comment}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/4 pt-1 font-mono text-xs sm:justify-end sm:border-t-0 sm:pt-0 dark:border-white/4">
                  <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    {formatMWTimeAgo(edit.timestamp)}
                  </span>

                  <span
                    className={cn(
                      "flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-bold",
                      edit.size > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : edit.size < 0
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-stone-500/10 text-stone-500"
                    )}
                  >
                    {edit.size > 0 ? (
                      <ArrowUpRight className="inline h-3 w-3" />
                    ) : edit.size < 0 ? (
                      <ArrowDownRight className="inline h-3 w-3" />
                    ) : null}
                    {edit.size > 0 ? `+${edit.size.toLocaleString()}` : edit.size.toLocaleString()}{" "}
                    B
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
      className="space-y-1 rounded-2xl border border-black/8 bg-black/[0.015] p-3.5 shadow-xs dark:border-white/10 dark:bg-white/[0.02]"
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-foreground font-mono text-lg font-bold tracking-tight">{value}</div>
      {subtext && (
        <div className="text-muted-foreground truncate font-mono text-[10px]">{subtext}</div>
      )}
    </FacetCard>
  );
}
