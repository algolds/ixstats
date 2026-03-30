// src/components/wikios/profile/StreakCalendar.tsx
// GitHub-style heatmap for Loreward wins — gold=winner, silver=runner-up.

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface StreakCalendarProps {
  username: string;
}

export function StreakCalendar({ username }: StreakCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data } = api.lorewards.getStreakCalendar.useQuery(
    { username, year, month },
    { staleTime: 60000 }
  );

  const days = data?.days ?? {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="wikios-streak-calendar">
      <div className="wikios-streak-header">
        <button onClick={prevMonth} className="wikios-streak-nav"><ChevronLeft size={14} /></button>
        <span className="wikios-streak-month">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={nextMonth} className="wikios-streak-nav" disabled={isCurrentMonth}><ChevronRight size={14} /></button>
      </div>

      <div className="wikios-streak-grid">
        {DAY_LABELS.map((d) => (
          <div key={d} className="wikios-streak-day-label">{d}</div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="wikios-streak-cell wikios-streak-empty" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const status = days[day];
          const isToday = isCurrentMonth && day === now.getDate();

          return (
            <div
              key={day}
              className={cn(
                "wikios-streak-cell",
                status === "winner" && "wikios-streak-win",
                status === "runner-up" && "wikios-streak-runner",
                isToday && "wikios-streak-today",
              )}
              title={
                status === "winner" ? `${MONTH_NAMES[month - 1]} ${day} — Winner` :
                status === "runner-up" ? `${MONTH_NAMES[month - 1]} ${day} — Runner-up` :
                `${MONTH_NAMES[month - 1]} ${day}`
              }
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="wikios-streak-legend">
        <span className="wikios-streak-legend-item"><span className="wikios-streak-swatch wikios-streak-win" /> Winner</span>
        <span className="wikios-streak-legend-item"><span className="wikios-streak-swatch wikios-streak-runner" /> Runner-up</span>
      </div>
    </div>
  );
}
