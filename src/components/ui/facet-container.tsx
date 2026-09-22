"use client";

import React, { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { TextureOverlay, type TextureType } from "./texture-overlay";

// Facet design variants matching the dashboard and indicators
export type FacetVariant =
  | "base"
  | "frosted"
  | "smoked"
  | "subtle"
  | "tactile"
  | "luminous"
  | "solid"
  | "glass"
  | "wiki"
  | "cards"
  | "messages"
  | "security"
  | "forum"
  | "builder"
  | "overview"
  | "economy"
  | "military"
  | "cultural";

// Volumetric Z-depth levels for layering
export type FacetDepth = 1 | 2 | 3 | 4 | "flat" | "base" | "elevated" | "modal" | "interactive";

export function normalizeFacetDepth(d: FacetDepth | undefined): 1 | 2 | 3 | 4 {
  if (typeof d === "number") return d;
  switch (d) {
    case "flat":
    case "base":
      return 1;
    case "elevated":
    case "interactive":
      return 2;
    case "modal":
      return 3;
    default:
      return 2;
  }
}

const themeStyles: Record<string, string> = {
  gold: "text-amber-400 border-amber-500/25",
  blue: "text-blue-400 border-blue-500/25",
  indigo: "text-indigo-400 border-indigo-500/25",
  red: "text-red-400 border-red-500/25",
  emerald: "text-emerald-400 border-emerald-500/25",
  cyan: "text-cyan-400 border-cyan-500/25",
  teal: "text-cyan-400 border-cyan-500/25",
  neutral: "text-foreground border-border/20",
};

const blurStyles: Record<string, string> = {
  none: "",
  light: "backdrop-blur-sm",
  medium: "backdrop-blur-md",
  heavy: "backdrop-blur-lg",
};

// Interactivity profiles
export type FacetInteractivity = "none" | "hover" | "click" | "focus";

export interface FacetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FacetVariant;
  depth?: FacetDepth;
  interactive?: FacetInteractivity;
  enableRefraction?: boolean;
  adaptToBackground?: boolean;
  onDepthChange?: (depth: 1 | 2 | 3 | 4) => void;
  texture?: TextureType;
  textureOpacity?: number;
  theme?: "gold" | "blue" | "indigo" | "red" | "emerald" | "teal" | "neutral" | string;
  motionPreset?: "slide" | "fade" | "scale" | "none" | string;
  blur?: "none" | "light" | "medium" | "heavy" | string;
  gradient?: "none" | "subtle" | "dynamic" | string;
  hover?: boolean;
  children: React.ReactNode;
}

export const FacetContainer = forwardRef<HTMLDivElement, FacetContainerProps>(
  (
    {
      variant = "base",
      depth = 2,
      interactive = "none",
      enableRefraction = true,
      adaptToBackground = false,
      onDepthChange,
      texture,
      textureOpacity,
      theme,
      motionPreset: _motionPreset,
      blur,
      gradient: _gradient,
      hover: _hover,
      className,
      children,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onClick,
      ...props
    },
    ref
  ) => {
    const initialDepth = normalizeFacetDepth(depth);
    const [currentDepth, setCurrentDepth] = useState<1 | 2 | 3 | 4>(initialDepth);
    const [isInteracting, setIsInteracting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track active depth state changes
    useEffect(() => {
      const normalized = normalizeFacetDepth(depth);
      if (currentDepth !== normalized) {
        setCurrentDepth(normalized);
        onDepthChange?.(normalized);
      }
    }, [depth, currentDepth, onDepthChange]);

    // Handle user interaction spring responses
    const handleInteractionStart = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(true);

      if (interactive === "hover" || interactive === "focus") {
        const newDepth = Math.min(4, currentDepth + 1) as 1 | 2 | 3 | 4;
        setCurrentDepth(newDepth);
        onDepthChange?.(newDepth);
      }

      if (event.type === "mouseenter" && onMouseEnter) {
        onMouseEnter(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === "focus" && onFocus) {
        onFocus(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleInteractionEnd = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(false);

      if (interactive === "hover" || interactive === "focus") {
        const normalized = normalizeFacetDepth(depth);
        setCurrentDepth(normalized);
        onDepthChange?.(normalized);
      }

      if (event.type === "mouseleave" && onMouseLeave) {
        onMouseLeave(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === "blur" && onBlur) {
        onBlur(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleClick = (event: React.MouseEvent) => {
      if (interactive === "click") {
        const newDepth = currentDepth === 4 ? 1 : ((Math.min(4, currentDepth + 1)) as 1 | 2 | 3 | 4);
        setCurrentDepth(newDepth);
        onDepthChange?.(newDepth);
      }

      onClick?.(event as React.MouseEvent<HTMLDivElement>);
    };

    // Construct class lists mapped to new Facet style selectors
    const themeClass = theme && themeStyles[theme] ? themeStyles[theme] : "";
    const blurClass = blur && blurStyles[blur] ? blurStyles[blur] : "";
    const isClickable = interactive === "click" || Boolean(onClick);
    const hasInteractionState = interactive !== "none" || Boolean(onClick);
    const facetClasses = cn(
      "facet-container relative",
      `facet-${variant}`,
      `facet-depth-${currentDepth}`,
      isClickable && "facet-interactive cursor-pointer active:scale-[0.98] transition-all duration-150",
      enableRefraction && "facet-refract",
      adaptToBackground && "facet-adapt",
      themeClass,
      blurClass,
      className
    );

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={facetClasses}
        onMouseEnter={hasInteractionState ? handleInteractionStart : onMouseEnter}
        onMouseLeave={hasInteractionState ? handleInteractionEnd : onMouseLeave}
        onFocus={hasInteractionState ? handleInteractionStart : onFocus}
        onBlur={hasInteractionState ? handleInteractionEnd : onBlur}
        onClick={handleClick}
        tabIndex={isClickable ? 0 : undefined}
        role={isClickable ? "button" : undefined}
        style={
          {
            ...props.style,
            "--facet-depth": currentDepth,
            "--facet-interacting": isInteracting ? "1" : "0",
          } as React.CSSProperties
        }
        {...props}
      >
        {texture && texture !== "none" && (
          <TextureOverlay texture={texture} opacity={textureOpacity ?? 0.05} />
        )}
        {children}
      </div>
    );
  }
);

FacetContainer.displayName = "FacetContainer";

// Hook for managing depth physics state programmatically
export function useFacetDepth(initialDepth: FacetDepth = 2) {
  const [depth, setDepth] = useState<1 | 2 | 3 | 4>(normalizeFacetDepth(initialDepth));

  const increaseDepth = () => {
    setDepth((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
  };

  const decreaseDepth = () => {
    setDepth((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
  };

  const resetDepth = () => {
    setDepth(normalizeFacetDepth(initialDepth));
  };

  return {
    depth,
    setDepth,
    increaseDepth,
    decreaseDepth,
    resetDepth,
  };
}

// Specialized Facet Cards, Modals, and Navigation frames
export const FacetCard = forwardRef<HTMLDivElement, Omit<FacetContainerProps, "variant">>(
  ({ interactive = "none", ...props }, ref) => (
    <FacetContainer
      ref={ref}
      variant="base"
      depth={1}
      interactive={interactive}
      enableRefraction={false}
      {...props}
    />
  )
);
FacetCard.displayName = "FacetCard";

export const FacetCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex flex-col gap-1.5 p-6", className)} {...props} />
  )
);
FacetCardHeader.displayName = "FacetCardHeader";

export const FacetCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10", className)} {...props} />
  )
);
FacetCardContent.displayName = "FacetCardContent";

export const FacetCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex items-center p-6 pt-0", className)} {...props} />
  )
);
FacetCardFooter.displayName = "FacetCardFooter";

export const FacetModal = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth">
>((props, ref) => (
  <FacetContainer
    ref={ref}
    variant="base"
    depth={4}
    interactive="none"
    enableRefraction={true}
    {...props}
  />
));
FacetModal.displayName = "FacetModal";

export const FacetNavigation = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth">
>((props, ref) => (
  <FacetContainer
    ref={ref}
    variant="base"
    depth={3}
    interactive="focus"
    enableRefraction={true}
    adaptToBackground={true}
    {...props}
  />
));
FacetNavigation.displayName = "FacetNavigation";

// ──────────────────────────────────────────────────────────────────────────
/* BACKWARDS COMPATIBILITY LAYER EXPORTS */
// ──────────────────────────────────────────────────────────────────────────

/** @deprecated Use FacetContainer instead */
export const GlassContainer = FacetContainer;

/** @deprecated Use FacetCard instead */
export const GlassCard = FacetCard;

/** @deprecated Use FacetCardHeader instead */
export const GlassCardHeader = FacetCardHeader;

/** @deprecated Use FacetCardContent instead */
export const GlassCardContent = FacetCardContent;

/** @deprecated Use FacetCardFooter instead */
export const GlassCardFooter = FacetCardFooter;

/** @deprecated Use FacetModal instead */
export const GlassModal = FacetModal;

/** @deprecated Use FacetNavigation instead */
export const GlassNavigation = FacetNavigation;

/** @deprecated Use useFacetDepth instead */
export const useGlassDepth = useFacetDepth;

/** @deprecated Use FacetVariant type */
export type GlassVariant = FacetVariant;

/** @deprecated Use FacetDepth type */
export type GlassDepth = FacetDepth;

/** @deprecated Use FacetInteractivity type */
export type GlassInteractivity = FacetInteractivity;

