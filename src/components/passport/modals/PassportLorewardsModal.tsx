"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard, FACET_INSET_SURFACE } from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
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
      <DialogContent className="max-h-[90vh] max-w-3xl space-y-6 overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="border-separator border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy aria-hidden className="text-tint size-6 shrink-0" />
              <div>
                <DialogTitle>Lorewards Civic Accolades</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Author identity:{" "}
                  <strong className="text-label font-medium">User:{wikiUsername}</strong>
                </DialogDescription>
              </div>
            </div>

            {stats?.rank ? (
              <Badge variant="caution" className="tabular-nums">
                <Trophy aria-hidden />
                <span>Global Rank #{stats.rank}</span>
              </Badge>
            ) : (
              <Badge variant="neutral">Unranked</Badge>
            )}
          </div>
        </DialogHeader>

        {/* 1. Metric matrix */}
        {stats ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Daily laurels"
              value={stats.dailyWins}
              icon={<Award />}
              subtext="1st place"
            />
            <MetricCard
              label="Runner-ups"
              value={stats.dailyRunnerUps}
              icon={<TrendingUp />}
              subtext="2nd place"
            />
            <MetricCard
              label="Weekly laurels"
              value={stats.weeklyWins}
              icon={<Trophy />}
              subtext="Weekly crown"
            />
            <MetricCard
              label="Monthly laurels"
              value={stats.monthlyWins}
              icon={<Trophy />}
              subtext="Monthly best"
            />
            <MetricCard
              label="Streak"
              value={`${stats.currentStreak}d`}
              icon={<Flame />}
              subtext={`Best: ${stats.longestStreak}d`}
            />
            <MetricCard
              label="Score"
              value={stats.totalScore.toLocaleString()}
              icon={<Hash />}
              subtext={`${stats.totalBytes.toLocaleString()} B`}
            />
          </div>
        ) : (
          <p className="text-label-secondary text-callout py-4 text-center">
            No Loreward stats recorded for this author.
          </p>
        )}

        {/* 2. Streak calendar & award history */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
          {/* Streak calendar */}
          <section
            aria-labelledby="lorewards-calendar-title"
            className={cn(FACET_INSET_SURFACE, "space-y-3 p-4 md:col-span-5")}
          >
            <div className="border-separator flex items-center justify-between border-b pb-2">
              <h4
                id="lorewards-calendar-title"
                className="text-headline text-label flex items-center gap-1.5"
              >
                <Calendar aria-hidden className="text-label-secondary size-4" />
                <span>
                  {MONTH_NAMES[calMonth - 1]} <span className="tabular-nums">{calYear}</span>
                </span>
              </h4>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="gray"
                  size="icon-sm"
                  onClick={prevMonth}
                  title="Previous Month"
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="gray"
                  size="icon-sm"
                  onClick={nextMonth}
                  disabled={isCurrentMonth}
                  title="Next Month"
                  aria-label="Next month"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="space-y-1">
              <div
                aria-hidden
                className="text-label-secondary text-caption grid grid-cols-7 gap-1 text-center"
              >
                {DAY_LABELS.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} aria-hidden className="h-6" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const status = days[day];
                  const isToday = isCurrentMonth && day === now.getDate();

                  return (
                    <div
                      key={day}
                      className={cn(
                        "rounded-control-sm text-footnote flex h-6 items-center justify-center tabular-nums select-none",
                        status === "winner" && "bg-yellow/15 text-yellow-ink font-semibold",
                        status === "runner-up" && "bg-fill-3 text-label font-medium",
                        !status && "text-label-secondary",
                        isToday && "ring-tint ring-1"
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
            <div className="border-separator text-label-secondary text-footnote flex items-center justify-between border-t pt-2">
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="bg-caution/15 ring-caution/40 size-2.5 rounded-xs ring-1"
                />
                <span>Winner</span>
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden className="bg-fill-3 size-2.5 rounded-xs" />
                <span>Runner-up</span>
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden className="ring-tint size-2.5 rounded-xs ring-1" />
                <span>Today</span>
              </span>
            </div>
          </section>

          {/* Laurels ledger */}
          <section
            aria-labelledby="lorewards-history-title"
            className={cn(FACET_INSET_SURFACE, "space-y-3 p-4 md:col-span-7")}
          >
            <div className="border-separator flex items-center justify-between border-b pb-2">
              <h4
                id="lorewards-history-title"
                className="text-headline text-label flex items-center gap-1.5"
              >
                <Award aria-hidden className="text-label-secondary size-4" />
                <span>
                  Laurels history <span className="tabular-nums">({awardHistory.length})</span>
                </span>
              </h4>
              <Link
                href="/wiki"
                className="text-tint text-footnote flex items-center gap-0.5 hover:underline"
              >
                <span>WikiOS</span>
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </div>

            {awardHistory.length === 0 ? (
              <p className="text-label-secondary text-footnote py-6 text-center">
                No previous laurels recorded yet.
              </p>
            ) : (
              <ul className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {awardHistory.map((award, i) => (
                  <li
                    key={award.id || `${award.date}-${i}`}
                    className="bg-surface rounded-row text-footnote flex items-center justify-between gap-2 p-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Badge
                        variant={
                          award.type === "daily"
                            ? "caution"
                            : award.type === "weekly"
                              ? "info"
                              : award.type === "monthly"
                                ? "tinted"
                                : "neutral"
                        }
                        className="capitalize"
                      >
                        {award.type}
                      </Badge>

                      <div className="min-w-0 flex-1">
                        {award.page ? (
                          <Link
                            href={`/wiki/${encodeURIComponent(award.page)}`}
                            className="text-label text-headline block truncate hover:underline"
                          >
                            {award.page}
                          </Link>
                        ) : (
                          <span className="text-label text-headline">Lore Laureate</span>
                        )}
                        <div className="text-label-secondary text-footnote flex items-center gap-1.5 tabular-nums">
                          <span>{award.date}</span>
                          <span aria-hidden>·</span>
                          <span
                            className={cn(
                              "capitalize",
                              award.role === "winner" && "text-label font-medium"
                            )}
                          >
                            {award.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {award.score !== null && award.score !== undefined && (
                      <span className="text-success text-footnote shrink-0 font-medium tabular-nums">
                        +{award.score.toLocaleString()} pts
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="border-separator items-center border-t pt-4 sm:justify-between">
          <Link
            href={`/wiki/contributions/${encodeURIComponent(wikiUsername)}`}
            className="text-tint text-footnote inline-flex cursor-pointer items-center gap-1.5 font-medium hover:underline"
          >
            <BookOpen aria-hidden className="size-3.5" />
            <span>View Wiki Contributions</span>
          </Link>

          <Button type="button" variant="gray" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
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
    <FacetCard variant="inset" padding="sm">
      <Stat label={label} value={value} hint={subtext} icon={icon} iconPlacement="trailing" />
    </FacetCard>
  );
}
