"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Xmark as XIcon } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { soundCues } from "~/lib/sound/cuelume";

/**
 * The one scrim for modal presentation (Dialog, AlertDialog, Sheet): black at 25% (light) /
 * 40% (dark), no blur; the sheet or dialog above it carries the elevation.
 */
export const overlayScrimClassName = "fixed inset-0 z-backdrop bg-scrim";

/** Scrim fade in/out (Radix waits for the exit animation before unmounting). */
export const overlayScrimMotionClassName =
  "data-[state=open]:animate-facet-fade-in data-[state=closed]:animate-facet-fade-out";

/** Centred pop in (scale .96 + fade, 200ms) and out (`--duration-exit`). */
export const presentMotionClassName =
  "data-[state=open]:animate-facet-in data-[state=closed]:animate-facet-out";

/**
 * Dismiss button for dialogs and sheets: a 28px fill circle with a 44px hit area on touch. It
 * keeps the `droplet` cue.
 */
export const dismissButtonClassName =
  "absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-full bg-fill-3 text-label-secondary transition-colors duration-fast ease-out-facet before:absolute before:-inset-2 hover:bg-fill-2 hover:text-label outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&)_svg]:size-4";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-cuelume-press="droplet" data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(overlayScrimClassName, overlayScrimMotionClassName, className)}
      {...props}
    />
  );
}

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean;
  /**
   * `"animated"` (default): centred scale .96 + fade in 200ms, out in 120ms.
   * `"instant"`: appears and leaves in 0ms with no present cue — for keyboard-invoked UI such as
   * the command palette.
   */
  presentation?: "animated" | "instant";
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  presentation = "animated",
  ...props
}: DialogContentProps) {
  const animated = presentation === "animated";

  // Present cue. Keyboard-invoked, instant presentations (the command palette) stay silent.
  React.useEffect(() => {
    // Optional calls: many tests mock ~/lib/sound/cuelume with only `soundEffects`.
    if (animated) soundCues?.present?.();
  }, [animated]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={animated ? undefined : "animate-none"} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-presentation={presentation}
        className={cn(
          "z-sheet fixed top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 p-6 outline-none",
          !className?.includes("max-w-") && "sm:max-w-lg",
          "rounded-sheet border-separator bg-surface-elevated text-label shadow-sheet border",
          animated && presentMotionClassName,
          className
        )}
        {...props}
        // ponytail: never close on outside click — only the X button or Escape closes.
        // Prevents accidental dismissal; was previously a whitelist of nested popovers.
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-cuelume-press="droplet"
            data-slot="dialog-close"
            className={dismissButtonClassName}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-title-1 text-label", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-callout text-label-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
