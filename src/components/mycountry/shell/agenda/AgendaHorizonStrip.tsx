"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { FOCUS_RING } from "../surface-kit";
import type { AgendaEvent, DayHorizonItem } from "./agendaTypes";

interface AgendaHorizonStripProps {
  days: DayHorizonItem[];
  selectedDayOffset: number;
  onSelectDayOffset: (offset: number) => void;
  events: AgendaEvent[];
}

/** Seven-day week strip (Calendar-style): selected day filled, a dot marks days with items. */
export function AgendaHorizonStrip({
  days,
  selectedDayOffset,
  onSelectDayOffset,
  events,
}: AgendaHorizonStripProps) {
  return (
    <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-1">
      {days.map(({ offset, dayName, dayNum, isToday }) => {
        const isSelected = selectedDayOffset === offset;
        const count = events.filter((e) => e.dayOffset === offset).length;
        return (
          <button
            key={offset}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${isToday ? "Today" : dayName} ${dayNum}${
              count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ", nothing scheduled"
            }`}
            onClick={() => onSelectDayOffset(offset)}
            className={cn(
              "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors duration-150 select-none",
              FOCUS_RING,
              isSelected ? "bg-foreground text-background" : "hover:bg-muted/60 text-foreground"
            )}
          >
            <span
              className={cn(
                "text-xs",
                isSelected
                  ? "text-background/80"
                  : isToday
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {dayName}
            </span>
            <span className="text-base leading-none font-semibold tabular-nums">{dayNum}</span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 h-1.5 w-1.5 rounded-full",
                count === 0 ? "bg-transparent" : isSelected ? "bg-background" : "bg-amber-500"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
