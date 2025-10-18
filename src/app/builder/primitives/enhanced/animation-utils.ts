// Enhanced Animation Utilities for NumberFlow and Smooth Transitions

import { useSpring, useMotionValue, useTransform, MotionValue } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import type { AnimationConfig } from './types';

export type { AnimationConfig };

// Default animation configurations
export const DEFAULT_ANIMATIONS: Record<string, AnimationConfig> = {
  numberFlow: {
    enabled: true,
    duration: 400, // Reduced to 400ms for much faster response
    easing: 'easeOut', // Changed from easeInOut to easeOut for faster start
    delay: 0
  },
  slideIn: {
    enabled: true,
    duration: 500,
    easing: 'easeOut',
    delay: 0
  },
  fadeIn: {
    enabled: true,
    duration: 300,
    easing: 'easeInOut',
    delay: 0
  },
  scale: {
    enabled: true,
    duration: 200,
    easing: 'easeOut',
    delay: 0
  }
};

// Hook for animated number values with smooth transitions
export function useAnimatedValue(
  targetValue: number,
  config?: AnimationConfig
) {
  const safeConfig = config ?? DEFAULT_ANIMATIONS.numberFlow;
  const safeTargetValue = typeof targetValue === 'number' && !isNaN(targetValue) ? targetValue : 0;
  const motionValue = useMotionValue(safeTargetValue);
  
  const animatedValue = useSpring(motionValue, {
    stiffness: safeConfig?.duration ? 1000 / safeConfig.duration : 250, // Much higher stiffness for instant response
    damping: safeConfig?.easing === 'linear' ? 100 : 30, // Increased damping to prevent overshoot
    mass: 0.5, // Very light mass for near-instant movement
  });

  useEffect(() => {
    if (safeConfig?.enabled !== false) {
      const timeout = setTimeout(() => {
        motionValue.set(safeTargetValue);
      }, safeConfig?.delay || 0);
      
      return () => clearTimeout(timeout);
    } else {
      motionValue.set(safeTargetValue);
    }
  }, [safeTargetValue, motionValue, safeConfig?.enabled, safeConfig?.delay]);

  return animatedValue;
}

// Hook for formatting animated numbers with proper localization
export function useFormattedAnimatedValue(
  targetValue: number,
  formatter?: (value: number) => string,
  config?: AnimationConfig
) {
  const safeTargetValue = typeof targetValue === 'number' && !isNaN(targetValue) ? targetValue : 0;
  const animatedValue = useAnimatedValue(safeTargetValue, config);
  
  const formattedValue = useTransform(animatedValue, (value) => {
    // Ensure value is valid for formatting
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    if (formatter) {
      return formatter(safeValue);
    }
    
    // Default formatting based on value magnitude
    if (Math.abs(safeValue) >= 1000000000) {
      return `${(safeValue / 1000000000).toFixed(1)}B`;
    } else if (Math.abs(safeValue) >= 1000000) {
      return `${(safeValue / 1000000).toFixed(1)}M`;
    } else if (Math.abs(safeValue) >= 1000) {
      return `${(safeValue / 1000).toFixed(1)}K`;
    } else if (safeValue % 1 === 0) {
      return safeValue.toString();
    } else {
      return safeValue.toFixed(2);
    }
  });

  return formattedValue;
}

// Hook for percentage animations with proper formatting
export function useAnimatedPercentage(
  targetValue: number,
  precision: number = 1,
  config?: AnimationConfig
) {
  const animatedValue = useAnimatedValue(targetValue, config);
  
  const formattedPercentage = useTransform(animatedValue, (value) => 
    `${value.toFixed(precision)}%`
  );

  return formattedPercentage;
}

// Hook for currency animations with proper formatting
export function useAnimatedCurrency(
  targetValue: number,
  currency: string = '$',
  precision: number = 0,
  config?: AnimationConfig
) {
  const animatedValue = useAnimatedValue(targetValue, config);
  
  const formattedCurrency = useTransform(animatedValue, (value) => {
    const absValue = Math.abs(value);
    let formattedNumber: string;
    
    if (absValue >= 1000000000) {
      formattedNumber = `${(absValue / 1000000000).toFixed(1)}B`;
    } else if (absValue >= 1000000) {
      formattedNumber = `${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formattedNumber = `${(absValue / 1000).toFixed(1)}K`;
    } else {
      formattedNumber = absValue.toFixed(precision);
    }
    
    return `${currency}${value < 0 ? '-' : ''}${formattedNumber}`;
  });

  return formattedCurrency;
}

// Hook for staggered animations in lists
export function useStaggeredAnimation(
  itemCount: number,
  baseDelay: number = 0,
  stagger: number = 100
): AnimationConfig[] {
  return useMemo(() => 
    Array.from({ length: itemCount }, (_, index) => ({
      enabled: true,
      duration: 500,
      easing: 'easeOut' as const,
      delay: baseDelay + (index * stagger)
    })),
    [itemCount, baseDelay, stagger]
  );
}

// Easing function mappings for consistent animations
export const EASING_FUNCTIONS = {
  linear: [0, 0, 1, 1] as [number, number, number, number],
  easeIn: [0.4, 0, 1, 1] as [number, number, number, number],
  easeOut: [0, 0, 0.2, 1] as [number, number, number, number],
  easeInOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// Utility for creating smooth value transitions
export function createSmoothTransition(
  motionValue: MotionValue<number>,
  targetValue: number,
  duration: number = 800
) {
  return useTransform(motionValue, [0, targetValue], [0, targetValue]);
}

// Animation variants for common chart and UI elements
export const MOTION_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideInFromLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  },
  slideInFromRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  },
  chartBar: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 }
  },
  chartLine: {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    exit: { pathLength: 0, opacity: 0 }
  }
};

// Utility for conditional animations
export function getAnimationProps(
  variant: keyof typeof MOTION_VARIANTS,
  enabled: boolean = true,
  config?: AnimationConfig
) {
  if (!enabled) {
    return {};
  }

  return {
    ...MOTION_VARIANTS[variant],
    transition: {
      duration: (config?.duration || 500) / 1000,
      ease: EASING_FUNCTIONS[config?.easing || 'easeInOut'],
      delay: (config?.delay || 0) / 1000
    }
  };
}