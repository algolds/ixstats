"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

interface TooltipProps extends React.ComponentProps<typeof TooltipPrimitive.Root> {
  content?: React.ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  contentClassName?: string;
  /** Keep the tooltip shut (e.g. while its trigger's popover is open). Use this rather than
   *  `open={x ? false : undefined}`, which flips Radix between controlled and uncontrolled. */
  disabled?: boolean;
}

function Tooltip({
  children,
  content,
  shortcut,
  side,
  sideOffset = 4,
  contentClassName,
  disabled,
  open,
  onOpenChange,
  ...rest
}: TooltipProps) {
  const [shown, setShown] = React.useState(false);
  const props =
    disabled === undefined
      ? { ...rest, open, onOpenChange }
      : {
          ...rest,
          open: !disabled && shown,
          onOpenChange: (next: boolean) => {
            setShown(next);
            onOpenChange?.(next);
          },
        };
  // If content is passed as a prop, render full compound structure automatically
  if (content !== undefined) {
    return (
      <TooltipProvider>
        <TooltipPrimitive.Root data-slot="tooltip" {...props}>
          <TooltipPrimitive.Trigger asChild data-slot="tooltip-trigger">
            {typeof children === "string" ? (
              <span>{children}</span>
            ) : (
              (children as React.ReactElement)
            )}
          </TooltipPrimitive.Trigger>
          <TooltipContent side={side} sideOffset={sideOffset} className={contentClassName}>
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && (
                <kbd className="pointer-events-none inline-flex h-4 items-center gap-0.5 rounded-control-sm bg-fill-3 px-1 text-caption text-label-secondary select-none">
                  {shortcut}
                </kbd>
              )}
            </div>
          </TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
  );
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-tooltip rounded-row text-footnote w-fit max-w-sm origin-(--radix-tooltip-content-transform-origin) px-3 py-1 text-balance",
          "facet-overlay text-label",
          // Radix tooltips open with data-state="delayed-open" / "instant-open".
          "animate-facet-in data-[state=closed]:animate-facet-out",
          className
        )}
        {...props}
      >
        <SurfaceReset>{children}</SurfaceReset>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
