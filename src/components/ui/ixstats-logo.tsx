"use client";

import React from 'react';
import { motion, type Easing } from 'framer-motion';
import { TrendingUp, Crown, Globe } from 'lucide-react';
import { cn } from '~/lib/utils';

interface IxStatsLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  variant?: 'logo-only' | 'with-text';
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: 'w-12 h-12',
    icon: { width: 24, height: 24 },
    crown: { width: 12, height: 12 },
    globe: { width: 12, height: 12 },
    text: 'text-2xl'
  },
  md: {
    container: 'w-16 h-16',
    icon: { width: 32, height: 32 },
    crown: { width: 16, height: 16 },
    globe: { width: 16, height: 16 },
    text: 'text-3xl'
  },
  lg: {
    container: 'w-20 h-20',
    icon: { width: 40, height: 40 },
    crown: { width: 20, height: 20 },
    globe: { width: 20, height: 20 },
    text: 'text-4xl'
  },
  xl: {
    container: 'w-24 h-24',
    icon: { width: 48, height: 48 },
    crown: { width: 24, height: 24 },
    globe: { width: 24, height: 24 },
    text: 'text-6xl'
  },
  xxl: {
    container: 'w-32 h-32',
    icon: { width: 64, height: 64 },
    crown: { width: 32, height: 32 },
    globe: { width: 32, height: 32 },
    text: 'text-8xl'
  }
};

export function IxStatsLogo({ 
  size = 'lg', 
  variant = 'logo-only',
  animated = true,
  className 
}: IxStatsLogoProps) {
  const config = sizeConfig[size];

  const logoVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: animated ? { 
      scale: 1.05, 
      rotate: [0, -1, 1, 0],
      transition: { 
        duration: 0.6, 
        ease: "easeInOut" as Easing
      }
    } : {}
  };

  const pulseVariants = {
    initial: { scale: 1, opacity: 0.2 },
    animate: animated ? {
      scale: [1, 1.1, 1],
      opacity: [0.2, 0.1, 0.2],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut" as Easing
      }
    } : {}
  };

  const LogoIcon = () => (
    <motion.div
      className={cn("relative flex items-center justify-center", config.container)}
      variants={logoVariants}
      initial="initial"
      whileHover="hover"
    >
      {/* Outer ring - represents global/world */}
      <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30"></div>
      
      {/* Inner elements - stats/analytics symbols */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* Rising bar chart representation */}
          <TrendingUp 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-500" 
            width={config.icon.width}
            height={config.icon.height}
            strokeWidth={2.5} 
          />
          {/* Crown symbol overlay for nation/leadership */}
          <Crown 
            className="absolute top-0 right-0 text-orange-500" 
            width={config.crown.width}
            height={config.crown.height}
            strokeWidth={2} 
          />
          {/* Globe symbol for international */}
          <Globe 
            className="absolute bottom-0 left-0 text-yellow-600" 
            width={config.globe.width}
            height={config.globe.height}
            strokeWidth={2} 
          />
        </div>
      </div>
      
      {/* Animated pulse effect */}
      <motion.div 
        className="absolute inset-0 rounded-full border-4 border-yellow-500"
        variants={pulseVariants}
        initial="initial"
        animate="animate"
      />
    </motion.div>
  );

  const LogoText = () => (
    <h1 className={cn(
      "font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 bg-clip-text text-transparent",
      config.text
    )}>
      IxStats™
    </h1>
  );

  if (variant === 'with-text') {
    return (
      <div className={cn("flex items-center justify-center gap-4", className)}>
        <LogoIcon />
        <LogoText />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <LogoIcon />
    </div>
  );
}
