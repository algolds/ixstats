"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  render,
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger> & { render?: React.ReactNode }) {
  if (render) {
    return (
      <PopoverPrimitive.Trigger data-slot="popover-trigger" asChild {...props}>
        {render}
      </PopoverPrimitive.Trigger>
    );
  }
  return (
    <PopoverPrimitive.Trigger data-slot="popover-trigger" asChild={asChild} {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

function PopoverPortal({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Portal>) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

/** Compat shim: Radix popover has no backdrop primitive (no consumers use it). */
function PopoverBackdrop(_props: { className?: string; children?: React.ReactNode }) {
  return null;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  React.useEffect(() => {
    soundEffects.whisper();
  }, []);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto z-[100050] max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[var(--radix-popover-content-available-width)] origin-[var(--radix-popover-content-transform-origin)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl p-4 transition-[transform,scale,opacity] duration-150 ease-out outline-none data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100",
          // Default glass styling with contextual depth detection
          !(typeof className === "string" && className.includes("glass-")) &&
            "glass-contextual-popover facet-refraction",
          className
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="popover-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h4">) {
  return (
    <h4
      data-slot="popover-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function PopoverClose({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-cuelume-press="droplet" data-slot="popover-close" {...props} />;
}

const PopoverCLose = PopoverClose;

export {
  Popover,
  PopoverTrigger,
  PopoverBackdrop,
  PopoverPortal,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
  PopoverCLose,
};
