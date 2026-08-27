"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Trophy,
  Medal as Award,
  FireFlame as Flame,
  GraphUp as TrendingUp,
  Calendar,
  ArrowUpRight,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Hashtag as Hash,
  OpenBook as BookOpen,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { PassportWiki } from "../types";

interface PassportLorewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wiki?: PassportWiki;
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

export function PassportLorewardsModal({
  open,
  onOpenChange,
  wiki,
  cleanUsername,
}: PassportLorewardsModalProps) {
  const wikiUsername = wiki?.username || cleanUsername;
  const stats = wiki?.lorewards;
  const awardHistory = wiki?.awardHistory ?? [];

  // Streak Calendar State
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const { data: calData } = api.lorewards.getStreakCalendar.useQuery(
    { username: wikiUsername, year: calYear, month: calMonth },
    { enabled: Boolean(open && wikiUsername), staleTime: 60_000 }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background/95 max-h-[90vh] max-w-3xl space-y-6 overflow-y-auto rounded-3xl border border-black/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-7 dark:border-white/15">
        <DialogHeader className="border-b border-black/8 pb-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-500 shadow-xs">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-foreground flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
                  <span>Lorewards Civic Accolades</span>
                </DialogTitle>
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                  Author Identity: <strong className="text-foreground">User:{wikiUsername}</strong>
                </p>
              </div>
            </div>

            {stats?.rank ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                <Trophy className="h-3.5 w-3.5" />
                <span>Global Rank #{stats.rank}</span>
              </div>
            ) : (
              <div className="text-muted-foreground rounded-xl bg-black/5 px-3 py-1.5 font-mono text-xs dark:bg-white/5">
                Unranked
              </div>
            )}
          </div>
        </DialogHeader>

        {/* 1. 6-Cell Metric Matrix */}
        {stats ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
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
              label="Streak"
              value={`${stats.currentStreak}d`}
              icon={<Flame className="h-4 w-4 text-rose-500" />}
              subtext={`Best: ${stats.longestStreak}d`}
            />
            <MetricCard
              label="Score"
              value={stats.totalScore.toLocaleString()}
              icon={<Hash className="h-4 w-4 text-emerald-500" />}
              subtext={`${stats.totalBytes.toLocaleString()} B`}
            />
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-center text-xs">
            No Loreward stats recorded for this author.
          </div>
        )}

        {/* 2. Interactive Streak Calendar & Award History Grid */}
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
          {/* Left: Streak Calendar (5 Cols) */}
          <FacetCard
            depth={1}
            interactive="none"
            className="space-y-3 rounded-2xl border border-black/8 bg-black/[0.015] p-4 shadow-sm md:col-span-5 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between border-b border-black/6 pb-2.5 dark:border-white/8">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
                  {MONTH_NAMES[calMonth - 1]} {calYear}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  data-cuelume-press="soft"
                  className="hover:text-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-black/8 bg-black/[0.02] text-stone-600 transition-all active:scale-[0.95] dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  disabled={isCurrentMonth}
                  data-cuelume-press="soft"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg border border-black/8 bg-black/[0.02] transition-all dark:border-white/10 dark:bg-white/[0.03]",
                    isCurrentMonth
                      ? "cursor-not-allowed opacity-30"
                      : "hover:text-foreground cursor-pointer text-stone-600 active:scale-[0.95] dark:text-stone-300"
                  )}
                  title="Next Month"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-1.5">
              <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-bold">
                {DAY_LABELS.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="h-6 rounded-md bg-black/[0.01] dark:bg-white/[0.01]"
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const status = days[day];
                  const isToday = isCurrentMonth && day === now.getDate();

                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex h-6 items-center justify-center rounded-md font-mono text-[11px] transition-all select-none",
                        status === "winner" &&
                          "border border-amber-500/40 bg-amber-500/20 font-bold text-amber-600 dark:text-amber-400",
                        status === "runner-up" &&
                          "border border-stone-500/30 bg-stone-500/20 font-medium text-stone-700 dark:text-stone-300",
                        !status &&
                          "text-muted-foreground/80 hover:bg-black/5 dark:hover:bg-white/5",
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

            {/* Legend */}
            <div className="text-muted-foreground flex items-center justify-between border-t border-black/6 pt-2 font-mono text-[10px] dark:border-white/8">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-amber-500 bg-amber-500/40" />
                <span>Winner</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-stone-500 bg-stone-500/40" />
                <span>Runner-up</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-blue-500" />
                <span>Today</span>
              </span>
            </div>
          </FacetCard>

          {/* Right: Loreward Laurels Ledger (7 Cols) */}
          <FacetCard
            depth={1}
            interactive="none"
            className="space-y-3 rounded-2xl border border-black/8 bg-black/[0.015] p-4 shadow-sm md:col-span-7 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between border-b border-black/6 pb-2.5 dark:border-white/8">
              <h4 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>LAURELS HISTORY ({awardHistory.length})</span>
              </h4>
              <Link
                href="/wiki"
                data-cuelume-press="soft"
                className="flex items-center gap-0.5 font-mono text-[10px] text-blue-600 hover:underline dark:text-blue-400"
              >
                <span>WikiOS</span>
                <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            {awardHistory.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-xs">
                No previous laurels recorded yet.
              </div>
            ) : (
              <div className="max-h-[220px] scrollbar-thin space-y-2 overflow-y-auto pr-1">
                {awardHistory.map((award, i) => (
                  <div
                    key={award.id || `${award.date}-${i}`}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-black/6 bg-black/[0.01] p-2.5 text-xs transition-colors hover:bg-black/[0.03] dark:border-white/8 dark:bg-white/[0.015] dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={cn(
                          "py-0.2 shrink-0 rounded border px-1.5 font-mono text-[9px] font-bold tracking-wider uppercase",
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
                        <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/8 pt-4 dark:border-white/10">
          <Link
            href={`/wiki/user/${encodeURIComponent(wikiUsername)}`}
            data-cuelume-press="soft"
            className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Open Dedicated WikiOS Profile</span>
          </Link>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            data-cuelume-press="soft"
            className="cursor-pointer rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] dark:bg-white dark:text-stone-950"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      className="space-y-0.5 rounded-xl border border-black/8 bg-black/[0.015] p-3 shadow-xs dark:border-white/10 dark:bg-white/[0.02]"
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-foreground font-mono text-base font-bold tracking-tight">{value}</div>
      {subtext && (
        <div className="text-muted-foreground truncate font-mono text-[9px]">{subtext}</div>
      )}
    </FacetCard>
  );
}
