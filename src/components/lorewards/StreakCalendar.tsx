"use client";

import { useState } from "react";
import {
  Calendar,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { LorewardsSection } from "./LorewardsSection";

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

/** A month of daily Loreward wins and runner-up places for a wiki user. */
export function StreakCalendar({ username }: { username: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data } = api.lorewards.getStreakCalendar.useQuery(
    { username, year, month },
    { staleTime: 60_000 }
  );

  const days = data?.days ?? {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const monthName = MONTH_NAMES[month - 1]!;

  const step = (by: -1 | 1) => {
    const moved = new Date(year, month - 1 + by, 1);
    setYear(moved.getFullYear());
    setMonth(moved.getMonth() + 1);
  };

  return (
    <LorewardsSection
      title={`${monthName} ${year}`}
      action={
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => step(1)}
            disabled={isCurrentMonth}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
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
                  status === "winner" && "bg-caution/15 text-caution-ink font-semibold",
                  status === "runner-up" && "bg-fill-3 text-label font-medium",
                  !status && "text-label-secondary",
                  isToday && "ring-tint ring-1"
                )}
                title={status ? `${monthName} ${day}: Loreward ${status}` : `${monthName} ${day}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-separator text-label-secondary text-footnote flex items-center justify-between border-t pt-2">
        <span className="flex items-center gap-1">
          <Calendar aria-hidden className="size-3.5" />
          <span>Streak calendar</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span aria-hidden className="bg-caution/15 size-2.5 rounded-xs" />
            <span>Winner</span>
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="bg-fill-3 size-2.5 rounded-xs" />
            <span>Runner-up</span>
          </span>
        </span>
      </div>
    </LorewardsSection>
  );
}
