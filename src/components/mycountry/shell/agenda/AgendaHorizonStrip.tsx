"use client";

import React from "react";
import { motion } from "motion/react";
import { Filter } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { AgendaEvent, DayHorizonItem } from "./agendaTypes";

interface AgendaHorizonStripProps {
  days: DayHorizonItem[];
  selectedDayOffset: number;
  onSelectDayOffset: (offset: number) => void;
  categoryFilter: string;
  onSelectCategoryFilter: (cat: string) => void;
  events: AgendaEvent[];
}

const CATEGORY_CHIPS = [
  { id: "all", label: "All" },
  { id: "directive", label: "⚡ Directives" },
  { id: "politics", label: "⚖️ Politics" },
  { id: "diplomacy", label: "🤝 Diplomacy" },
  { id: "defense", label: "🛡️ Defense" },
  { id: "economy", label: "📈 Economy" },
];

export function AgendaHorizonStrip({
  days,
  selectedDayOffset,
  onSelectDayOffset,
  categoryFilter,
  onSelectCategoryFilter,
  events,
}: AgendaHorizonStripProps) {
  return (
    <>
      {/* 7-Day Horizon Strip (Apple Spring Motion & Fluid Selection) */}
      <div className="relative grid grid-cols-7 gap-1.5">
        {days.map(({ offset, dayName, dayNum }) => {
          const isSelected = selectedDayOffset === offset;
          const hasEvent = events.some((e) => e.dayOffset === offset);
          return (
            <button
              key={offset}
              type="button"
              onClick={() => onSelectDayOffset(offset)}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border p-2 text-center transition-colors select-none active:scale-[0.97]",
                isSelected
                  ? "border-cyan-500/50 text-cyan-950 shadow-xs dark:text-cyan-200"
                  : "border-border/50 bg-card/40 hover:bg-card/80 text-muted-foreground dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/10"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="agenda-day-pill"
                  className="absolute inset-0 rounded-xl border border-cyan-500/40 bg-cyan-500/15 dark:bg-cyan-500/20"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 text-[9px] font-semibold tracking-wider uppercase opacity-90",
                  isSelected ? "text-cyan-950 dark:text-cyan-200" : "text-muted-foreground"
                )}
              >
                {dayName}
              </span>
              <span
                className={cn(
                  "relative z-10 text-xs font-bold tracking-tight tabular-nums",
                  isSelected ? "text-cyan-950 dark:text-cyan-200" : "text-foreground"
                )}
              >
                {dayNum}
              </span>
              {hasEvent && (
                <span className="relative z-10 mt-1 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Category Filter Chips */}
      <div className="border-border/60 flex flex-wrap items-center gap-1.5 border-t pt-2.5 dark:border-white/5">
        <div className="text-muted-foreground mr-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase select-none">
          <Filter className="h-3 w-3" />
          <span>Filter:</span>
        </div>
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = categoryFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelectCategoryFilter(chip.id)}
              className={cn(
                "relative cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors select-none active:scale-[0.97]",
                isActive
                  ? "border-cyan-500/50 font-extrabold text-cyan-950 dark:text-cyan-200"
                  : "border-border/60 bg-card/50 text-muted-foreground hover:bg-card/90 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="agenda-filter-pill"
                  className="absolute inset-0 rounded-lg border border-cyan-500/40 bg-cyan-500/15 dark:bg-cyan-500/20"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  isActive ? "text-cyan-950 dark:text-cyan-200" : "text-muted-foreground"
                )}
              >
                {chip.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
