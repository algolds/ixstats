"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";

/** True under a TooltipProvider, so a Tooltip joins it and neighbours share the skip delay. */
const HasTooltipProvider = React.createContext(false);

function TooltipProvider({
  delayDuration = 500,
  skipDelayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <HasTooltipProvider.Provider value>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
        {...props}
      />
    </HasTooltipProvider.Provider>
  );
}

/** Radix needs a provider; standalone renders (tests, detached portals) get their own. */
function EnsureTooltipProvider({ children }: { children: React.ReactNode }) {
  const hasProvider = React.useContext(HasTooltipProvider);
  return hasProvider ? children : <TooltipProvider>{children}</TooltipProvider>;
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
      <EnsureTooltipProvider>
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
                <kbd className="rounded-control-sm bg-fill-3 text-caption text-label-secondary pointer-events-none inline-flex h-4 items-center gap-0.5 px-1 select-none">
                  {shortcut}
                </kbd>
              )}
            </div>
          </TooltipContent>
        </TooltipPrimitive.Root>
      </EnsureTooltipProvider>
    );
  }

  return (
    <EnsureTooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props}>
        {children}
      </TooltipPrimitive.Root>
    </EnsureTooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
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
          // A neighbour opened inside the skip delay appears at once, with no pop.
          "data-[state=instant-open]:animate-none",
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
