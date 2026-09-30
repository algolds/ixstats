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
}

const sizes = {
  sm: {
    track: "h-(--control-height-sm) rounded-control-sm",
    item: "px-2.5 text-footnote font-medium gap-1 [:where(&)_svg]:size-3.5",
    thumb: "rounded-md",
  },
  md: {
    track: "h-(--control-height) rounded-control",
    item: "px-3 text-body font-medium gap-1.5 [:where(&)_svg]:size-4",
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
  className,
  onKeyDown,
  ...props
}: SegmentedControlProps<T>) {
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
      role={asTabs ? "tablist" : "radiogroup"}
      aria-disabled={disabled || undefined}
      data-slot="segmented-control"
      data-size={size}
      className={cn(
        "relative items-stretch gap-0.5 bg-fill-3 p-0.5 select-none",
        fullWidth ? "flex w-full" : "inline-flex",
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
            aria-label={option["aria-label"]}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={isDisabled}
            data-slot="segmented-control-item"
            data-value={option.value}
            data-state={selected ? "on" : "off"}
            onClick={() => select(option.value)}
            className={cn(
              "relative inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap",
              "transition-[color,opacity] duration-150 ease-out-facet",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0",
              // 44px tall hit area on touch without changing the visual height.
              "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2",
              fullWidth && "flex-1",
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
                className={cn(
                  "absolute inset-0 bg-surface shadow-card dark:bg-fill",
                  metrics.thumb
                )}
              />
            )}
            <span className="relative inline-flex min-w-0 items-center gap-[inherit]">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
