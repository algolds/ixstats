"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'dots' | 'pulse' | 'bars';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingState({
  variant = 'spinner',
  size = 'md',
  message,
  fullScreen = false,
  className
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = cn(
    'flex flex-col items-center justify-center gap-3',
    fullScreen && 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
    className
  );

  if (variant === 'spinner') {
    return (
      <div className={containerClasses}>
        <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={containerClasses}>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn('rounded-full bg-primary', size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4')}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={containerClasses}>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className={cn(
                'bg-primary rounded-full',
                size === 'sm' ? 'w-1' : size === 'md' ? 'w-1.5' : 'w-2'
              )}
              animate={{
                height: size === 'sm' ? [12, 24, 12] : size === 'md' ? [16, 32, 16] : [20, 40, 20]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1
              }}
            />
          ))}
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={containerClasses}>
        <motion.div
          className={cn('rounded-full bg-primary', sizeClasses[size])}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity
          }}
        />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  // skeleton variant
  return null;
}

// Skeleton loading patterns
export function SkeletonCard() {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </CardContent>
    </Card>
  );
}

export function SkeletonMetric() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}
