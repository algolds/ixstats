"use client";

import React from 'react';
import { motion, type Easing } from 'framer-motion';
import { Crown, Globe } from 'lucide-react';
import { cn } from '~/lib/utils';

interface MyCountryLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' ;
  variant?: 'full' | 'icon-only' | 'text-only';
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: 'h-8',
    globe: 'h-6 w-6',
    crown: 'h-4 w-4',
    text: 'text-lg',
    spacing: 'gap-2'
  },
  md: {
    container: 'h-10',
    globe: 'h-8 w-8',
    crown: 'h-5 w-5',
    text: 'text-xl',
    spacing: 'gap-3'
  },
  lg: {
    container: 'h-12',
    globe: 'h-10 w-10',
    crown: 'h-6 w-6',
    text: 'text-2xl',
    spacing: 'gap-3'
  },
  xl: {
    container: 'h-16',
    globe: 'h-12 w-12',
    crown: 'h-8 w-8',
    text: 'text-3xl',
    spacing: 'gap-4'
  },
  xxl: {
    container: 'h-20',
    globe: 'h-24 w-24',
    crown: 'h-20 w-20',
    text: 'text-4xl',
    spacing: 'gap-6'
  }
};

export function MyCountryLogo({ 
  size = 'md', 
  variant = 'full',
  animated = true,
  className 
}: MyCountryLogoProps) {
  const config = sizeConfig[size];

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: { 
      scale: 1.05, 
      rotate: [0, -2, 2, 0],
      transition: { 
        duration: 0.6, 
        ease: "easeInOut" as Easing,
        rotate: {
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut" as Easing
        }
      }
    }
  };

  const crownVariants = {
    initial: { y: 0, scale: 1 },
    hover: { 
      y: -2, 
      scale: 1.1,
      transition: { 
        duration: 0.3, 
        ease: "easeOut" as Easing
      }
    }
  };

  const textVariants = {
    initial: { opacity: 1 },
    hover: { 
      opacity: 1,
      transition: { 
        duration: 0.3 
      }
    }
  };

  const LogoIcon = () => (
    <motion.div
      className="relative flex items-center justify-center"
      variants={animated ? iconVariants : {}}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      {/* Globe background with gold glow */}
      <div className={cn(
        "relative rounded-full",
        "bg-gradient-to-br from-amber-200 to-amber-400",
        "shadow-lg shadow-amber-500/30",
        "border border-amber-300/50",
        config.globe
      )}>
        <Globe className={cn(
          "absolute inset-0 m-auto text-amber-900/80",
          config.globe
        )} />
        
        {/* Subtle glow overlay */}
        <div className={cn(
          "absolute inset-0 rounded-full",
          "bg-gradient-to-tr from-transparent via-white/20 to-transparent",
          "opacity-50"
        )} />
      </div>

      {/* Crown overlay */}
      <motion.div
        className="absolute -top-1 -right-1"
        variants={animated ? crownVariants : {}}
      >
        <div className={cn(
          "rounded-full bg-amber-400 border border-amber-300",
          "shadow-lg shadow-amber-500/40",
          "flex items-center justify-center",
          size === 'sm' ? 'p-1' : 
          size === 'md' ? 'p-1.5' : 
          size === 'lg' ? 'p-2' : 'p-2.5'
        )}>
          <Crown className={cn(
            "text-amber-900",
            config.crown
          )} />
        </div>
      </motion.div>
    </motion.div>
  );

  const LogoText = () => (
    <motion.div
      variants={animated ? textVariants : {}}
      className="flex flex-col leading-none"
    >
      <span className={cn(
        "font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent",
        config.text
      )}>
        MyCountry
      </span>
      <span className={cn(
        "text-xs text-amber-600/80 font-medium tracking-wider",
        size === 'xl' ? 'text-sm' : 'text-xs'
      )}>
        BUILDER®
      </span>
    </motion.div>
  );

  if (variant === 'icon-only') {
    return (
      <div className={cn(config.container, 'flex items-center', className)}>
        <LogoIcon />
      </div>
    );
  }

  if (variant === 'text-only') {
    return (
      <div className={cn(config.container, 'flex items-center', className)}>
        <LogoText />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        config.container, 
        'flex items-center', 
        config.spacing,
        className
      )}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      <LogoIcon />
      <LogoText />
    </motion.div>
  );
}

// Simplified icon version for use in navigation, etc.
export function MyCountryIcon({ 
  size = 'md', 
  className,
  animated = false 
}: Omit<MyCountryLogoProps, 'variant'>) {
  return (
    <MyCountryLogo 
      size={size} 
      variant="icon-only" 
      animated={animated}
      className={className} 
    />
  );
}
