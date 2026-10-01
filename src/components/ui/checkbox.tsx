"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check as CheckIcon, Minus as MinusIcon } from "iconoir-react";

import { cn } from "~/lib/utils/cn";

/**
 * Checkbox (spec §7.2): Radix checkbox (`role="checkbox"`, `aria-checked` incl. "mixed"). Checked
 * and indeterminate fill with the tint; 44px hit area on touch.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox relative size-4 shrink-0 cursor-pointer rounded-[4px] border border-label-tertiary bg-surface",
        "transition-[color,background-color,border-color] duration-150 ease-out-facet",
        "data-[state=checked]:border-tint data-[state=checked]:bg-tint data-[state=checked]:text-on-tint",
        "data-[state=indeterminate]:border-tint data-[state=indeterminate]:bg-tint data-[state=indeterminate]:text-on-tint",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
        "aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
