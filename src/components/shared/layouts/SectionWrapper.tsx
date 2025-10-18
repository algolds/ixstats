"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { cn } from '~/lib/utils';
import { Info, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';

export interface SectionWrapperProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
  status?: 'default' | 'loading' | 'error' | 'success' | 'warning';
  statusMessage?: string;
  progress?: number;
  badge?: {
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  help?: string;
  alert?: {
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
  };
}

const statusIcons = {
  default: Info,
  loading: motion.div,
  error: AlertTriangle,
  success: CheckCircle,
  warning: AlertTriangle
};

const statusColors = {
  default: 'border-border/20',
  loading: 'border-blue-500/20 bg-blue-500/5',
  error: 'border-red-500/20 bg-red-500/5',
  success: 'border-green-500/20 bg-green-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5'
};

export function SectionWrapper({
  title,
  description,
  icon: Icon,
  children,
  className,
  theme,
  status = 'default',
  statusMessage,
  progress,
  badge,
  actions,
  collapsible = false,
  defaultCollapsed = false,
  help,
  alert
}: SectionWrapperProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const StatusIcon = statusIcons[status];
  const themeStyles = theme ? {
    borderColor: theme.accent,
    background: `linear-gradient(135deg, ${theme.bg} 0%, transparent 100%)`
  } : undefined;

  return (
    <Card
      className={cn(
        'glass-hierarchy-child transition-all duration-200',
        statusColors[status],
        className
      )}
      style={themeStyles}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {Icon && (
              <div className={cn(
                "p-2 rounded-lg mt-0.5",
                theme ? `bg-gradient-to-br ${theme.primary}` : "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  theme ? "text-white" : "text-primary"
                )} />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                {help && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm max-w-xs">{help}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {badge && (
                  <Badge variant={badge.variant || 'default'} className="text-xs">
                    {badge.label}
                  </Badge>
                )}
              </div>
              {description && (
                <CardDescription className="text-sm">{description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status !== 'default' && statusMessage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {status === 'loading' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <StatusIcon className="h-4 w-4" />
                )}
                <span>{statusMessage}</span>
              </div>
            )}
            {actions}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0"
              >
                <motion.div
                  animate={{ rotate: isCollapsed ? 0 : 180 }}
                  transition={{ duration: 0.2 }}
                >
                  ▼
                </motion.div>
              </Button>
            )}
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
        {alert && (
          <Alert
            variant={alert.type === 'error' ? 'destructive' : 'default'}
            className={cn(
              'mt-3',
              alert.type === 'warning' && 'border-yellow-500/20 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400',
              alert.type === 'info' && 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400',
              alert.type === 'success' && 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400'
            )}
          >
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent>{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Themed section wrapper variants
export function EconomicSection(props: Omit<SectionWrapperProps, 'theme'>) {
  return (
    <SectionWrapper
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

export function GovernmentSection(props: Omit<SectionWrapperProps, 'theme'>) {
  return (
    <SectionWrapper
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

export function DiplomaticSection(props: Omit<SectionWrapperProps, 'theme'>) {
  return (
    <SectionWrapper
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

export function IntelligenceSection(props: Omit<SectionWrapperProps, 'theme'>) {
  return (
    <SectionWrapper
      {...props}
      theme={{
        primary: 'from-indigo-500 to-blue-600',
        secondary: 'from-indigo-500/10 to-blue-600/10',
        accent: 'rgb(99, 102, 241)',
        bg: 'rgba(99, 102, 241, 0.05)'
      }}
    />
  );
}
