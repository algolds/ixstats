"use client";

import React, { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

// Facet design variants matching the dashboard and indicators
export type FacetVariant =
  | "base"
  | "mycountry"
  | "global"
  | "overview"
  | "economy"
  | "military"
  | "cultural"
  | "security"
  | "forum"
  | "builder";

// Volumetric Z-depth levels for layering
export type FacetDepth = 1 | 2 | 3 | 4;

// Interactivity profiles
export type FacetInteractivity = "none" | "hover" | "click" | "focus";

interface FacetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FacetVariant;
  depth?: FacetDepth;
  interactive?: FacetInteractivity;
  enableRefraction?: boolean;
  adaptToBackground?: boolean;
  onDepthChange?: (depth: FacetDepth) => void;
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
    const [currentDepth, setCurrentDepth] = useState<FacetDepth>(depth);
    const [isInteracting, setIsInteracting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [backgroundAdaptation, setBackgroundAdaptation] = useState("");

    // Adapt depth and sheen styling dynamically based on surrounding parent colors
    useEffect(() => {
      if (!adaptToBackground || !containerRef.current) return;

      const updateBackgroundAdaptation = () => {
        const element = containerRef.current;
        if (!element) return;

        const computedStyle = window.getComputedStyle(element.parentElement || element);
        const bgColor = computedStyle.backgroundColor;

        // Visual luminance heuristic to balance contrast dynamically
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const brightness =
            (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
          setBackgroundAdaptation(brightness < 128 ? "dark" : "light");
        }
      };

      updateBackgroundAdaptation();
      const observer = new MutationObserver(updateBackgroundAdaptation);

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return () => observer.disconnect();
    }, [adaptToBackground]);

    // Track active depth state changes
    useEffect(() => {
      if (currentDepth !== depth) {
        setCurrentDepth(depth);
        onDepthChange?.(depth);
      }
    }, [depth, currentDepth, onDepthChange]);

    // Handle user interaction spring responses
    const handleInteractionStart = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(true);

      if (interactive === "hover" || interactive === "focus") {
        const newDepth = Math.min(4, currentDepth + 1) as FacetDepth;
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
        setCurrentDepth(depth);
        onDepthChange?.(depth);
      }

      if (event.type === "mouseleave" && onMouseLeave) {
        onMouseLeave(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === "blur" && onBlur) {
        onBlur(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleClick = (event: React.MouseEvent) => {
      if (interactive === "click") {
        const newDepth = currentDepth === 4 ? 1 : (Math.min(4, currentDepth + 1) as FacetDepth);
        setCurrentDepth(newDepth);
        onDepthChange?.(newDepth);
      }

      onClick?.(event as React.MouseEvent<HTMLDivElement>);
    };

    // Construct class lists mapped to new Facet style selectors
    const facetClasses = cn(
      `facet-depth-${currentDepth}`,
      variant !== "base" && `facet-${variant}`,
      enableRefraction && "facet-refraction",
      interactive !== "none" && "facet-interactive",
      adaptToBackground && backgroundAdaptation && `facet-adapt-${backgroundAdaptation}`,
      isInteracting && "facet-interacting",
      className
    );

    const isInteractiveElement = interactive !== "none";

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
        onMouseEnter={isInteractiveElement ? handleInteractionStart : onMouseEnter}
        onMouseLeave={isInteractiveElement ? handleInteractionEnd : onMouseLeave}
        onFocus={isInteractiveElement ? handleInteractionStart : onFocus}
        onBlur={isInteractiveElement ? handleInteractionEnd : onBlur}
        onClick={handleClick}
        tabIndex={isInteractiveElement ? 0 : undefined}
        role={isInteractiveElement ? "button" : undefined}
        style={
          {
            ...props.style,
            "--facet-depth": currentDepth,
            "--facet-interacting": isInteracting ? "1" : "0",
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    );
  }
);

FacetContainer.displayName = "FacetContainer";

// Hook for managing depth physics state programmatically
export function useFacetDepth(initialDepth: FacetDepth = 2) {
  const [depth, setDepth] = useState<FacetDepth>(initialDepth);

  const increaseDepth = () => {
    setDepth((prev) => Math.min(4, prev + 1) as FacetDepth);
  };

  const decreaseDepth = () => {
    setDepth((prev) => Math.max(1, prev - 1) as FacetDepth);
  };

  const resetDepth = () => {
    setDepth(initialDepth);
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
  (props, ref) => (
    <FacetContainer
      ref={ref}
      variant="base"
      depth={1}
      interactive="hover"
      enableRefraction={false}
      {...props}
    />
  )
);
FacetCard.displayName = "FacetCard";

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
