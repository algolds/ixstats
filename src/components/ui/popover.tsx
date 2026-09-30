"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "~/lib/utils/cn";
import { presentMotionClassName } from "~/components/ui/dialog";

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
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-auto z-popover max-h-(--radix-popover-content-available-height) w-72 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-card p-4 outline-none",
          // Floating chrome (spec §5): thick material + floating shadow. Anything inside uses
          // opaque roles — never another material.
          "material-thick text-label shadow-floating",
          // Origin-aware scale .96 + fade in, 120ms out.
          presentMotionClassName,
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
      className={cn("text-headline text-label", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-callout text-label-secondary", className)}
      {...props}
    />
  );
}

function PopoverClose({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return (
    <PopoverPrimitive.Close data-slot="popover-close" {...props} />
  );
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
