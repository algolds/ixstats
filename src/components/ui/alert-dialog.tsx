"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils/cn";
import { buttonVariants } from "~/components/ui/button";
import { soundCues } from "~/lib/sound/cuelume";
import {
  overlayScrimClassName,
  overlayScrimMotionClassName,
  presentMotionClassName,
} from "~/components/ui/dialog";

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-backdrop"
      className={cn(overlayScrimClassName, overlayScrimMotionClassName, className)}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  React.useEffect(() => {
    // Optional calls: many tests mock ~/lib/sound/cuelume with only `soundEffects`.
    soundCues?.present?.();
  }, []);

  return (
    <AlertDialogPortal>
      <AlertDialogBackdrop />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-sheet grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 p-6 outline-none sm:max-w-lg",
          "rounded-sheet border border-separator bg-surface-elevated text-label shadow-sheet",
          presentMotionClassName,
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-title-3 text-label", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-callout text-label-secondary", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  variant = "default",
  onClick,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
  /** Button style; `"destructive"` also plays the destructive-confirm cue. */
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  return (
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(buttonVariants({ variant }), className)}
      onClick={(event) => {
        if (variant === "destructive") soundCues?.destructive?.();
        onClick?.(event);
      }}
      {...props}
    />
  );
}

// Preserves the legacy `AlertDialogClose` export. Radix's Cancel closes the
// dialog, matching the original Base UI Close behaviour.
function AlertDialogClose({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-cuelume-press="droplet"
      data-slot="alert-dialog-close"
      className={cn(buttonVariants({ variant: "secondary" }), className)}
      {...props}
    />
  );
}

const AlertDialogCancel = AlertDialogClose;

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogCancel,
};
