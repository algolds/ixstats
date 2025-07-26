import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from '../../lib/utils';
import React from "react";

interface EnhancedCardProps extends React.ComponentProps<typeof Card> {
  variant?: 'default' | 'glass' | 'diplomatic' | 'economic' | 'military' | 'cultural' | 'social' | 'security' | 'mycountry';
  glow?: boolean | 'hover' | 'active';
  hover?: 'none' | 'lift' | 'glow' | 'scale';
}

export function EnhancedCard({ 
  className, 
  variant = 'default',
  glow = false,
  hover = 'lift',
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
    social: 'glass-card-social',
    security: 'glass-card-security',
    mycountry: 'glass-card-mycountry',
  };
  
  const hoverClasses = {
    none: '',
    lift: 'hover:-translate-y-1 transition-all duration-300',
    glow: 'hover:shadow-lg transition-all duration-300',
    scale: 'hover:scale-[1.02] transition-all duration-300',
  };
  
  const glowClasses = {
    true: 'shadow-lg',
    hover: 'hover:shadow-lg',
    active: 'focus:shadow-lg',
    false: '',
  };
  
  return (
    <Card 
      className={cn(
        variantClasses[variant],
        hoverClasses[hover],
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