"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Toggle } from "~/components/ui/toggle";
import type { AgendaEvent, DayHorizonItem } from "./agendaTypes";

interface AgendaHorizonStripProps {
  days: DayHorizonItem[];
  selectedDayOffset: number;
  onSelectDayOffset: (offset: number) => void;
  events: AgendaEvent[];
}

/**
 * Seven-day week strip (Calendar-style) built from `<Toggle>`: the selected day is pressed, a
 * dot marks days with items, and today's label carries the MyCountry accent.
 */
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
          <Toggle
            key={offset}
            pressed={isSelected}
            aria-label={`${isToday ? "Today" : dayName} ${dayNum}${
              count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ", nothing scheduled"
            }`}
            onClick={() => onSelectDayOffset(offset)}
            className="data-[state=on]:bg-foreground data-[state=on]:text-background hover:text-foreground h-auto min-h-16 min-w-0 flex-col gap-0.5 rounded-xl px-0 py-2 select-none"
          >
            <span
              className={cn(
                "text-xs font-normal",
                isSelected
                  ? "text-background/80"
                  : isToday
                    ? "font-semibold text-(--facet-mycountry)"
                    : "text-muted-foreground"
              )}
            >
              {dayName}
            </span>
            <span className="text-base leading-none font-semibold tabular-nums">{dayNum}</span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 size-1.5 rounded-full",
                count === 0
                  ? "bg-transparent"
                  : isSelected
                    ? "bg-background"
                    : "bg-muted-foreground"
              )}
            />
          </Toggle>
        );
      })}
    </div>
  );
}
