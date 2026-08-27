"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger
      data-cuelume-hover="tick"
      data-slot="hover-card-trigger"
      {...props}
    />
  );
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
  React.useEffect(() => {
    soundEffects.whisper();
  }, []);
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground border-border/50 z-[100050] w-64 rounded-xl border p-4 shadow-lg outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

const HoverCardArrow = HoverCardPrimitive.Arrow;

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardPortal, HoverCardArrow };
