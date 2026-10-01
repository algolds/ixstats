"use client";

import * as React from "react";
import { Minus, Plus } from "iconoir-react";
import { cn } from "~/lib/utils/cn";

/**
 * Stepper (spec §7.2): small numeric adjustments with − / + buttons.
 *
 * The value is a `spinbutton` (`aria-valuenow/min/max`, optional `aria-valuetext`): ArrowUp/Down
 * step, PageUp/PageDown take a large step, Home/End jump to min/max. The − / + buttons are for
 * pointer users and sit outside the tab order (the spinbutton is the single tab stop). Name it
 * with `aria-label` or `aria-labelledby`.
 *
 * ```tsx
 * <Stepper aria-label="Quantity" value={qty} onValueChange={setQty} min={0} max={10} />
 * ```
 */

export interface StepperProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "role"
> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** @default -Infinity */
  min?: number;
  /** @default Infinity */
  max?: number;
  /** @default 1 */
  step?: number;
  /** PageUp/PageDown step. @default step × 10 */
  largeStep?: number;
  disabled?: boolean;
  /** @default "md" */
  size?: "sm" | "md";
  /** Visible value; defaults to the locale-formatted number. */
  formatValue?: (value: number) => React.ReactNode;
  /** Spoken value (`aria-valuetext`), e.g. "3 items". */
  getValueText?: (value: number) => string;
  /** @default "Decrease" */
  decrementLabel?: string;
  /** @default "Increase" */
  incrementLabel?: string;
}

function decimals(n: number) {
  if (!Number.isFinite(n)) return 0;
  const [, fraction = ""] = String(n).split(".");
  return fraction.length;
}

const sizes = {
  sm: {
    root: "h-(--control-height-sm) rounded-control-sm text-footnote",
    button: "w-(--control-height-sm) rounded-control-sm [:where(&)_svg]:size-3.5",
    value: "min-w-8 px-1",
  },
  md: {
    root: "h-(--control-height) rounded-control text-body",
    button: "w-(--control-height) rounded-control [:where(&)_svg]:size-4",
    value: "min-w-10 px-2",
  },
} as const;

export function Stepper({
  value: controlledValue,
  defaultValue,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  largeStep,
  disabled = false,
  size = "md",
  formatValue,
  getValueText,
  decrementLabel = "Decrease",
  incrementLabel = "Increase",
  className,
  onKeyDown,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: StepperProps) {
  const clamp = React.useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max]);
  const [uncontrolled, setUncontrolled] = React.useState(() =>
    clamp(defaultValue ?? (Number.isFinite(min) ? min : 0))
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;
  const precision = Math.max(decimals(step), decimals(Number.isFinite(min) ? min : 0));
  const metrics = sizes[size];

  const commit = (next: number) => {
    const rounded = clamp(Number(next.toFixed(precision)));
    if (rounded === value) return;
    if (!isControlled) setUncontrolled(rounded);
    onValueChange?.(rounded);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    const big = largeStep ?? step * 10;
    const next =
      e.key === "ArrowUp"
        ? value + step
        : e.key === "ArrowDown"
          ? value - step
          : e.key === "PageUp"
            ? value + big
            : e.key === "PageDown"
              ? value - big
              : e.key === "Home" && Number.isFinite(min)
                ? min
                : e.key === "End" && Number.isFinite(max)
                  ? max
                  : null;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  const buttonClass = cn(
    "relative inline-flex h-full shrink-0 cursor-pointer items-center justify-center text-label",
    "transition-[color,background-color,transform] duration-150 ease-out-facet hover:bg-fill-4 active:scale-[0.96] motion-reduce:active:scale-100",
    "disabled:cursor-not-allowed disabled:text-label-tertiary disabled:hover:bg-transparent",
    "[&_svg]:pointer-events-none",
    "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2",
    metrics.button
  );

  return (
    <div
      data-slot="stepper"
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "inline-flex items-center bg-fill-3 text-label select-none",
        disabled && "opacity-50",
        metrics.root,
        className
      )}
      {...props}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={decrementLabel}
        disabled={disabled || value <= min}
        onClick={() => commit(value - step)}
        className={buttonClass}
      >
        <Minus />
      </button>
      <div
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={getValueText?.(value)}
        aria-disabled={disabled || undefined}
        data-slot="stepper-value"
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-full items-center justify-center rounded-control-sm font-medium tabular-nums",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
          metrics.value
        )}
      >
        {formatValue ? formatValue(value) : value.toLocaleString()}
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-label={incrementLabel}
        disabled={disabled || value >= max}
        onClick={() => commit(value + step)}
        className={buttonClass}
      >
        <Plus />
      </button>
    </div>
  );
}
