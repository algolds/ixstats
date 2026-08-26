"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-black/10 dark:border-white/15 bg-background/95 backdrop-blur-2xl p-6 sm:p-7 space-y-6 shadow-2xl">
        <DialogHeader className="border-b border-black/8 dark:border-white/10 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  <span>Lorewards Civic Accolades</span>
                </DialogTitle>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Author Identity: <strong className="text-foreground">User:{wikiUsername}</strong>
                </p>
              </div>
            </div>

            {stats?.rank ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 font-mono text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                <span>Global Rank #{stats.rank}</span>
              </div>
            ) : (
              <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                Unranked
              </div>
            )}
          </div>
        </DialogHeader>

        {/* 1. 6-Cell Metric Matrix */}
        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
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
          <div className="py-4 text-center text-xs text-muted-foreground">
            No Loreward stats recorded for this author.
          </div>
        )}

        {/* 2. Interactive Streak Calendar & Award History Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left: Streak Calendar (5 Cols) */}
          <FacetCard
            depth={1}
            interactive="none"
            className="md:col-span-5 rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-4 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-black/6 dark:border-white/8 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  {MONTH_NAMES[calMonth - 1]} {calYear}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  data-cuelume-press="soft"
                  className="h-6 w-6 rounded-lg border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-foreground active:scale-[0.95] transition-all cursor-pointer"
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
                    "h-6 w-6 rounded-lg border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-center transition-all",
                    isCurrentMonth
                      ? "opacity-30 cursor-not-allowed"
                      : "text-stone-600 dark:text-stone-300 hover:text-foreground active:scale-[0.95] cursor-pointer"
                  )}
                  title="Next Month"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-bold text-muted-foreground">
                {DAY_LABELS.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-6 rounded-md bg-black/[0.01] dark:bg-white/[0.01]" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const status = days[day];
                  const isToday = isCurrentMonth && day === now.getDate();

                  return (
                    <div
                      key={day}
                      className={cn(
                        "h-6 rounded-md font-mono text-[11px] flex items-center justify-center transition-all select-none",
                        status === "winner" &&
                          "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/40",
                        status === "runner-up" &&
                          "bg-stone-500/20 text-stone-700 dark:text-stone-300 font-medium border border-stone-500/30",
                        !status && "text-muted-foreground/80 hover:bg-black/5 dark:hover:bg-white/5",
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

            {/* Legend */}
            <div className="pt-2 border-t border-black/6 dark:border-white/8 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-500/40 border border-amber-500" />
                <span>Winner</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-stone-500/40 border border-stone-500" />
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
            className="md:col-span-7 rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-4 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-black/6 dark:border-white/8 pb-2.5">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>LAURELS HISTORY ({awardHistory.length})</span>
              </h4>
              <Link
                href="/wiki"
                data-cuelume-press="soft"
                className="font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                <span>WikiOS</span>
                <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            {awardHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No previous laurels recorded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {awardHistory.map((award, i) => (
                  <div
                    key={award.id || `${award.date}-${i}`}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.01] dark:bg-white/[0.015] p-2.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 border",
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
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
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

        {/* Footer */}
        <div className="border-t border-black/8 dark:border-white/10 pt-4 flex items-center justify-between">
          <Link
            href={`/wiki/user/${encodeURIComponent(wikiUsername)}`}
            data-cuelume-press="soft"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Open Dedicated WikiOS Profile</span>
          </Link>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            data-cuelume-press="soft"
            className="rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 px-4 py-2 text-xs font-semibold hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
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
      className="rounded-xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-3 space-y-0.5 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-base font-bold text-foreground tracking-tight font-mono">{value}</div>
      {subtext && (
        <div className="font-mono text-[9px] text-muted-foreground truncate">{subtext}</div>
      )}
    </FacetCard>
  );
}
