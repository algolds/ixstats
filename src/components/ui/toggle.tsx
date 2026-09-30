"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils/cn";
import { focusRing, hitSlop } from "~/components/ui/button";

/**
 * Toggle (spec §7.2): a two-state button (`aria-pressed`). Off is a plain label, on is the tint at
 * fill strength. Variants: `default` (no chrome) · `outline` (hairline) · `pill` (rounded filter
 * chip). Sizes follow the control heights (28/36/44).
 */
const toggleVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap select-none",
    "text-label-secondary hover:bg-fill-4 hover:text-label",
    "data-[state=on]:bg-tint-fill data-[state=on]:text-tint data-[state=on]:hover:bg-tint/20",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-facet active:scale-[0.98] motion-reduce:active:scale-100",
    focusRing,
    hitSlop,
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&)_svg]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-separator bg-transparent data-[state=on]:border-transparent",
        pill: "rounded-full border border-separator bg-transparent data-[state=on]:border-transparent",
      },
      size: {
        sm: "h-(--control-height-sm) min-w-(--control-height-sm) rounded-control-sm px-2 text-footnote",
        default: "h-(--control-height) min-w-(--control-height) rounded-control px-2.5 text-body",
        lg: "h-(--control-height-lg) min-w-(--control-height-lg) rounded-control-lg px-3 text-body",
      },
    },
    compoundVariants: [
      { variant: "pill", size: "sm", className: "rounded-full px-3" },
      { variant: "pill", size: "default", className: "rounded-full px-3.5" },
      { variant: "pill", size: "lg", className: "rounded-full px-4" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ToggleProps
  extends React.ComponentProps<"button">, VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

function Toggle({
  className,
  variant,
  size,
  pressed: controlledPressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  ...props
}: ToggleProps) {
  const [uncontrolledPressed, setUncontrolledPressed] = React.useState(defaultPressed);
  const pressed = controlledPressed ?? uncontrolledPressed;
  return (
    <button
      type="button"
      data-slot="toggle"
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (controlledPressed === undefined) setUncontrolledPressed(!pressed);
        onPressedChange?.(!pressed);
      }}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants, type ToggleProps };
