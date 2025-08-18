"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useCountryFlag } from '~/hooks/useCountryFlags';
import { Globe, AlertCircle } from 'lucide-react';

interface EnhancedCountryFlagProps {
  countryName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showName?: boolean;
  className?: string;
  hoverBlur?: boolean;
  rounded?: boolean;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  priority?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-3',
  sm: 'w-6 h-4',
  md: 'w-8 h-6',
  lg: 'w-12 h-8',
  xl: 'w-16 h-12',
  full: 'w-full h-full' // Added full size
};

const textSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
};

export function EnhancedCountryFlag({
  countryName,
  size = 'md',
  showName = false,
  className,
  hoverBlur = true,
  rounded = false,
  fallbackIcon: FallbackIcon = Globe,
  priority = false
}: EnhancedCountryFlagProps) {
  const { flag, loading, error } = useCountryFlag(countryName);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const renderFlagImage = () => {
    if (loading) {
      return (
        <div className={cn(
          'flex items-center justify-center',
          'bg-gradient-to-br from-[var(--color-bg-secondary)]/50 to-[var(--color-bg-tertiary)]/30',
          'border border-[var(--color-border-primary)]',
          sizeClasses[size as keyof typeof sizeClasses],
          rounded ? 'rounded-full' : 'rounded'
        )}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Globe className={cn(
              'text-[var(--color-text-muted)]',
              size === 'xs' ? 'h-2 w-2' :
              size === 'sm' ? 'h-3 w-3' :
              size === 'md' ? 'h-4 w-4' :
              size === 'lg' ? 'h-6 w-6' : 'h-8 w-8'
            )} />
          </motion.div>
        </div>
      );
    }

    if (error || imageError || !flag?.flagUrl) {
      return (
        <div className={cn(
          'flex items-center justify-center',
          'bg-gradient-to-br from-[var(--color-bg-secondary)]/50 to-[var(--color-bg-tertiary)]/30',
          'border border-[var(--color-border-primary)]',
          sizeClasses[size as keyof typeof sizeClasses],
          rounded ? 'rounded-full' : 'rounded'
        )}>
          <FallbackIcon className={cn(
            'text-[var(--color-text-muted)]',
            size === 'xs' ? 'h-2 w-2' :
            size === 'sm' ? 'h-3 w-3' :
            size === 'md' ? 'h-4 w-4' :
            size === 'lg' ? 'h-6 w-6' : 'h-8 w-8'
          )} />
        </div>
      );
    }

    return (
      <motion.div
        className={cn(
          'relative overflow-hidden',
          sizeClasses[size as keyof typeof sizeClasses],
          rounded ? 'rounded-full' : 'rounded',
          'border border-[var(--color-border-primary)]'
        )}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={hoverBlur ? { scale: 1.05 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <img
          src={flag.flagUrl}
          alt={`Flag of ${countryName}`}
          className="w-full h-full object-fill"
          onError={() => setImageError(true)}
          loading={priority ? "eager" : "lazy"}
        />
        
        {/* Hover blur effect */}
        <AnimatePresence>
          {hoverBlur && isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'absolute inset-0',
                'bg-[var(--color-warning)]/20',
                'backdrop-blur-sm',
                rounded ? 'rounded-full' : 'rounded',
                'border border-[var(--color-warning)]/30'
              )}
              style={{
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)'
              }}
            />
          )}
        </AnimatePresence>

        {/* Source indicator */}
        {flag?.source && (
          <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
            <div className={cn(
              'w-2 h-2 rounded-full border border-white/50',
              flag.source === 'wikimedia' ? 'bg-green-500' : 'bg-gray-500'
            )} />
          </div>
        )}
      </motion.div>
    );
  };

  if (showName) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {renderFlagImage()}
        <div className="flex flex-col min-w-0">
          <span className={cn(
            'font-medium text-[var(--color-text-primary)] truncate',
            textSizes[size as keyof typeof textSizes] || 'text-xl'
          )}>
            {countryName}
          </span>
          {flag?.error && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-error)]">
              <AlertCircle className="h-3 w-3" />
              <span className="truncate">No flag available</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {renderFlagImage()}
    </div>
  );
}