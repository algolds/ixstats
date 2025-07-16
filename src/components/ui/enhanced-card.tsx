import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from '../../lib/utils';
import React from "react";

interface EnhancedCardProps extends React.ComponentProps<typeof Card> {
  variant?: 'default' | 'glass' | 'diplomatic' | 'economic' | 'military' | 'cultural';
  glow?: boolean | 'hover' | 'active';
  hover?: 'none' | 'lift' | 'glow' | 'scale';
  blur?: 'subtle' | 'moderate' | 'prominent';
}

export function EnhancedCard({ 
  className, 
  variant = 'default',
  glow = false,
  hover = 'lift',
  blur = 'moderate',
  children,
  ...props 
}: EnhancedCardProps) {
  const variantClasses = {
    default: '',
    glass: 'glass-card',
    diplomatic: 'glass-card-diplomatic',
    economic: 'glass-card-economic',
    military: 'glass-card-military',
    cultural: 'glass-card-cultural',
  };
  
  const hoverClasses = {
    none: '',
    lift: 'hover:translate-y-[-2px] hover:shadow-glass-lg transition-all duration-250',
    glow: 'hover:shadow-[var(--glow-interactive)] transition-all duration-250',
    scale: 'hover:scale-[1.02] transition-all duration-250',
  };
  
  const blurClasses = {
    subtle: 'backdrop-blur-[var(--blur-subtle)]',
    moderate: 'backdrop-blur-[var(--blur-moderate)]',
    prominent: 'backdrop-blur-[var(--blur-prominent)]',
  };
  
  const glowClasses = {
    true: 'shadow-[var(--glow-diplomatic)]',
    hover: 'hover:shadow-[var(--glow-diplomatic)]',
    active: 'focus:shadow-[var(--glow-diplomatic)]',
    false: '',
  };
  
  return (
    <Card 
      className={cn(
        variantClasses[variant],
        hoverClasses[hover],
        blurClasses[blur],
        glowClasses[String(glow) as keyof typeof glowClasses],
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

// Export as GlassCard for convenience
export { EnhancedCard as GlassCard }; 

// Diplomatic SDI Typography Utility Classes
// .diplomatic-header: Serif, uppercase, tracking-wide, bold, large size
// .diplomatic-icon: Large, serif, color accent
// .diplomatic-value: Monospace, bold, large
// .diplomatic-label: Sans-serif, medium, tracking-wide
// See globals.css for implementation details. 