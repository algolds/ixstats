"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { springSnappy } from "~/lib/design/motion";
import { useControllableState } from "~/hooks/useControllableState";

/**
 * A single choice among 2-5 peer options (view switchers, periods, filters), skinned over Radix
 * RadioGroup (`radiogroup`, arrow keys move and select) or, with `asTabs`, Radix Tabs (`tablist`). The selected segment is
 * marked by a thumb that springs between segments.
 *
 * More than five options scroll horizontally instead of squeezing (`scrollable` overrides). An
 * option may carry a trailing `badge` with a `badgeLabel` for screen readers ("12 unread").
 * Name the control with `aria-label` (or `aria-labelledby`).
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
  /** Trailing count or short badge, hidden from assistive tech in favour of `badgeLabel`. */
  badge?: React.ReactNode;
  /**
   * What the badge means to a screen reader, appended to the segment's name ("Inbox, 12 unread").
   * Defaults to the badge itself when it is a number or string.
   */
  badgeLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "role" | "dir"
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
  ...props
}: SegmentedControlProps<T>) {
  const scrollable = scrollableProp ?? options.length > MAX_SEGMENTS;
  const [value, setValue] = useControllableState<T | undefined>({
    prop: controlledValue,
    defaultProp: defaultValue,
  });
  const thumbId = `${React.useId()}-segment-thumb`;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const metrics = sizes[size];

  // A segmented control always has a choice: re-selecting the current segment is a no-op.
  const select = (next: string) => {
    if (!next || next === value) return;
    setValue(next as T);
    onValueChange?.(next as T);
  };

  // Keep the selected segment visible when the track scrolls (the track only, never the page).
  const trackRef = React.useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  React.useEffect(() => {
    const track = trackRef.current;
    const item = refs.current[selectedIndex];
    if (!scrollable || !track || !item) return;
    const start = item.offsetLeft;
    const end = start + item.offsetWidth;
    if (start < track.scrollLeft) track.scrollLeft = start;
    else if (end > track.scrollLeft + track.clientWidth) track.scrollLeft = end - track.clientWidth;
  }, [scrollable, selectedIndex]);

  const trackClassName = cn(
    "bg-fill-3 relative items-stretch gap-0.5 p-0.5 select-none",
    fullWidth ? "flex w-full" : "inline-flex",
    scrollable &&
      "max-w-full [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden",
    metrics.track,
    disabled && "opacity-50",
    className
  );

  const segments = options.map((option, index) => {
    const selected = option.value === value;
    const hasBadge = option.badge !== undefined && option.badge !== null && option.badge !== false;
    const badgeLabel =
      option.badgeLabel ??
      (typeof option.badge === "number" || typeof option.badge === "string"
        ? String(option.badge)
        : undefined);
    const segment = {
      ref: (el: HTMLButtonElement | null) => {
        refs.current[index] = el;
      },
      value: option.value,
      disabled: disabled || option.disabled,
      "aria-label":
        option["aria-label"] && hasBadge && badgeLabel
          ? `${option["aria-label"]}, ${badgeLabel}`
          : option["aria-label"],
      className: cn(
        "relative inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap",
        "facet-press facet-press-sm",
        "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        // 44px tall hit area on touch without changing the visual height.
        "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2",
        fullWidth && "flex-1",
        // In a scroller the focus ring is drawn inside so the track's overflow clip keeps it.
        scrollable && "shrink-0 focus-visible:-outline-offset-2",
        metrics.thumb,
        metrics.item,
        selected ? "text-label" : "text-label-secondary hover:text-label",
        itemClassName
      ),
    };
    const content = (
      <>
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
      </>
    );
    return asTabs ? (
      <TabsPrimitive.Trigger
        key={option.value}
        {...segment}
        data-slot="segmented-control-item"
        aria-controls={getTabPanelId?.(option.value)}
      >
        {content}
      </TabsPrimitive.Trigger>
    ) : (
      <RadioGroupPrimitive.Item key={option.value} {...segment} data-slot="segmented-control-item">
        {content}
      </RadioGroupPrimitive.Item>
    );
  });

  if (asTabs) {
    return (
      <TabsPrimitive.Root value={value ?? ""} onValueChange={select}>
        <TabsPrimitive.List
          ref={trackRef}
          data-slot="segmented-control"
          aria-disabled={disabled || undefined}
          className={trackClassName}
          {...props}
        >
          {segments}
        </TabsPrimitive.List>
      </TabsPrimitive.Root>
    );
  }
  return (
    <RadioGroupPrimitive.Root
      ref={trackRef}
      value={value ?? ""}
      onValueChange={select}
      disabled={disabled}
      data-slot="segmented-control"
      className={trackClassName}
      {...props}
    >
      {segments}
    </RadioGroupPrimitive.Root>
  );
}
