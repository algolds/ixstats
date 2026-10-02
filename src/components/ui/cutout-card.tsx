"use client";

/**
 * CutoutCard: the feature/media card (28px, `rounded-cutout`) with the inverted-corner notch
 * (`CutoutCorner`, `CutoutCardHeader`), media that zooms on hover, a blur-in stagger for its text
 * and a hover-revealed action region. Dense UI (lists, tables, forms) uses `Card`.
 *
 * ```tsx
 * <CutoutCard variant="card" onClick={open} aria-label="Open the Vault">
 *   <CutoutCardHeader icon={<Wallet />}>Vault</CutoutCardHeader>
 *   <CutoutCardMedia className="aspect-video">
 *     <CutoutCardImage src={cover} alt="" />
 *   </CutoutCardMedia>
 * </CutoutCard>
 * ```
 *
 * Reduce Motion safe; with `onClick` it is a keyboard-operable button.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useControllableState } from "~/hooks/useControllableState";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { cn } from "~/lib/utils/cn";
import { EASE_OUT_FACET, springGentle, tweenFast } from "~/lib/design/motion";

// ============================================================================
// Tokens — the card chrome
// ============================================================================

export const cutoutCardSurfaceShadowClassName =
  "border border-separator shadow-(--cutout-shadow) hover:shadow-(--cutout-shadow-hover) [--facet-lift-shadow:var(--cutout-shadow-hover)]";

export const cutoutCardSurfaceClassName = cn(
  "group/cutout bg-surface text-label rounded-cutout relative overflow-hidden",
  cutoutCardSurfaceShadowClassName
);

export const cutoutCardGlassClassName =
  "group/cutout material-hero text-label rounded-cutout relative overflow-hidden";

export type CutoutCardVariant = "card" | "glass";

const VARIANT_CLASS: Record<CutoutCardVariant, string> = {
  card: cutoutCardSurfaceClassName,
  glass: cutoutCardGlassClassName,
};

/** Blur-in rise for staggered text; a 150ms cross-fade under Reduce Motion. */
export function useCutoutContentStaggerVariants() {
  const reduceMotion = useReducedMotion();

  return useMemo(() => {
    if (reduceMotion) {
      return {
        container: {
          hidden: {},
          show: { transition: { staggerChildren: 0.03, delayChildren: 0 } },
        },
        item: {
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: tweenFast },
        },
      } satisfies Record<string, Variants>;
    }

    return {
      container: {
        hidden: {},
        show: { transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
      },
      item: {
        hidden: { opacity: 0, y: 12, filter: "blur(5px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: springGentle },
      },
    } satisfies Record<string, Variants>;
  }, [reduceMotion]);
}

const CORNER_PATH = "M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z";

// ============================================================================
// Context
// ============================================================================

export interface CutoutCardContextValue {
  hovered: boolean;
  setHovered: (next: boolean) => void;
}

const CutoutCardContext = createContext<CutoutCardContextValue | null>(null);

export function useCutoutCard() {
  const ctx = useContext(CutoutCardContext);
  if (!ctx) {
    throw new Error("useCutoutCard must be used within <CutoutCard>");
  }
  return ctx;
}

export function useOptionalCutoutCard() {
  return useContext(CutoutCardContext);
}

// ============================================================================
// Root
// ============================================================================

export type CutoutCardProps = Omit<ComponentProps<typeof motion.div>, "defaultValue"> & {
  /** `card` is the opaque cutout surface, `glass` the hero glass. Omit to style it yourself. */
  variant?: CutoutCardVariant;
  /**
   * Interactive without being a button (e.g. it holds a stretched link): lifts on hover. A card with
   * `onClick` is a button (focusable, Enter/Space) and also presses.
   */
  interactive?: boolean;
  /** When set, hover state is controlled by the parent. */
  hovered?: boolean;
  /** Initial hover state when uncontrolled. */
  defaultHovered?: boolean;
  /** Called when pointer hover changes (after internal state updates). */
  onHoveredChange?: (hovered: boolean) => void;
  /**
   * When true (default), pointer enter/leave on the root update hover state (and keyboard focus
   * within reveals hover-only actions). Set false if you only drive hover programmatically.
   */
  trackPointerHover?: boolean;
  children?: ReactNode;
};

export function CutoutCard({
  className,
  variant,
  interactive = false,
  hovered: hoveredProp,
  defaultHovered = false,
  onHoveredChange,
  trackPointerHover = true,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
  children,
  ...props
}: CutoutCardProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useControllableState({
    prop: hoveredProp,
    defaultProp: defaultHovered,
    onChange: onHoveredChange,
  });

  const setHoveredStable = useCallback(
    (next: boolean) => {
      setHovered(next);
    },
    [setHovered]
  );

  const ctx = useMemo<CutoutCardContextValue>(
    () => ({
      hovered: hovered ?? false,
      setHovered: setHoveredStable,
    }),
    [hovered, setHoveredStable]
  );

  const pressable = Boolean(onClick);
  const lifts = pressable || interactive;

  const handleMouseEnter: MouseEventHandler<HTMLDivElement> = (e) => {
    onMouseEnter?.(e);
    if (e.defaultPrevented || !trackPointerHover) return;
    setHoveredStable(true);
  };

  const handleMouseLeave: MouseEventHandler<HTMLDivElement> = (e) => {
    onMouseLeave?.(e);
    if (e.defaultPrevented || !trackPointerHover) return;
    setHoveredStable(false);
  };

  // Keyboard users reach hover-only actions too: focus inside the card counts as hover.
  const handleFocus: ComponentProps<typeof motion.div>["onFocus"] = (e) => {
    onFocus?.(e);
    if (trackPointerHover) setHoveredStable(true);
  };
  const handleBlur: ComponentProps<typeof motion.div>["onBlur"] = (e) => {
    onBlur?.(e);
    if (!trackPointerHover) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoveredStable(false);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    onKeyDown?.(e);
    if (!pressable || e.defaultPrevented || e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <CutoutCardContext.Provider value={ctx}>
      <motion.div
        animate={{ opacity: 1 }}
        className={cn(
          "relative",
          variant && VARIANT_CLASS[variant],
          lifts && "facet-lift",
          pressable &&
            "facet-press focus-visible:outline-tint cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11",
          className
        )}
        data-slot="cutout-card"
        data-state={ctx.hovered ? "hovered" : "idle"}
        initial={{ opacity: 0 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...(pressable ? { role: "button", tabIndex: 0 } : {})}
        transition={reduceMotion ? tweenFast : { duration: 0.36, ease: EASE_OUT_FACET }}
        {...props}
      >
        {children}
      </motion.div>
    </CutoutCardContext.Provider>
  );
}

// ============================================================================
// Layout primitives
// ============================================================================

export type CutoutCardMediaProps = HTMLAttributes<HTMLDivElement>;

export function CutoutCardMedia({ className, ...props }: CutoutCardMediaProps) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      data-slot="cutout-card-media"
      {...props}
    />
  );
}

export type CutoutCardImageProps = ComponentProps<typeof Image>;

/**
 * Uses `fill` by default; parent `CutoutCardMedia` should be `relative` with a defined block size.
 * Zooms to 105% over 700ms while the card is hovered (v2); still under Reduce Motion.
 */
export function CutoutCardImage({
  className,
  alt = "",
  fill = true,
  sizes = "(max-width: 768px) 100vw, 28rem",
  ...props
}: CutoutCardImageProps) {
  return (
    <Image
      alt={alt}
      className={cn(
        "ease-out-facet object-cover transition-[scale] duration-700 group-hover/cutout:scale-105 motion-reduce:transition-none motion-reduce:group-hover/cutout:scale-100",
        fill && "h-full w-full",
        className
      )}
      data-slot="cutout-card-image"
      {...props}
      fill={fill}
      sizes={fill ? sizes : undefined}
    />
  );
}

export type CutoutCardOverlayProps = HTMLAttributes<HTMLDivElement>;

export function CutoutCardOverlay({ className, ...props }: CutoutCardOverlayProps) {
  return (
    <div
      className={cn("bg-fill-4 pointer-events-none absolute inset-0", className)}
      data-slot="cutout-card-overlay"
      {...props}
    />
  );
}

export type CutoutCardContentProps = HTMLAttributes<HTMLDivElement>;

export function CutoutCardContent({ className, ...props }: CutoutCardContentProps) {
  return (
    <div className={cn("relative p-6", className)} data-slot="cutout-card-content" {...props} />
  );
}

export type CutoutCardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CutoutCardFooter({ className, ...props }: CutoutCardFooterProps) {
  return (
    <div
      className={cn("relative flex items-center justify-between", className)}
      data-slot="cutout-card-footer"
      {...props}
    />
  );
}

export type CutoutCardStaggerProps = ComponentProps<typeof motion.div>;

/**
 * The v2 blur-in stagger container: its `CutoutCardStaggerItem` children rise and sharpen one after
 * another when the card mounts (a fade under Reduce Motion). Pads like `CutoutCardContent`.
 */
export function CutoutCardStagger({ className, ...props }: CutoutCardStaggerProps) {
  const variants = useCutoutContentStaggerVariants();
  return (
    <motion.div
      className={cn("relative p-6", className)}
      data-slot="cutout-card-stagger"
      variants={variants.container}
      initial="hidden"
      animate="show"
      {...props}
    />
  );
}

export type CutoutCardStaggerItemProps = ComponentProps<typeof motion.div>;

export function CutoutCardStaggerItem(props: CutoutCardStaggerItemProps) {
  const variants = useCutoutContentStaggerVariants();
  return <motion.div data-slot="cutout-card-stagger-item" variants={variants.item} {...props} />;
}

// ============================================================================
// Cutout geometry
// ============================================================================

export type CutoutCornerProps = ComponentProps<"svg"> & {
  /** Pixel width/height of the SVG viewBox (square). */
  size?: number;
};

/**
 * The inverted-corner notch: a concave fillet painted in `currentColor`. Colour it with the
 * surface it continues (`text-surface` on a `card` cutout) and place it where a tab, label or pin
 * meets the card edge; mirror with `-scale-x-100` / `-scale-y-100`.
 */
export function CutoutCorner({
  className,
  size = 32,
  viewBox = "0 0 200 200",
  ...props
}: CutoutCornerProps) {
  return (
    <svg
      aria-hidden
      className={cn(className)}
      data-slot="cutout-corner"
      height={size}
      viewBox={viewBox}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d={CORNER_PATH} fill="currentColor" />
    </svg>
  );
}

/** Elements the `CutoutCardHeader` title can render as. */
export type CutoutCardHeaderTitleElement = "span" | "div" | "h2" | "h3" | "h4";

export interface CutoutCardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading glyph in the app tint, 16px. */
  icon?: ReactNode;
  /** Trailing content (a count `Badge`, a link). Never inside the heading. */
  trailing?: ReactNode;
  /** Corner notch size in px. @default 20 */
  cornerSize?: number;
  /**
   * The title element. Pass the heading level the card sits at (`"h2"`–`"h4"`) so the widget title
   * is in the document outline (instead of a `role="heading"` span); the leading icon and
   * `trailing` stay outside the heading. @default "span"
   */
  as?: CutoutCardHeaderTitleElement;
}

/**
 * The cutout tab header: a tinted strip whose bottom corners curve into the card body with
 * `CutoutCorner` notches in the card's surface colour. Use on `variant="card"` cards; `as="h3"`
 * makes the title a heading.
 */
export function CutoutCardHeader({
  icon,
  trailing,
  cornerSize = 20,
  as: Title = "span",
  className,
  children,
  ...props
}: CutoutCardHeaderProps) {
  return (
    <div
      data-slot="cutout-card-header"
      className={cn("bg-tint-fill relative px-4 pt-3 pb-5", className)}
      {...props}
    >
      <div className="text-headline text-label flex items-center gap-2">
        {icon != null && (
          <span aria-hidden className="text-tint inline-flex shrink-0 [:where(&)_svg]:size-4">
            {icon}
          </span>
        )}
        <Title data-slot="cutout-card-title" className="min-w-0 flex-1 truncate">
          {children}
        </Title>
        {trailing}
      </div>
      <CutoutCorner className="text-surface absolute -bottom-px left-0" size={cornerSize} />
      <CutoutCorner
        className="text-surface absolute right-0 -bottom-px -scale-x-100"
        size={cornerSize}
      />
    </div>
  );
}

export type CutoutCardInsetLabelProps = HTMLAttributes<HTMLDivElement>;

/** Absolutely positioned strip (e.g. bottom-left “Featured”); add corners as siblings inside. Static (no entrance motion) to avoid compositing seams next to the media edge. */
export function CutoutCardInsetLabel({ className, ...props }: CutoutCardInsetLabelProps) {
  return (
    <div className={cn("absolute", className)} data-slot="cutout-card-inset-label" {...props} />
  );
}

export type CutoutCardPinProps = HTMLAttributes<HTMLDivElement>;

/** Corner badge shell (e.g. top-right “New”); add corners as siblings inside. Static (no entrance motion). */
export function CutoutCardPin({ className, ...props }: CutoutCardPinProps) {
  return <div className={cn("absolute", className)} data-slot="cutout-card-pin" {...props} />;
}

// ============================================================================
// Context-sensitive action region
// ============================================================================

export type CutoutCardActionProps = ComponentProps<typeof motion.div> & {
  /**
   * When true (default), visibility follows card hover (or focus within) from context.
   * Set false to always show the region.
   */
  revealOnHover?: boolean;
};

export function CutoutCardAction({
  className,
  revealOnHover = true,
  ...props
}: CutoutCardActionProps) {
  const { hovered } = useCutoutCard();
  const reduceMotion = useReducedMotion();
  const visible = !revealOnHover || hovered;

  return (
    <motion.div
      animate={
        reduceMotion
          ? { opacity: visible ? 1 : 0 }
          : visible
            ? { opacity: 1, transform: "translateY(0px)" }
            : { opacity: 0, transform: "translateY(8px)" }
      }
      className={cn("absolute", revealOnHover && !visible && "pointer-events-none", className)}
      data-reveal={revealOnHover ? "hover" : "always"}
      data-slot="cutout-card-action"
      transition={reduceMotion ? tweenFast : springGentle}
      {...props}
    />
  );
}
