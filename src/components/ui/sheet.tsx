"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import { Xmark as X } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { soundCues } from "~/lib/sound/cuelume";
import { springSmooth } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import {
  dismissButtonClassName,
  overlayScrimClassName,
  overlayScrimMotionClassName,
} from "~/components/ui/dialog";

/**
 * Facet 3 Sheet (spec §7.3): tasks, detail views and multi-step flows.
 *
 * - `side` omitted (or `"auto"`): a right side sheet at ≥768px, a bottom sheet with detents below.
 * - `side="top" | "right" | "bottom" | "left"`: that edge at every width (the pre-Facet 3 API).
 *   `side="bottom"` gets detents only when `detents` is passed.
 * - Bottom sheets with detents: `medium` ≈ 50% and `large` ≈ 92% of the viewport height, a grabber
 *   (drag it, or tap it to switch detent), drag down past the lowest detent to dismiss, safe-area
 *   bottom padding. Detent changes use `spring-smooth`; under Reduce Motion the sheet fades and
 *   detents switch instantly (no drag).
 */

type SheetSide = "top" | "right" | "bottom" | "left";
export type SheetDetent = "medium" | "large";

/** Fraction of the viewport height each detent shows. */
export const SHEET_DETENT_HEIGHT: Record<SheetDetent, number> = { medium: 0.5, large: 0.92 };

const DEFAULT_DETENTS: readonly SheetDetent[] = ["medium", "large"];

/** Side sheet at and above this width when `side` is automatic. */
export const SHEET_SIDE_BREAKPOINT_QUERY = "(min-width: 768px)";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>(({ ...props }, ref) => (
  <SheetPrimitive.Close ref={ref} data-cuelume-press="droplet" {...props} />
));
SheetClose.displayName = "SheetClose";

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(overlayScrimClassName, overlayScrimMotionClassName, className)}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetSurface =
  "fixed z-sheet border-separator bg-surface-elevated text-label shadow-sheet outline-none";

const sheetSideClassNames: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 rounded-b-sheet border-b p-6 sheet-from-top",
  bottom:
    "inset-x-0 bottom-0 rounded-t-sheet border-t p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sheet-from-bottom",
  left: "inset-y-0 left-0 h-full w-3/4 border-r p-6 sm:max-w-sm sheet-from-left",
  right: "inset-y-0 right-0 h-full w-3/4 border-l p-6 sm:max-w-sm sheet-from-right",
};

/** Edge slide in (280ms) / out (200ms); a fade under Reduce Motion. */
const sheetMotionClassName =
  "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out";

/** Kept for callers that composed the old variants helper. */
function sheetVariants({ side = "right" }: { side?: SheetSide | null } = {}): string {
  return cn(sheetSurface, sheetSideClassNames[side ?? "right"], sheetMotionClassName);
}

const subscribeToViewport = (onChange: () => void) => {
  const query = window.matchMedia(SHEET_SIDE_BREAKPOINT_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
};

/** True at ≥768px. Server render assumes the side sheet. */
function useIsRegularWidth(): boolean {
  return React.useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(SHEET_SIDE_BREAKPOINT_QUERY).matches,
    () => true
  );
}

/** Keep popovers, menus and selects that portal out of the sheet from dismissing it. */
function isInsideNestedFloatingLayer(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el?.closest?.(
      [
        "[data-radix-popper-content-wrapper]",
        '[data-slot="dropdown-menu-content"]',
        '[role="listbox"]',
        '[data-slot="popover-content"]',
        '[data-slot="popover-positioner"]',
        '[data-slot="select-content"]',
      ].join(",")
    )
  );
}

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  /** Edge to present from; omitted or `"auto"` = right sheet ≥768px, bottom sheet with detents below. */
  side?: SheetSide | "auto" | null;
  /**
   * Bottom-sheet heights (`medium` ≈ 50vh, `large` ≈ 92vh). Default `["medium", "large"]` for the
   * automatic bottom sheet; passing it with `side="bottom"` opts that sheet into detents.
   */
  detents?: SheetDetent[];
  /** Detent to open at (defaults to the first of `detents`). */
  defaultDetent?: SheetDetent;
  /** Called when the user drags or taps the grabber to another detent. */
  onDetentChange?: (detent: SheetDetent) => void;
  /** Render the dismiss (×) button. Default true. */
  showCloseButton?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side,
      detents,
      defaultDetent,
      onDetentChange,
      showCloseButton = true,
      className,
      children,
      onPointerDownOutside,
      onFocusOutside,
      ...props
    },
    ref
  ) => {
    const isRegularWidth = useIsRegularWidth();
    const automatic = side == null || side === "auto";
    const resolvedSide: SheetSide = automatic ? (isRegularWidth ? "right" : "bottom") : side;
    const useDetents =
      resolvedSide === "bottom" && (automatic || (detents !== undefined && detents.length > 0));

    React.useEffect(() => {
      // Optional calls: many tests mock ~/lib/sound/cuelume with only `soundEffects`.
      soundCues?.present?.();
    }, []);

    const closeRef = React.useRef<HTMLButtonElement>(null);

    const sharedProps = {
      ref,
      "data-slot": "sheet-content",
      "data-side": resolvedSide,
      onPointerDownOutside: (e: Parameters<NonNullable<typeof onPointerDownOutside>>[0]) => {
        if (isInsideNestedFloatingLayer(e.target)) e.preventDefault();
        else onPointerDownOutside?.(e);
      },
      onFocusOutside: (e: Parameters<NonNullable<typeof onFocusOutside>>[0]) => {
        if (isInsideNestedFloatingLayer(e.target)) e.preventDefault();
        else onFocusOutside?.(e);
      },
      ...props,
    };

    const closeButton = (
      <SheetPrimitive.Close
        ref={closeRef}
        data-cuelume-press="droplet"
        data-slot="sheet-close"
        className={cn(dismissButtonClassName, !showCloseButton && "hidden")}
      >
        <X />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    );

    return (
      <SheetPortal>
        <SheetOverlay />
        {useDetents ? (
          <SheetPrimitive.Content {...sharedProps} data-presentation="bottom-detent" asChild>
            <DetentSheetBody
              detents={detents && detents.length > 0 ? detents : DEFAULT_DETENTS}
              defaultDetent={defaultDetent}
              onDetentChange={onDetentChange}
              onDismiss={() => {
                soundCues?.dismiss?.();
                closeRef.current?.click();
              }}
              className={className}
              closeButton={closeButton}
            >
              {children}
            </DetentSheetBody>
          </SheetPrimitive.Content>
        ) : (
          <SheetPrimitive.Content
            {...sharedProps}
            data-presentation="side"
            className={cn(sheetVariants({ side: resolvedSide }), className)}
          >
            {children}
            {closeButton}
          </SheetPrimitive.Content>
        )}
      </SheetPortal>
    );
  }
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

interface DetentSheetBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  detents: readonly SheetDetent[];
  defaultDetent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  onDismiss: () => void;
  closeButton: React.ReactNode;
}

function useViewportHeight(): number {
  const [height, setHeight] = React.useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );
  React.useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/**
 * The bottom sheet body. Radix `Content asChild` renders onto this element (focus trap, dismissal,
 * `data-state` for the CSS entrance/exit). The sheet is as tall as its largest detent; smaller
 * detents translate it down, so detent changes and drags only animate `transform`.
 */
const DetentSheetBody = React.forwardRef<HTMLDivElement, DetentSheetBodyProps>(
  (
    {
      detents,
      defaultDetent,
      onDetentChange,
      onDismiss,
      closeButton,
      className,
      children,
      style,
      // Drag handlers would collide with motion's own drag props.
      onDrag: _onDrag,
      onDragStart: _onDragStart,
      onDragEnd: _onDragEnd,
      onAnimationStart: _onAnimationStart,
      ...rest
    },
    ref
  ) => {
    const reducedMotion = useFacetReducedMotion();
    const viewportHeight = useViewportHeight();
    const dragControls = useDragControls();
    const draggedRef = React.useRef(false);

    const ordered = React.useMemo(
      () => [...new Set(detents)].sort((a, b) => SHEET_DETENT_HEIGHT[a] - SHEET_DETENT_HEIGHT[b]),
      [detents]
    );
    const tallest = ordered[ordered.length - 1] ?? "large";
    const [detent, setDetent] = React.useState<SheetDetent>(() =>
      defaultDetent && ordered.includes(defaultDetent) ? defaultDetent : (detents[0] ?? tallest)
    );

    const offsetFor = React.useCallback(
      (d: SheetDetent) =>
        Math.round((SHEET_DETENT_HEIGHT[tallest] - SHEET_DETENT_HEIGHT[d]) * viewportHeight),
      [tallest, viewportHeight]
    );

    const y = useMotionValue(offsetFor(detent));

    const settleTo = React.useCallback(
      (target: SheetDetent) => {
        const to = offsetFor(target);
        if (reducedMotion) y.set(to);
        else void animate(y, to, springSmooth);
      },
      [offsetFor, reducedMotion, y]
    );

    // Follow detent / viewport changes.
    React.useEffect(() => {
      settleTo(detent);
    }, [detent, settleTo]);

    const changeDetent = (next: SheetDetent) => {
      if (next === detent) {
        settleTo(next);
        return;
      }
      setDetent(next);
      onDetentChange?.(next);
    };

    const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const current = y.get();
      const projected = current + info.velocity.y * 0.2;
      const lowest = ordered[0] ?? tallest;
      const dismissAt = offsetFor(lowest) + viewportHeight * 0.15;
      if (projected > dismissAt || (info.velocity.y > 900 && detent === lowest)) {
        onDismiss();
        return;
      }
      const nearest = ordered.reduce((best, d) =>
        Math.abs(offsetFor(d) - projected) < Math.abs(offsetFor(best) - projected) ? d : best
      );
      changeDetent(nearest);
    };

    const canResize = ordered.length > 1;
    const nextDetent = ordered[(ordered.indexOf(detent) + 1) % ordered.length] ?? detent;

    return (
      <motion.div
        ref={ref}
        {...rest}
        data-detent={detent}
        className={cn(
          sheetSurface,
          "inset-x-0 bottom-0 flex flex-col rounded-t-sheet border-t",
          "sheet-from-bottom data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          className
        )}
        style={{ ...style, height: `${SHEET_DETENT_HEIGHT[tallest] * 100}dvh`, y }}
        drag={reducedMotion ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: viewportHeight }}
        dragElastic={{ top: 0.08, bottom: 0.4 }}
        dragMomentum={false}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
      >
        {canResize ? (
          <button
            type="button"
            data-slot="sheet-grabber"
            aria-label={
              SHEET_DETENT_HEIGHT[nextDetent] > SHEET_DETENT_HEIGHT[detent]
                ? "Expand sheet"
                : "Collapse sheet"
            }
            className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-sheet outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint active:cursor-grabbing"
            onPointerDown={(event) => {
              draggedRef.current = false;
              if (!reducedMotion) dragControls.start(event);
            }}
            onClick={() => {
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              changeDetent(nextDetent);
            }}
          >
            <span aria-hidden="true" className="h-1.5 w-9 rounded-full bg-fill" />
          </button>
        ) : (
          <div
            data-slot="sheet-grabber"
            aria-hidden="true"
            className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={(event) => {
              if (!reducedMotion) dragControls.start(event);
            }}
          >
            <span className="h-1.5 w-9 rounded-full bg-fill" />
          </div>
        )}
        <div
          data-slot="sheet-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {children}
        </div>
        {closeButton}
      </motion.div>
    );
  }
);
DetentSheetBody.displayName = "DetentSheetBody";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-title-1 text-label", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-callout text-label-secondary", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  sheetVariants,
};
