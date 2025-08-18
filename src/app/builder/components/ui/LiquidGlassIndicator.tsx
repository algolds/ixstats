"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';

interface LiquidGlassIndicatorProps {
  percentage: number;
  color: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LiquidGlassIndicator({ 
  percentage, 
  color, 
  className,
  size = 'md' 
}: LiquidGlassIndicatorProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [percentage]);

  const sizeClasses = {
    sm: 'h-3',
    md: 'h-4', 
    lg: 'h-6'
  };

  // Extract CSS variable color or convert to appropriate format
  const getColorValue = (colorClass: string) => {
    if (colorClass.includes('--color-warning')) return '#F59E0B';
    if (colorClass.includes('--color-success')) return '#10B981';
    if (colorClass.includes('--color-brand-primary')) return '#3B82F6';
    if (colorClass.includes('--color-purple')) return '#8B5CF6';
    if (colorClass.includes('--color-error')) return '#EF4444';
    return '#3B82F6'; // default
  };

  const colorValue = getColorValue(color);

  // Dynamic glass effects based on theme
  const getGlassEffects = () => {
    return {
      innerHighlight: 'rgba(255,255,255,0.3)',
      innerShadow: 'rgba(0,0,0,0.2)',
      outerGlow: `${colorValue}30`
    };
  };

  const glassEffects = getGlassEffects();

  return (
    <div className={cn('relative overflow-hidden rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-sm', sizeClasses[size], className)}>
      {/* Glass container */}
      <div className="absolute inset-0 rounded-full border border-white/20 dark:border-white/30 shadow-inner" />
      
      {/* Liquid mercury effect */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, 
            ${colorValue}40 0%,
            ${colorValue}60 25%,
            ${colorValue}80 50%,
            ${colorValue}60 75%,
            ${colorValue}40 100%
          )`,
          boxShadow: `
            inset 0 1px 3px ${glassEffects.innerHighlight},
            inset 0 -1px 2px ${glassEffects.innerShadow},
            0 0 8px ${glassEffects.outerGlow}
          `
        }}
        initial={{ width: '0%' }}
        animate={{ width: `${animatedPercentage}%` }}
        transition={{
          duration: 1.5,
          ease: [0.23, 1, 0.32, 1],
          type: "spring",
          damping: 20,
          stiffness: 100
        }}
      >
        {/* Mercury surface shimmer */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background: `linear-gradient(90deg, 
              transparent 0%,
              rgba(255,255,255,0.4) 30%,
              rgba(255,255,255,0.6) 50%,
              rgba(255,255,255,0.4) 70%,
              transparent 100%
            )`
          }}
          animate={{
            x: ['-100%', '200%']
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        
        {/* Liquid bubbles effect */}
        {animatedPercentage > 30 && (
          <>
            <motion.div
              className="absolute w-1 h-1 bg-white/40 dark:bg-white/60 rounded-full"
              style={{
                top: '20%',
                left: '30%'
              }}
              animate={{
                scale: [0.5, 1, 0.5],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 0.5
              }}
            />
            <motion.div
              className="absolute w-0.5 h-0.5 bg-white/30 rounded-full"
              style={{
                top: '60%',
                left: '60%'
              }}
              animate={{
                scale: [0.3, 0.8, 0.3],
                opacity: [0.2, 0.5, 0.2]
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: 1.2
              }}
            />
          </>
        )}
      </motion.div>
      
      {/* Glass highlight */}
      <div 
        className="absolute top-0 left-0 right-0 h-1/3 rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)'
        }}
      />
      
      {/* Glass reflection */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/4 rounded-full"
        style={{
          background: 'linear-gradient(0deg, rgba(0,0,0,0.1) 0%, transparent 100%)'
        }}
      />
    </div>
  );
}