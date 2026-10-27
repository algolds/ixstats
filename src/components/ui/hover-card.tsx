"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";
import { presentMotionClassName } from "~/components/ui/dialog";
import { VirtualAnchorPopover, type VirtualAnchorPopoverProps } from "~/components/ui/popover";

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-popover rounded-card facet-overlay text-label w-64 origin-(--radix-hover-card-content-transform-origin) p-4 outline-none",
          presentMotionClassName,
          className
        )}
        {...props}
      >
        <SurfaceReset>{children}</SurfaceReset>
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Portal>
  );
}

const HoverCardArrow = HoverCardPrimitive.Arrow;

type VirtualAnchorHoverCardProps = Omit<VirtualAnchorPopoverProps, "surface">;

/**
 * A hover card anchored to a `VirtualAnchor` (an element found by event delegation, a range, a
 * rect) — for previews whose trigger is not a React element (`HoverCard` needs a
 * `HoverCardTrigger`). Same look as `HoverCardContent`; never takes focus. The caller owns the
 * hover timing: pass `anchor` (or `null`) after its open/close delays and keep it open from the
 * card's own `onMouseEnter`/`onMouseLeave`. No ARIA role unless you pass one.
 */
function VirtualAnchorHoverCard({
  className,
  sideOffset = 4,
  role,
  ...props
}: VirtualAnchorHoverCardProps) {
  return (
    <VirtualAnchorPopover
      sideOffset={sideOffset}
      role={role}
      className={cn("w-64", className)}
      {...props}
    />
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow, VirtualAnchorHoverCard };
