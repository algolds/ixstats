import { Button } from "./button";
import { cn } from "../../lib/utils";
import React from "react";

interface EnhancedButtonProps extends React.ComponentProps<typeof Button> {
  glass?: boolean;
  glow?: boolean | 'hover';
  nation?: boolean; // Use nation-specific theming
}

export function EnhancedButton({ 
  className,
  glass = false,
  glow = false,
  nation = false,
  children,
  ...props 
}: EnhancedButtonProps) {
  const glassClasses = glass ? 'glass-button' : '';
  const nationClasses = nation ? 'bg-[var(--nation-primary)] hover:bg-[var(--nation-secondary)]' : '';
  const glowClasses = {
    true: 'shadow-[var(--glow-interactive)]',
    hover: 'hover:shadow-[var(--glow-interactive)]',
    false: ''
  };
  
  return (
    <Button 
      className={cn(
        glassClasses,
        nationClasses,
        glowClasses[String(glow) as keyof typeof glowClasses],
        'transition-all duration-250',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

// Export as GlassButton
export { EnhancedButton as GlassButton }; 