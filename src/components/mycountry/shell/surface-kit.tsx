"use client";

import React from "react";
import { cn } from "~/lib/utils";

/**
 * Shared building blocks for the MyCountry command surface (Facet + Apple HIG):
 * one focus ring, one accent (amber) for primary actions, semantic tones for status,
 * a sentence-case section header, and a segmented filter. Theme tokens only, so every
 * piece reads in light and dark mode.
 */

/** Keyboard focus ring shared by every pressable in the shell. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Tactile press + the colour properties that change on hover. */
export const PRESSABLE =
  "cursor-pointer select-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]";

/** Filled primary action: the single MyCountry accent. 44px tall on touch, 36px from `sm`. */
export const PRIMARY_BUTTON = cn(
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-400 sm:h-9",
  PRESSABLE,
  FOCUS_RING
);

/** Quiet secondary action (Apple "gray" button). */
export const SECONDARY_BUTTON = cn(
  "bg-muted/70 text-foreground hover:bg-muted inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium sm:h-9",
  PRESSABLE,
  FOCUS_RING
);

/** Borderless icon/text button for toolbars. */
export const GHOST_BUTTON = cn(
  "text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-medium sm:h-9 sm:min-w-9",
  PRESSABLE,
  FOCUS_RING
);

/** Grouped inset surface for rows and tiles nested inside a card (opaque, no blur). */
export const INSET_SURFACE = "bg-muted/40 rounded-2xl";

export type Tone =
  | "critical"
  | "warning"
  | "accent"
  | "info"
  | "success"
  | "neutral"
  | "diplomacy"
  | "defense"
  | "politics"
  | "economy";

/**
 * Semantic tones. `tile` is the rounded icon square, `text` the label colour, `dot` a small
 * status mark. Domain tones only ever colour icon tiles, never whole cards.
 */
export const TONE: Record<Tone, { tile: string; text: string; dot: string }> = {
  critical: {
    tile: "bg-red-500/12 text-red-600 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  warning: {
    tile: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  accent: {
    tile: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  info: {
    tile: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  success: {
    tile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  neutral: {
    tile: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  diplomacy: {
    tile: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-400",
    text: "text-cyan-700 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  defense: {
    tile: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  politics: {
    tile: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  economy: {
    tile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

/** Rounded icon square in a tone (Apple Settings-style glyph tile). */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" && "h-7 w-7 rounded-lg",
        size === "md" && "h-9 w-9 rounded-xl",
        size === "lg" && "h-11 w-11 rounded-xl",
        TONE[tone].tile,
        className
      )}
    >
      <Icon className={size === "lg" ? "h-5 w-5" : size === "md" ? "h-4.5 w-4.5" : "h-4 w-4"} />
    </span>
  );
}

/** Sentence-case card header: headline title, optional footnote and trailing accessory. */
export function SectionHeader({
  id,
  title,
  subtitle,
  accessory,
  as: Heading = "h2",
  className,
}: {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accessory?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-foreground text-base font-semibold tracking-tight">
          {title}
        </Heading>
        {subtitle ? <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p> : null}
      </div>
      {accessory ? <div className="flex shrink-0 items-center gap-2">{accessory}</div> : null}
    </div>
  );
}

/** Horizontally scrolling segmented control used for list filters. */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "bg-muted/60 flex max-w-full scrollbar-none gap-0.5 overflow-x-auto rounded-xl p-0.5",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "h-9 shrink-0 rounded-[10px] px-3 text-xs font-medium sm:h-7",
              PRESSABLE,
              FOCUS_RING,
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
