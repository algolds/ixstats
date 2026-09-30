"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "~/lib/utils/cn";
import { presentMotionClassName } from "~/components/ui/dialog";

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

function HoverCardPortal({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Portal>) {
  return <HoverCardPrimitive.Portal data-slot="hover-card-portal" {...props} />;
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-popover w-64 origin-(--radix-hover-card-content-transform-origin) rounded-card border border-separator bg-surface-elevated p-4 text-label shadow-floating outline-none",
          presentMotionClassName,
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

const HoverCardArrow = HoverCardPrimitive.Arrow;

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardPortal, HoverCardArrow };
