"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendIndicator as TrendIndicatorUI } from '~/components/ui/trend-indicator';

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value?: number;
    label?: string;
  };
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  badge?: {
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

const statusColors = {
  success: 'border-green-500/20 bg-green-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  error: 'border-red-500/20 bg-red-500/5',
  info: 'border-blue-500/20 bg-blue-500/5',
  neutral: 'border-border/20'
};

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = 'neutral',
  badge,
  theme,
  className,
  onClick,
  loading = false,
  actions,
  footer
}: MetricCardProps) {
  const CardWrapper = onClick ? motion.div : 'div';
  const cardProps = onClick ? {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    onClick,
    className: 'cursor-pointer'
  } : {};

  const themeStyles = theme ? {
    borderColor: theme.accent,
    background: `linear-gradient(135deg, ${theme.bg} 0%, transparent 100%)`
  } : undefined;

  return (
    <CardWrapper {...cardProps}>
      <Card
        className={cn(
          'glass-hierarchy-interactive transition-all duration-200',
          statusColors[status],
          className
        )}
        style={themeStyles}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2 flex-1">
            {Icon && (
              <div className={cn(
                "p-2 rounded-lg",
                theme ? `bg-gradient-to-br ${theme.primary}` : "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  theme ? "text-white" : "text-primary"
                )} />
              </div>
            )}
            <div className="flex-1">
              <CardTitle className="text-sm font-medium leading-none">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-xs mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant={badge.variant || 'default'} className="text-xs">
                {badge.label}
              </Badge>
            )}
            {actions}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 bg-muted animate-pulse rounded" />
              {trend && <div className="h-4 bg-muted animate-pulse rounded w-1/2" />}
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold tracking-tight">
                  {value}
                </div>
                {trend && (
                  <TrendIndicatorUI
                    trend={trend.direction}
                    value={trend.value}
                  />
                )}
              </div>
              {footer && (
                <div className="mt-3 pt-3 border-t border-border/10">
                  {footer}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </CardWrapper>
  );
}

// Specialized metric card variants
export function EconomicMetricCard(props: Omit<MetricCardProps, 'theme'>) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: 'from-blue-500 to-cyan-600',
        secondary: 'from-blue-500/10 to-cyan-600/10',
        accent: 'rgb(59, 130, 246)',
        bg: 'rgba(59, 130, 246, 0.05)'
      }}
    />
  );
}

export function PopulationMetricCard(props: Omit<MetricCardProps, 'theme'>) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: 'from-green-500 to-emerald-600',
        secondary: 'from-green-500/10 to-emerald-600/10',
        accent: 'rgb(34, 197, 94)',
        bg: 'rgba(34, 197, 94, 0.05)'
      }}
    />
  );
}

export function GovernmentMetricCard(props: Omit<MetricCardProps, 'theme'>) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: 'from-purple-500 to-violet-600',
        secondary: 'from-purple-500/10 to-violet-600/10',
        accent: 'rgb(168, 85, 247)',
        bg: 'rgba(168, 85, 247, 0.05)'
      }}
    />
  );
}

export function DiplomaticMetricCard(props: Omit<MetricCardProps, 'theme'>) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: 'from-amber-500 to-orange-600',
        secondary: 'from-amber-500/10 to-orange-600/10',
        accent: 'rgb(245, 158, 11)',
        bg: 'rgba(245, 158, 11, 0.05)'
      }}
    />
  );
}
