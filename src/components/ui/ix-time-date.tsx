"use client";

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { IxTime } from "~/lib/ixtime";
import { formatTimeAgo } from "~/lib/time-utils";

type ThemeAccent = "amber" | "cyan" | "indigo" | "red" | "green" | "purple";

const ACCENT_STYLES: Record<ThemeAccent, { label: string; border: string; tooltipBorder: string }> = {
  amber:  { label: "text-amber-600 dark:text-amber-400",   border: "border-amber-500/40",  tooltipBorder: "border-amber-500/20" },
  cyan:   { label: "text-cyan-600 dark:text-cyan-400",     border: "border-cyan-500/40",    tooltipBorder: "border-cyan-500/20" },
  indigo: { label: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/40",  tooltipBorder: "border-indigo-500/20" },
  red:    { label: "text-red-600 dark:text-red-400",       border: "border-red-500/40",     tooltipBorder: "border-red-500/20" },
  green:  { label: "text-green-600 dark:text-green-400",   border: "border-green-500/40",   tooltipBorder: "border-green-500/20" },
  purple: { label: "text-purple-600 dark:text-purple-400", border: "border-purple-500/40",  tooltipBorder: "border-purple-500/20" },
};

interface IxTimeDateProps {
  /** Real-world date (string, Date, or ms timestamp) */
  date: string | Date | number;
  /** Optional pre-computed IxTime timestamp. Auto-computed from date if omitted. */
  ixTime?: number;
  /** Display format: "date" (default), "datetime", or "relative" */
  format?: "date" | "datetime" | "relative";
  /** Section theme accent color for the tooltip. Falls back to muted styling. */
  accentColor?: ThemeAccent;
  /** Additional CSS classes */
  className?: string;
}

export function IxTimeDate({
  date,
  ixTime,
  format = "date",
  accentColor,
  className,
}: IxTimeDateProps) {
  const dateObj = useMemo(() => {
    if (date instanceof Date) return date;
    if (typeof date === "number") return new Date(date);
    return new Date(date);
  }, [date]);

  const ixTimestamp = useMemo(() => {
    if (ixTime != null) return ixTime;
    return IxTime.convertToIxTime(dateObj.getTime());
  }, [ixTime, dateObj]);

  const displayText = useMemo(() => {
    if (format === "relative") {
      return formatTimeAgo(dateObj);
    }
    if (format === "datetime") {
      return `${dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [dateObj, format]);

  const ixTimeText = useMemo(() => {
    return IxTime.formatIxTime(ixTimestamp, true);
  }, [ixTimestamp]);

  const accent = accentColor ? ACCENT_STYLES[accentColor] : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`cursor-help border-b border-dotted ${accent ? accent.border : "border-current/30"} ${className ?? ""}`}
        >
          {displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className={`text-xs ${accent ? accent.tooltipBorder : ""}`}
      >
        <span className={accent ? accent.label : "text-muted-foreground"}>IxTime:</span>{" "}
        {ixTimeText}
      </TooltipContent>
    </Tooltip>
  );
}
