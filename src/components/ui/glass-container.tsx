"use client";

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';

// Glass effect variants matching the dashboard colors
export type GlassVariant = 'base' | 'mycountry' | 'global' | 'eci' | 'sdi';

// Z-depth levels for layered glass effects  
export type GlassDepth = 1 | 2 | 3 | 4;

// Interactivity modes
export type GlassInteractivity = 'none' | 'hover' | 'click' | 'focus';

interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  depth?: GlassDepth;
  interactive?: GlassInteractivity;
  enableRefraction?: boolean;
  adaptToBackground?: boolean;
  onDepthChange?: (depth: GlassDepth) => void;
  children: React.ReactNode;
}

export const GlassContainer = forwardRef<HTMLDivElement, GlassContainerProps>(
  ({
    variant = 'base',
    depth = 2,
    interactive = 'none',
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
  }, ref) => {
    const [currentDepth, setCurrentDepth] = useState<GlassDepth>(depth);
    const [isInteracting, setIsInteracting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [backgroundAdaptation, setBackgroundAdaptation] = useState('');

    // Adapt to background colors if enabled
    useEffect(() => {
      if (!adaptToBackground || !containerRef.current) return;

      const updateBackgroundAdaptation = () => {
        const element = containerRef.current;
        if (!element) return;

        const computedStyle = window.getComputedStyle(element.parentElement || element);
        const bgColor = computedStyle.backgroundColor;
        
        // Simple heuristic to determine if background is dark or light
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
          setBackgroundAdaptation(brightness < 128 ? 'dark' : 'light');
        }
      };

      updateBackgroundAdaptation();
      const observer = new MutationObserver(updateBackgroundAdaptation);
      
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });

      return () => observer.disconnect();
    }, [adaptToBackground]);

    // Handle depth changes
    useEffect(() => {
      if (currentDepth !== depth) {
        setCurrentDepth(depth);
        onDepthChange?.(depth);
      }
    }, [depth, currentDepth, onDepthChange]);

    // Interactive depth changes
    const handleInteractionStart = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(true);
      
      if (interactive === 'hover' || interactive === 'focus') {
        const newDepth = Math.min(4, currentDepth + 1) as GlassDepth;
        setCurrentDepth(newDepth);
        onDepthChange?.(newDepth);
      }

      // Call original handlers
      if (event.type === 'mouseenter' && onMouseEnter) {
        onMouseEnter(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === 'focus' && onFocus) {
        onFocus(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleInteractionEnd = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(false);
      
      if (interactive === 'hover' || interactive === 'focus') {
        setCurrentDepth(depth);
        onDepthChange?.(depth);
      }

      // Call original handlers
      if (event.type === 'mouseleave' && onMouseLeave) {
        onMouseLeave(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === 'blur' && onBlur) {
        onBlur(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleClick = (event: React.MouseEvent) => {
      if (interactive === 'click') {
        const newDepth = currentDepth === 4 ? 1 : Math.min(4, currentDepth + 1) as GlassDepth;
        setCurrentDepth(newDepth);
        onDepthChange?.(newDepth);
      }

      onClick?.(event as React.MouseEvent<HTMLDivElement>);
    };

    // Build class names
    const glassClasses = cn(
      // Base glass effect
      `glass-depth-${currentDepth}`,
      
      // Variant-specific colors
      variant !== 'base' && `glass-${variant}`,
      
      // Refraction effects
      enableRefraction && 'glass-refraction',
      
      // Interactive states
      interactive !== 'none' && 'glass-interactive',
      
      // Background adaptation
      adaptToBackground && backgroundAdaptation && `glass-adapt-${backgroundAdaptation}`,
      
      // Interaction state
      isInteracting && 'glass-interacting',
      
      // User provided classes
      className
    );

    // Determine if element should be interactive
    const isInteractiveElement = interactive !== 'none';

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={glassClasses}
        onMouseEnter={isInteractiveElement ? handleInteractionStart : onMouseEnter}
        onMouseLeave={isInteractiveElement ? handleInteractionEnd : onMouseLeave}
        onFocus={isInteractiveElement ? handleInteractionStart : onFocus}
        onBlur={isInteractiveElement ? handleInteractionEnd : onBlur}
        onClick={handleClick}
        tabIndex={isInteractiveElement ? 0 : undefined}
        role={isInteractiveElement ? 'button' : undefined}
        style={{
          ...props.style,
          '--glass-depth': currentDepth,
          '--glass-interacting': isInteracting ? '1' : '0',
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassContainer.displayName = 'GlassContainer';

// Convenience hook for managing glass depth state
export function useGlassDepth(initialDepth: GlassDepth = 2) {
  const [depth, setDepth] = useState<GlassDepth>(initialDepth);
  
  const increaseDepth = () => {
    setDepth(prev => Math.min(4, prev + 1) as GlassDepth);
  };
  
  const decreaseDepth = () => {
    setDepth(prev => Math.max(1, prev - 1) as GlassDepth);
  };
  
  const resetDepth = () => {
    setDepth(initialDepth);
  };

  return {
    depth,
    setDepth,
    increaseDepth,
    decreaseDepth,
    resetDepth
  };
}

// Specialized glass variants for common use cases
export const GlassCard = forwardRef<HTMLDivElement, Omit<GlassContainerProps, 'variant'>>(
  (props, ref) => (
    <GlassContainer ref={ref} variant="base" depth={1} interactive="hover" {...props} />
  )
);

GlassCard.displayName = 'GlassCard';

export const GlassModal = forwardRef<HTMLDivElement, Omit<GlassContainerProps, 'variant' | 'depth'>>(
  (props, ref) => (
    <GlassContainer 
      ref={ref} 
      variant="base" 
      depth={4} 
      interactive="none" 
      enableRefraction={true}
      {...props} 
    />
  )
);

GlassModal.displayName = 'GlassModal';

export const GlassNavigation = forwardRef<HTMLDivElement, Omit<GlassContainerProps, 'variant' | 'depth'>>(
  (props, ref) => (
    <GlassContainer 
      ref={ref} 
      variant="base" 
      depth={3} 
      interactive="focus" 
      enableRefraction={true}
      adaptToBackground={true}
      {...props} 
    />
  )
);

GlassNavigation.displayName = 'GlassNavigation';