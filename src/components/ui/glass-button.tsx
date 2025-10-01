"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';

interface GlassButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDragEnd' | 'onDragStart' | 'onDrag' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'> {
  variant?: 'primary' | 'secondary' | 'neutral' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  depth?: 'shallow' | 'medium' | 'deep';
  glow?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary: {
    bg: 'bg-[var(--color-warning)]/20',
    border: 'border-[var(--color-warning)]/30',
    text: 'text-[var(--color-warning)]',
    glow: 'shadow-[var(--color-warning)]/20',
    glowHover: 'hover:shadow-[var(--color-warning)]/40',
    highlight: 'from-[var(--color-warning)]/20 via-[var(--color-warning)]/10 to-transparent'
  },
  secondary: {
    bg: 'bg-[var(--color-brand-primary)]/20',
    border: 'border-[var(--color-brand-primary)]/30',
    text: 'text-[var(--color-brand-primary)]',
    glow: 'shadow-[var(--color-brand-primary)]/20',
    glowHover: 'hover:shadow-[var(--color-brand-primary)]/40',
    highlight: 'from-[var(--color-brand-primary)]/20 via-[var(--color-brand-primary)]/10 to-transparent'
  },
  neutral: {
    bg: 'bg-bg-accent/10',
    border: 'border-border-secondary',
    text: 'text-text-primary',
    glow: 'shadow-text-primary/10',
    glowHover: 'hover:shadow-text-primary/20',
    highlight: 'from-text-primary/20 via-text-primary/10 to-transparent'
  },
  danger: {
    bg: 'bg-[var(--color-error)]/20',
    border: 'border-[var(--color-error)]/30',
    text: 'text-[var(--color-error)]',
    glow: 'shadow-[var(--color-error)]/20',
    glowHover: 'hover:shadow-[var(--color-error)]/40',
    highlight: 'from-[var(--color-error)]/20 via-[var(--color-error)]/10 to-transparent'
  }
};

const sizeStyles = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg'
};

const depthStyles = {
  shallow: {
    shadow: 'shadow-md',
    shadowHover: 'hover:shadow-lg',
    shadowActive: 'active:shadow-sm',
    blur: 'backdrop-blur-sm',
    inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    insetHover: 'hover:inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    insetActive: 'active:inset 0 -1px 0 rgba(0, 0, 0, 0.1)'
  },
  medium: {
    shadow: 'shadow-lg',
    shadowHover: 'hover:shadow-xl',
    shadowActive: 'active:shadow-md',
    blur: 'backdrop-blur-md',
    inset: 'inset 0 2px 0 rgba(255, 255, 255, 0.1)',
    insetHover: 'hover:inset 0 2px 0 rgba(255, 255, 255, 0.2)',
    insetActive: 'active:inset 0 -2px 0 rgba(0, 0, 0, 0.15)'
  },
  deep: {
    shadow: 'shadow-xl',
    shadowHover: 'hover:shadow-2xl',
    shadowActive: 'active:shadow-lg',
    blur: 'backdrop-blur-lg',
    inset: 'inset 0 3px 0 rgba(255, 255, 255, 0.15)',
    insetHover: 'hover:inset 0 3px 0 rgba(255, 255, 255, 0.25)',
    insetActive: 'active:inset 0 -3px 0 rgba(0, 0, 0, 0.2)'
  }
};

export function GlassButton({
  variant = 'neutral',
  size = 'md',
  depth = 'medium',
  glow = false,
  pressed = false,
  children,
  className,
  disabled,
  ...props
}: GlassButtonProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  const depthStyle = depthStyles[depth];

  return (
    <motion.button
      className={cn(
        // Base styles
        'relative overflow-hidden rounded-xl border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-warning)]/50 focus:ring-offset-2 focus:ring-offset-transparent',
        
        // Size
        sizeStyle,
        
        // Variant colors
        variantStyle.bg,
        variantStyle.border,
        variantStyle.text,
        
        // Depth and glass effects
        depthStyle.blur,
        depthStyle.shadow,
        depthStyle.shadowHover,
        depthStyle.shadowActive,
        
        // Glow effects
        glow && variantStyle.glow,
        glow && variantStyle.glowHover,
        
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:scale-[1.02] active:scale-[0.98]',
        
        // Pressed state
        pressed && 'scale-[0.98] shadow-inner',
        
        className
      )}
      whileHover={!disabled ? { y: -1 } : {}}
      whileTap={!disabled ? { y: 1 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled}
      {...props}
    >
      {/* Glass highlight overlay */}
      <div 
        className={cn(
          'absolute inset-0 rounded-xl',
          'bg-gradient-to-br opacity-50',
          variantStyle.highlight
        )}
      />
      
      {/* Inner light reflection */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-xl" />
      
      {/* Depth shadow insets */}
      <div 
        className="absolute inset-0 rounded-xl"
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1)
          `
        }}
      />
      
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2 font-medium">
        {children}
      </span>
      
      {/* Pressed state overlay */}
      {pressed && (
        <div 
          className="absolute inset-0 bg-black/20 rounded-xl"
          style={{
            boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.3)'
          }}
        />
      )}
      
      {/* Hover ripple effect */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100"
        style={{
          background: `radial-gradient(circle at center, ${variantStyle.highlight.split(' ')[0].replace('from-', '')} 0%, transparent 70%)`
        }}
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1, opacity: 0.3 }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
}

// Specialized button variants
export function MyCountryButton(props: Omit<GlassButtonProps, 'variant'>) {
  return <GlassButton variant="primary" glow {...props} />;
}

export function ImportButton(props: Omit<GlassButtonProps, 'variant' | 'glow'>) {
  return (
    <GlassButton 
      variant="neutral" 
      className={cn(
        'hover:border-[var(--color-warning)]/50 hover:bg-[var(--color-warning)]/10',
        'hover:text-[var(--color-warning)] hover:shadow-[var(--color-warning)]/20',
        props.className
      )}
      {...props} 
    />
  );
}