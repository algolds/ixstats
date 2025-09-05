"use client";

import React from 'react';
import { cn } from '~/lib/utils';

interface SophisticatedLoadingProps {
  variant?: 'atomic' | 'dashboard' | 'intelligence' | 'economic' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
  theme?: 'mycountry' | 'global' | 'eci' | 'sdi';
}

const LoadingVariants = {
  atomic: {
    sm: 'h-12 w-12',
    md: 'h-16 w-16', 
    lg: 'h-24 w-24'
  },
  dashboard: {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  },
  intelligence: {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  },
  economic: {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-20 w-20'
  },
  minimal: {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }
};

const ThemeColors = {
  mycountry: {
    primary: '#ca8a04',
    secondary: '#f59e0b',
    accent: '#fbbf24'
  },
  global: {
    primary: '#2563eb',
    secondary: '#3b82f6',
    accent: '#60a5fa'
  },
  eci: {
    primary: '#4f46e5',
    secondary: '#6366f1',
    accent: '#818cf8'
  },
  sdi: {
    primary: '#dc2626',
    secondary: '#ef4444',
    accent: '#f87171'
  }
};

export function SophisticatedLoading({
  variant = 'dashboard',
  size = 'md',
  message,
  className,
  theme = 'global'
}: SophisticatedLoadingProps) {
  const sizeClass = LoadingVariants[variant][size];
  const colors = ThemeColors[theme];

  if (variant === 'atomic') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-4 p-6', className)} role="status" aria-label={message || "Loading atomic components"}>
        <div className={cn('relative', sizeClass)}>
          {/* Outer orbital ring */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
            style={{ 
              borderColor: `transparent ${colors.primary} transparent transparent`,
              animationDuration: '2s'
            }}
          />
          
          {/* Middle orbital ring */}
          <div 
            className="absolute inset-2 rounded-full border-2 border-r-transparent animate-spin"
            style={{ 
              borderColor: `${colors.secondary} transparent ${colors.secondary} ${colors.secondary}`,
              animationDuration: '1.5s',
              animationDirection: 'reverse'
            }}
          />
          
          {/* Inner core */}
          <div 
            className="absolute inset-4 rounded-full animate-pulse"
            style={{ backgroundColor: colors.accent }}
          />
          
          {/* Center nucleus */}
          <div className="absolute inset-6 rounded-full bg-white dark:bg-black animate-pulse" />
        </div>
        
        {message && (
          <div className="text-sm font-medium text-center max-w-xs animate-pulse">
            <div className="text-foreground/80">{message}</div>
            <div className="text-xs text-muted-foreground mt-1">Building atomic structure...</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'intelligence') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)} role="status" aria-label={message || "Processing intelligence"}>
        <div className={cn('relative', sizeClass)}>
          {/* Brain-like pulsing pattern */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse opacity-70" />
          <div className="absolute inset-1 rounded-full bg-gradient-to-r from-indigo-400 to-blue-400 animate-pulse opacity-80" 
               style={{ animationDelay: '0.5s' }} />
          <div className="absolute inset-2 rounded-full bg-gradient-to-r from-purple-300 to-indigo-300 animate-pulse opacity-90" 
               style={{ animationDelay: '1s' }} />
          
          {/* Neural network lines */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
            <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-purple-400 to-transparent animate-pulse" 
                 style={{ animationDelay: '0.75s' }} />
          </div>
        </div>
        
        {message && (
          <div className="text-xs text-center text-muted-foreground animate-pulse">
            {message}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'economic') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)} role="status" aria-label={message || "Calculating economic data"}>
        <div className={cn('relative', sizeClass)}>
          {/* Economic growth chart simulation */}
          <div className="absolute inset-0 flex items-end justify-center gap-1">
            <div 
              className="w-1 bg-emerald-500 rounded-t animate-pulse"
              style={{ 
                height: '30%',
                animationDelay: '0s',
                animationDuration: '1.5s'
              }}
            />
            <div 
              className="w-1 bg-emerald-500 rounded-t animate-pulse"
              style={{ 
                height: '60%',
                animationDelay: '0.2s',
                animationDuration: '1.5s'
              }}
            />
            <div 
              className="w-1 bg-emerald-500 rounded-t animate-pulse"
              style={{ 
                height: '45%',
                animationDelay: '0.4s',
                animationDuration: '1.5s'
              }}
            />
            <div 
              className="w-1 bg-emerald-500 rounded-t animate-pulse"
              style={{ 
                height: '80%',
                animationDelay: '0.6s',
                animationDuration: '1.5s'
              }}
            />
            <div 
              className="w-1 bg-emerald-500 rounded-t animate-pulse"
              style={{ 
                height: '70%',
                animationDelay: '0.8s',
                animationDuration: '1.5s'
              }}
            />
          </div>
          
          {/* GDP trend line */}
          <div className="absolute inset-0 flex items-center">
            <div 
              className="w-full h-px bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-pulse opacity-60"
              style={{ animationDuration: '2s' }}
            />
          </div>
        </div>
        
        {message && (
          <div className="text-xs text-center text-muted-foreground">
            {message}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)} role="status" aria-label={message || "Loading"}>
        <div className={cn('relative', sizeClass)}>
          <div 
            className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `transparent ${colors.primary} transparent transparent` }}
          />
        </div>
        {message && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
    );
  }

  // Default dashboard variant
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-4', className)} role="status" aria-label={message || "Loading dashboard"}>
      <div className={cn('relative', sizeClass)}>
        {/* Glass-style loading with theme colors */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin glass-hierarchy-interactive"
          style={{ 
            borderColor: `transparent ${colors.primary} transparent transparent`,
            animationDuration: '1s'
          }}
        />
        
        {/* Inner rotating ring */}
        <div 
          className="absolute inset-2 rounded-full border-2 border-r-transparent animate-spin"
          style={{ 
            borderColor: `${colors.secondary} transparent ${colors.secondary} ${colors.secondary}`,
            animationDuration: '1.5s',
            animationDirection: 'reverse'
          }}
        />
        
        {/* Center pulse */}
        <div 
          className="absolute inset-4 rounded-full animate-pulse"
          style={{ backgroundColor: `${colors.accent}40` }}
        />
      </div>
      
      {message && (
        <div className="text-sm text-center text-foreground/80 font-medium">
          {message}
        </div>
      )}
      
      {/* Glass loading bar */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full animate-pulse"
          style={{ 
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.accent})`,
            animation: 'loading-bar 2s ease-in-out infinite'
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes loading-bar {
          0% { 
            width: 0%; 
            margin-left: 0%;
          }
          50% { 
            width: 75%; 
            margin-left: 12.5%;
          }
          100% { 
            width: 0%; 
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// Skeleton loading component for content areas
export function SophisticatedSkeleton({
  variant = 'card',
  lines = 3,
  className
}: {
  variant?: 'card' | 'list' | 'chart' | 'metric';
  lines?: number;
  className?: string;
}) {
  if (variant === 'card') {
    return (
      <div className={cn('glass-hierarchy-child p-6 animate-pulse', className)}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-muted rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-muted rounded w-1/3 mb-2" />
            <div className="h-3 bg-muted/70 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, i) => (
            <div 
              key={i}
              className="h-3 bg-muted rounded" 
              style={{ width: `${Math.random() * 40 + 60}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={cn('glass-hierarchy-child p-6 animate-pulse', className)}>
        <div className="h-4 bg-muted rounded w-1/4 mb-6" />
        <div className="flex items-end gap-2 h-32">
          {Array.from({ length: 8 }, (_, i) => (
            <div 
              key={i}
              className="bg-muted rounded-t flex-1"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'metric') {
    return (
      <div className={cn('glass-hierarchy-interactive p-4 animate-pulse', className)}>
        <div className="h-3 bg-muted rounded w-1/3 mb-3" />
        <div className="h-8 bg-muted rounded w-1/2 mb-2" />
        <div className="h-2 bg-muted/70 rounded w-1/4" />
      </div>
    );
  }

  // List variant
  return (
    <div className={cn('space-y-3 animate-pulse', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="flex items-center gap-3 glass-hierarchy-child p-3">
          <div className="w-8 h-8 bg-muted rounded-full" />
          <div className="flex-1">
            <div className="h-3 bg-muted rounded w-2/3 mb-1" />
            <div className="h-2 bg-muted/70 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}