"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "~/lib/utils/cn";
import { SurfaceReset } from "~/components/ui/card";
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

/**
 * Positions the popover against an element other than its trigger (e.g. a button whose own click
 * must not toggle the popover). The popover opens from `open`/`onOpenChange` state.
 */
function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

/**
 * Anything a popover can be anchored to without a React element: a DOM element (a link found by
 * event delegation), a `Range` (a text selection), a fixed `DOMRect`, or any object with
 * `getBoundingClientRect()` (floating-ui's virtual element; `contextElement` lets it follow scroll
 * containers).
 */
export type VirtualAnchor =
  Element | Range | DOMRect | { getBoundingClientRect(): DOMRect; contextElement?: Element };

type Measurable = { getBoundingClientRect(): DOMRect; contextElement?: Element };

function isRange(anchor: VirtualAnchor): anchor is Range {
  return typeof Range !== "undefined" && anchor instanceof Range;
}

function isDomRect(anchor: VirtualAnchor): anchor is DOMRect {
  return !("getBoundingClientRect" in anchor) && "width" in anchor && "top" in anchor;
}

/** Turns a `VirtualAnchor` into what Radix/floating-ui measure. Ranges and elements stay live. */
export function toMeasurable(anchor: VirtualAnchor): Measurable {
  if (isRange(anchor)) {
    const node = anchor.commonAncestorContainer;
    return {
      getBoundingClientRect: () => anchor.getBoundingClientRect(),
      contextElement: node instanceof Element ? node : (node.parentElement ?? undefined),
    };
  }
  if (isDomRect(anchor)) return { getBoundingClientRect: () => anchor };
  return anchor;
}

/**
 * Positions the popover against a `VirtualAnchor` — a text selection, a DOM element found by event
 * delegation, a rect — instead of a React element (Radix's `virtualRef`). Renders nothing.
 */
function PopoverVirtualAnchor({ anchor }: { anchor: VirtualAnchor }) {
  const measurable = React.useMemo(() => toMeasurable(anchor), [anchor]);
  const virtualRef = React.useRef<Measurable | null>(measurable);
  virtualRef.current = measurable;
  return <PopoverPrimitive.Anchor data-slot="popover-virtual-anchor" virtualRef={virtualRef} />;
}

/** Surfaces for `VirtualAnchorPopover`: menus/toolbars, hover cards/tooltips, or bare. */
const VIRTUAL_SURFACES = {
  /** Floating chrome — toolbars, menus, pickers (like `PopoverContent`). */
  material: "facet-overlay text-label rounded-card p-4",
  /** Hover cards and previews (like `HoverCardContent`). */
  elevated: "facet-overlay text-label rounded-card p-4",
  /** No surface: the children draw their own. */
  none: "",
} as const;

type VirtualAnchorPopoverSurface = keyof typeof VIRTUAL_SURFACES;

export interface VirtualAnchorPopoverProps extends Omit<
  React.ComponentProps<typeof PopoverPrimitive.Content>,
  "asChild" | "forceMount"
> {
  /** What the popover points at; `null` closes it. */
  anchor: VirtualAnchor | null;
  /** Default: open whenever there is an anchor. */
  open?: boolean;
  /** Called with `false` on Escape, an outside press or focus moving outside. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Move focus into the popover when it opens. Default `false`: a selection toolbar must not
   * collapse the selection and a hover card must not steal focus from the page.
   */
  autoFocus?: boolean;
  /** @default "material" */
  surface?: VirtualAnchorPopoverSurface;
}

/**
 * A non-modal `Popover` anchored to a `VirtualAnchor`: text-selection toolbars, hover
 * cards for links found by delegation, citation previews. Radix positions it (side/align/offset,
 * collision flip and shift, follows scroll), dismisses it on Escape/outside press, and animates it;
 * no `createPortal` or hand-computed coordinates in feature code.
 *
 * Focus stays where it is on open and close unless `autoFocus`. Pass `role` for the content
 * (`"toolbar"`, `"tooltip"`); it is a `dialog` otherwise.
 *
 * ```tsx
 * <VirtualAnchorPopover anchor={range} onOpenChange={(o) => !o && clear()} side="top" role="toolbar">
 *   …
 * </VirtualAnchorPopover>
 * ```
 */
function VirtualAnchorPopover({
  anchor,
  open,
  onOpenChange,
  autoFocus = false,
  surface = "material",
  className,
  align = "center",
  sideOffset = 8,
  collisionPadding = 8,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
  ...props
}: VirtualAnchorPopoverProps) {
  const isOpen = (open ?? true) && anchor !== null;
  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      {anchor && <PopoverVirtualAnchor anchor={anchor} />}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="virtual-anchor-popover"
          data-surface={surface}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          onOpenAutoFocus={(event) => {
            onOpenAutoFocus?.(event);
            if (!autoFocus) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            // There is no trigger to return focus to.
            if (!autoFocus) event.preventDefault();
          }}
          className={cn(
            "z-popover pointer-events-auto max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) outline-none",
            VIRTUAL_SURFACES[surface],
            presentMotionClassName,
            className
          )}
          {...props}
        >
          <SurfaceReset>{children}</SurfaceReset>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
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
          "z-popover rounded-card pointer-events-auto max-h-(--radix-popover-content-available-height) w-72 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain p-4 outline-none",
          // Floating chrome paints the overlay layer; Cards inside reset to panes.
          "facet-overlay text-label",
          // Origin-aware scale .96 + fade in, 120ms out.
          presentMotionClassName,
          className
        )}
        {...props}
      >
        <SurfaceReset>{children}</SurfaceReset>
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

export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverVirtualAnchor,
  VirtualAnchorPopover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
