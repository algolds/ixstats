"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "~/lib/utils/cn";
import { focusRing, hitSlop } from "~/components/ui/button";

const sizes = {
  sm: {
    root: "h-6 w-[46px] p-[3px]",
    thumb: "h-[18px] w-[22px] data-[state=checked]:translate-x-[18px]",
  },
  md: { root: "h-[30px] w-[62px] p-1", thumb: "h-6 w-8 data-[state=checked]:translate-x-[22px]" },
  lg: {
    root: "h-9 w-[74px] p-[5px]",
    thumb: "h-7 w-[34px] data-[state=checked]:translate-x-[30px]",
  },
} as const;

export interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  /** @default "sm" */
  size?: keyof typeof sizes;
}

/** `role="switch"` on Radix Switch: off track `fill-2`, on track the tint. */
function Switch({ size = "sm", className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "bg-fill-2 ease-out-facet relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150",
        "data-[state=checked]:bg-tint",
        focusRing,
        hitSlop,
        "disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size].root,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "ease-out-facet pointer-events-none block rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2),0_1px_1px_rgb(0_0_0/0.1)] transition-transform duration-150 motion-reduce:transition-none",
          sizes[size].thumb
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
