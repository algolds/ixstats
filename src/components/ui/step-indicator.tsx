"use client";

import * as React from "react";
import { Check } from "iconoir-react";
import { cn } from "~/lib/utils/cn";

/**
 * The progress row of a wizard — numbered steps, the
 * current one tinted, completed ones checked.
 *
 * Semantics: a `<nav>` (name it with `aria-label`, default "Progress") around an ordered list.
 * The current step carries `aria-current="step"`; completed steps say so to screen readers. With
 * `onStepClick`, steps the flow lets you revisit (`navigable`: `"previous"` by default — completed
 * steps only — or `"all"`) are buttons; the others are plain text, never disabled buttons.
 *
 * ```tsx
 * <StepIndicator
 *   steps={[{ id: "type", label: "Type" }, { id: "target", label: "Target" }]}
 *   current={step - 1}
 *   onStepClick={(index) => setStep(index + 1)}
 * />
 * ```
 */

export interface StepIndicatorStep {
  id: string;
  label: React.ReactNode;
  /** Optional icon shown instead of the step number while the step is not completed. */
  icon?: React.ReactNode;
}

export interface StepIndicatorProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  steps: readonly StepIndicatorStep[];
  /** Zero-based index of the current step. Steps before it are completed. */
  current: number;
  /** Makes navigable steps buttons; called with the step's zero-based index. */
  onStepClick?: (index: number) => void;
  /** Which steps `onStepClick` may jump to. @default "previous" */
  navigable?: "previous" | "all";
  /** Hide step labels below `sm`, keeping only the numbered marks. @default true */
  compactOnPhones?: boolean;
}

export const StepIndicator = React.forwardRef<HTMLElement, StepIndicatorProps>(
  (
    {
      steps,
      current,
      onStepClick,
      navigable = "previous",
      compactOnPhones = true,
      className,
      "aria-label": ariaLabel = "Progress",
      ...props
    },
    ref
  ) => (
    <nav
      ref={ref}
      aria-label={ariaLabel}
      data-slot="step-indicator"
      className={cn("min-w-0", className)}
      {...props}
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {steps.map((step, index) => {
          const state = index < current ? "complete" : index === current ? "current" : "upcoming";
          const clickable =
            !!onStepClick && index !== current && (navigable === "all" || index < current);
          const mark = (
            <span
              aria-hidden
              data-slot="step-indicator-mark"
              className={cn(
                "text-caption flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums [:where(&)_svg]:size-3.5",
                state === "current" && "bg-tint text-on-tint",
                state === "complete" && "bg-tint-fill text-tint",
                state === "upcoming" && "bg-fill-3 text-label-secondary"
              )}
            >
              {state === "complete" ? <Check /> : (step.icon ?? index + 1)}
            </span>
          );
          const label = (
            <span
              className={cn(
                "text-footnote truncate",
                compactOnPhones && "sr-only sm:not-sr-only",
                state === "current" ? "text-label font-semibold" : "text-label-secondary"
              )}
            >
              {step.label}
              {state === "complete" && <span className="sr-only"> (completed)</span>}
            </span>
          );
          const itemClass = "rounded-full flex min-h-8 min-w-0 items-center gap-2 py-1 pr-3 pl-1";
          return (
            <li
              key={step.id}
              data-slot="step-indicator-step"
              data-state={state}
              className="flex min-w-0 items-center gap-1"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-3 shrink-0 sm:w-5",
                    index <= current ? "bg-tint" : "bg-separator"
                  )}
                />
              )}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  className={cn(
                    itemClass,
                    "hover:bg-fill-4 cursor-pointer",
                    "ease-out-facet transition-colors duration-150",
                    "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
                    "pointer-coarse:min-h-11"
                  )}
                >
                  {mark}
                  {label}
                </button>
              ) : (
                <span aria-current={state === "current" ? "step" : undefined} className={itemClass}>
                  {mark}
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  )
);
StepIndicator.displayName = "StepIndicator";
