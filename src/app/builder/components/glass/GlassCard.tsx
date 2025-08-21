"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useTheme } from '~/context/theme-context';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  depth?: 'base' | 'elevated' | 'modal' | 'interactive';
  blur?: 'none' | 'light' | 'medium' | 'heavy';
  gradient?: 'none' | 'subtle' | 'dynamic';
  hover?: boolean;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  motionPreset?: 'slide' | 'fade' | 'scale' | 'none';
  onClick?: () => void;
  ref?: React.Ref<HTMLDivElement>; // Added ref prop
  style?: React.CSSProperties; // Added style prop
}

const depthStyles = {
  base: 'bg-bg-surface/10 border border-border-primary',
  elevated: 'bg-bg-surface/20 border border-border-secondary shadow-lg',
  modal: 'bg-bg-surface/30 border border-border-secondary shadow-2xl',
  interactive: 'bg-bg-surface/15 border border-border-primary shadow-md hover:shadow-xl'
};

const blurStyles = {
  none: '',
  light: 'backdrop-blur-sm',
  medium: 'backdrop-blur-md',
  heavy: 'backdrop-blur-lg'
};

const gradientStyles = {
  none: '',
  subtle: 'bg-gradient-to-br from-bg-surface/5 to-bg-surface/10',
  dynamic: 'bg-gradient-to-br from-current/10 via-transparent to-current/5'
};

const themeStyles = {
  gold: 'text-amber-400 border-amber-400/30',
  blue: 'text-blue-400 border-blue-400/30',
  indigo: 'text-indigo-400 border-indigo-400/30',
  red: 'text-red-400 border-red-400/30',
  neutral: 'text-text-secondary border-border-primary'
};

const motionPresets = {
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: "easeOut" }
  },
  none: {}
};

export function GlassCard({
  children,
  className,
  depth = 'base',
  blur = 'medium',
  gradient = 'subtle',
  hover = false,
  theme = 'neutral',
  motionPreset = 'fade',
  onClick,
  ref, // Destructure ref
  style // Destructure style
}: GlassCardProps) {
  const { effectiveTheme } = useTheme();
  const isInteractive = Boolean(onClick) || hover;
  const finalDepth = isInteractive ? 'interactive' : depth;
  
  const cardClasses = cn(
    'rounded-xl overflow-hidden transition-all duration-300',
    'bg-opacity-50 touch-manipulation',
    depthStyles[finalDepth],
    blurStyles[blur],
    gradientStyles[gradient],
    themeStyles[theme],
    hover && 'hover:bg-bg-surface/25 hover:border-border-secondary',
    isInteractive && 'cursor-pointer active:scale-[0.98] md:active:scale-100',
    className
  );

  const CardComponent = motionPreset !== 'none' ? motion.div : 'div';
  const motionProps = motionPreset !== 'none' ? motionPresets[motionPreset] : {};

  return (
    <CardComponent
      ref={ref} // Pass ref to CardComponent
      style={style} // Pass style to CardComponent
      className={cardClasses}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </CardComponent>
  );
}

export function GlassCardHeader({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn(
      'p-6 border-b border-border-primary/50',
      className
    )}>
      {children}
    </div>
  );
}

export const GlassCardContent = React.forwardRef<HTMLDivElement, {
  children: React.ReactNode; 
  className?: string;
  style?: React.CSSProperties;
}>(({ children, className, style }, ref) => {
  return (
    <div ref={ref} className={cn('p-6', className)} style={style}>
      {children}
    </div>
  );
});

GlassCardContent.displayName = 'GlassCardContent';

export function GlassCardFooter({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn(
      'p-6 border-t border-border-primary/50 bg-bg-surface/5',
      className
    )}>
      {children}
    </div>
  );
}