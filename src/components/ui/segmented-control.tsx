"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { springSnappy } from "~/lib/design/motion";

/**
 * SegmentedControl (spec §7.2): a single choice among 2–5 peer options — view switchers, periods,
 * filters. The selected segment is marked by a thumb that springs (`spring-snappy`) between
 * segments.
 *
 * More than five options (HIG: keep segments few and equal) scroll horizontally instead of
 * squeezing: the track becomes a scroller capped at its container's width, segments keep their
 * natural width, and the selected segment is scrolled into view. `scrollable` forces this on or
 * off; by default it is on above five options.
 *
 * Each option may carry a trailing `badge` (a count in a tabular pill) with a `badgeLabel` for
 * screen readers ("12 unread"); the badge is `aria-hidden` and its label joins the segment's name.
 *
 * ARIA: a `radiogroup` of `radio`s by default; with `asTabs` a `tablist` of `tab`s (pass
 * `getTabPanelId` to wire `aria-controls`). One roving tab stop; the arrow keys, Home and End move
 * the selection. Name the control with `aria-label` (or `aria-labelledby`).
 *
 * ```tsx
 * <SegmentedControl
 *   aria-label="Period"
 *   value={period}
 *   onValueChange={setPeriod}
 *   options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]}
 * />
 * ```
 */

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Leading icon element, e.g. `<ViewGrid />`. */
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Accessible name when the label is icon-only or not plain text. */
  "aria-label"?: string;
  /**
   * Trailing count or short badge, e.g. `12` unread. Numbers render tabular in a small pill;
   * nodes render as given. Hidden from assistive tech in favour of `badgeLabel`.
   */
  badge?: React.ReactNode;
  /**
   * What the badge means to a screen reader, appended to the segment's name ("Inbox, 12 unread").
   * Defaults to the badge itself when it is a number or string.
   */
  badgeLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "role"
> {
  options: readonly SegmentedControlOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** @default "md" */
  size?: "sm" | "md";
  /** Stretch to the container width with equal segments. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Expose as `tablist`/`tab` instead of `radiogroup`/`radio` (when it switches panels). */
  asTabs?: boolean;
  /** With `asTabs`: the id of the panel each tab controls. */
  getTabPanelId?: (value: T) => string;
  /** Class for each segment button. */
  itemClassName?: string;
  /**
   * Scroll horizontally instead of squeezing segments. Default: on when there are more than
   * `MAX_SEGMENTS` (5) options.
   */
  scrollable?: boolean;
}

/** HIG: a segmented control holds at most five segments; beyond that it scrolls. */
export const MAX_SEGMENTS = 5;

const sizes = {
  sm: {
    track: "h-(--control-height-sm) rounded-control-sm",
    item: "px-3 text-footnote font-medium gap-1 [:where(&)_svg]:size-3.5",
    // Concentric with the track: control-sm (8) minus the 2px track padding.
    thumb: "rounded-[calc(var(--radius-control-sm)-0.125rem)]",
  },
  md: {
    track: "h-(--control-height) rounded-control",
    item: "px-3 text-body font-medium gap-2 [:where(&)_svg]:size-4",
    thumb: "rounded-control-sm",
  },
} as const;

export function SegmentedControl<T extends string = string>({
  options,
  value: controlledValue,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth = false,
  disabled = false,
  asTabs = false,
  getTabPanelId,
  itemClassName,
  scrollable: scrollableProp,
  className,
  onKeyDown,
  ...props
}: SegmentedControlProps<T>) {
  const scrollable = scrollableProp ?? options.length > MAX_SEGMENTS;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<T | undefined>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const thumbId = `${React.useId()}-segment-thumb`;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const metrics = sizes[size];

  const select = (next: T) => {
    if (next === value) return;
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  };

  const enabled = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !disabled && !option.disabled);
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Keep the selected segment visible when the track scrolls. Only the track scrolls (never the
  // page), and only when the segment is clipped.
  const trackRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const track = trackRef.current;
    const item = refs.current[selectedIndex];
    if (!scrollable || !track || !item) return;
    const start = item.offsetLeft;
    const end = start + item.offsetWidth;
    if (start < track.scrollLeft) track.scrollLeft = start;
    else if (end > track.scrollLeft + track.clientWidth) track.scrollLeft = end - track.clientWidth;
  }, [scrollable, selectedIndex]);
  // Roving tab stop: the selected segment, else the first enabled one.
  const tabStop =
    selectedIndex !== -1 && enabled.some(({ index }) => index === selectedIndex)
      ? selectedIndex
      : (enabled[0]?.index ?? -1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || enabled.length === 0) return;
    const focused = refs.current.findIndex((el) => el === e.target);
    const position = enabled.findIndex(({ index }) => index === focused);
    if (position === -1) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (position + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (position - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = enabled[next]!;
    refs.current[target.index]?.focus();
    select(target.option.value);
  };

  return (
    <div
      ref={trackRef}
      role={asTabs ? "tablist" : "radiogroup"}
      aria-disabled={disabled || undefined}
      data-slot="segmented-control"
      data-size={size}
      data-scrollable={scrollable || undefined}
      className={cn(
        "bg-fill-3 relative items-stretch gap-0.5 p-0.5 select-none",
        fullWidth ? "flex w-full" : "inline-flex",
        scrollable &&
          "max-w-full [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden",
        metrics.track,
        disabled && "opacity-50",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const isDisabled = disabled || option.disabled;
        const hasBadge =
          option.badge !== undefined && option.badge !== null && option.badge !== false;
        const badgeLabel =
          option.badgeLabel ??
          (typeof option.badge === "number" || typeof option.badge === "string"
            ? String(option.badge)
            : undefined);
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role={asTabs ? "tab" : "radio"}
            aria-checked={asTabs ? undefined : selected}
            aria-selected={asTabs ? selected : undefined}
            aria-controls={asTabs ? getTabPanelId?.(option.value) : undefined}
            aria-label={
              option["aria-label"] && hasBadge && badgeLabel
                ? `${option["aria-label"]}, ${badgeLabel}`
                : option["aria-label"]
            }
            tabIndex={index === tabStop ? 0 : -1}
            disabled={isDisabled}
            data-slot="segmented-control-item"
            data-value={option.value}
            data-state={selected ? "on" : "off"}
            onClick={() => select(option.value)}
            className={cn(
              "relative inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap",
              "ease-out-facet transition-[color,opacity] duration-150",
              "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0",
              // 44px tall hit area on touch without changing the visual height.
              "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2",
              fullWidth && "flex-1",
              // In a scroller segments keep their natural width, and the focus ring is drawn
              // inside so the track's overflow clip does not cut it off.
              scrollable && "shrink-0 focus-visible:-outline-offset-2",
              metrics.thumb,
              metrics.item,
              selected ? "text-label" : "text-label-secondary hover:text-label",
              itemClassName
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                aria-hidden
                transition={springSnappy}
                className={cn("bg-control-thumb shadow-card absolute inset-0", metrics.thumb)}
              />
            )}
            <span className="relative inline-flex min-w-0 items-center gap-[inherit]">
              {option.icon}
              {option.label}
              {hasBadge && (
                <span
                  aria-hidden
                  data-slot="segmented-control-badge"
                  className={cn(
                    "text-caption inline-flex min-w-5 items-center justify-center rounded-full px-1 tabular-nums",
                    selected ? "bg-tint-fill text-tint" : "bg-fill-3 text-label-secondary"
                  )}
                >
                  {option.badge}
                </span>
              )}
              {hasBadge && badgeLabel && !option["aria-label"] && (
                <span className="sr-only">, {badgeLabel}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
