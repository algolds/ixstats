import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Eyebrow } from "./eyebrow";

/**
 * Stat (Facet 3 §7.1): an `Eyebrow` data label, a value, an optional delta and hint. Facet 3.1: the
 * value and the delta are in the data face (`font-data` — Azeret Mono, tabular, slashed zero).
 *
 *   <Stat label="GDP" value="$1.2T" delta={{ value: "+2.4%", direction: "up" }} hint="vs. last year" />
 *
 * `icon` adds a 14px glyph to the label row (§6: 14px with caption-sized text), leading the label by
 * default like HIG summary tiles; `iconPlacement="trailing"` pins it to the row's end instead
 * (metric grids whose icon is a corner mark). The icon is decorative (`aria-hidden`) and
 * `label-secondary` unless the caller colours it, e.g. `icon={<Heart className="text-red" />}`.
 *
 * The delta always pairs its colour with an arrow icon and screen-reader text (colour never
 * carries meaning alone, §10). `sentiment` decides the colour when "up" is bad (e.g. debt).
 */
export type StatDeltaDirection = "up" | "down" | "neutral";

export interface StatDelta {
  /** Display text, e.g. "+2.4%" or "−120". */
  value: React.ReactNode;
  direction: StatDeltaDirection;
  /** Colour meaning; defaults to up = positive, down = negative, neutral = neutral. */
  sentiment?: "positive" | "negative" | "neutral";
  /** Screen-reader text; defaults to "Up", "Down" or "No change". */
  label?: string;
}

export interface StatProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: StatDelta;
  hint?: React.ReactNode;
  /** `md` (default): `text-title-3` value. `sm`: `text-headline` value for dense grids. */
  size?: "sm" | "md";
  /** Decorative glyph in the label row (14px, `aria-hidden`). */
  icon?: React.ReactNode;
  /** `leading` (default): before the label. `trailing`: at the end of the label row. */
  iconPlacement?: "leading" | "trailing";
}

const DIRECTION_ICON = { up: ArrowUp, down: ArrowDown, neutral: Minus } as const;
const DIRECTION_LABEL = { up: "Up", down: "Down", neutral: "No change" } as const;
const DEFAULT_SENTIMENT = { up: "positive", down: "negative", neutral: "neutral" } as const;
const SENTIMENT_CLASS = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-label-secondary",
} as const;

export function StatDeltaBadge({ delta, className }: { delta: StatDelta; className?: string }) {
  const Icon = DIRECTION_ICON[delta.direction];
  const sentiment = delta.sentiment ?? DEFAULT_SENTIMENT[delta.direction];
  return (
    <span
      data-slot="stat-delta"
      data-direction={delta.direction}
      data-sentiment={sentiment}
      className={cn(
        "text-footnote font-data inline-flex items-center gap-1 font-medium tabular-nums",
        SENTIMENT_CLASS[sentiment],
        className
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{delta.label ?? DIRECTION_LABEL[delta.direction]} </span>
      {delta.value}
    </span>
  );
}

export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  (
    {
      label,
      value,
      delta,
      hint,
      size = "md",
      icon,
      iconPlacement = "leading",
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      data-slot="stat"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      {...props}
    >
      {icon != null && icon !== false ? (
        <span
          data-slot="stat-label-row"
          data-icon-placement={iconPlacement}
          className={cn(
            "flex min-w-0 items-center gap-2",
            iconPlacement === "trailing" && "flex-row-reverse justify-between gap-2"
          )}
        >
          <span
            aria-hidden
            data-slot="stat-icon"
            className="text-label-secondary inline-flex shrink-0 [:where(&)_svg]:size-3.5"
          >
            {icon}
          </span>
          <Eyebrow className="block min-w-0 truncate">{label}</Eyebrow>
        </span>
      ) : (
        <Eyebrow className="block truncate">{label}</Eyebrow>
      )}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          data-slot="stat-value"
          className={cn(
            "text-label font-data min-w-0 truncate tabular-nums",
            size === "sm" ? "text-headline" : "text-title-3"
          )}
        >
          {value}
        </span>
        {delta && <StatDeltaBadge delta={delta} />}
      </div>
      {hint != null && hint !== false && (
        <span data-slot="stat-hint" className="text-footnote text-label-secondary">
          {hint}
        </span>
      )}
    </div>
  )
);
Stat.displayName = "Stat";
