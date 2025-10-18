"use client";

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  Info,
  RefreshCw,
  Home,
  ArrowLeft
} from 'lucide-react';

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  variant?: 'alert' | 'card' | 'inline';
  severity?: 'error' | 'warning' | 'info';
  showIcon?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
  onHome?: () => void;
  className?: string;
  fullScreen?: boolean;
  details?: string;
}

const severityConfig = {
  error: {
    icon: XCircle,
    alertVariant: 'destructive' as const,
    color: 'text-red-600',
    bg: 'bg-red-500/5 border-red-500/20'
  },
  warning: {
    icon: AlertTriangle,
    alertVariant: 'default' as const,
    color: 'text-yellow-600',
    bg: 'bg-yellow-500/5 border-yellow-500/20'
  },
  info: {
    icon: Info,
    alertVariant: 'default' as const,
    color: 'text-blue-600',
    bg: 'bg-blue-500/5 border-blue-500/20'
  }
};

export function ErrorDisplay({
  title,
  message,
  variant = 'alert',
  severity = 'error',
  showIcon = true,
  onRetry,
  onBack,
  onHome,
  className,
  fullScreen = false,
  details
}: ErrorDisplayProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-start gap-2 text-sm', className)}>
        {showIcon && <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />}
        <div className="flex-1">
          {title && <p className={cn('font-medium', config.color)}>{title}</p>}
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card
        className={cn(
          'glass-hierarchy-child',
          config.bg,
          fullScreen && 'min-h-screen flex items-center justify-center',
          className
        )}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            {showIcon && (
              <div className={cn('p-2 rounded-lg', severity === 'error' ? 'bg-red-100 dark:bg-red-900/20' : severity === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-blue-100 dark:bg-blue-900/20')}>
                <Icon className={cn('h-6 w-6', config.color)} />
              </div>
            )}
            <div className="flex-1">
              <CardTitle className="text-lg">
                {title || (severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Information')}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          {details && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:underline">
                Technical Details
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-muted/50 overflow-x-auto">
                {details}
              </pre>
            </details>
          )}
          {(onRetry || onBack || onHome) && (
            <div className="flex items-center gap-2 pt-2">
              {onRetry && (
                <Button onClick={onRetry} variant="default" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {onBack && (
                <Button onClick={onBack} variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              )}
              {onHome && (
                <Button onClick={onHome} variant="outline" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // alert variant
  return (
    <Alert
      variant={config.alertVariant}
      className={cn(
        severity === 'warning' && 'border-yellow-500/20 bg-yellow-500/5',
        severity === 'info' && 'border-blue-500/20 bg-blue-500/5',
        className
      )}
    >
      {showIcon && <Icon className="h-4 w-4" />}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="mt-2 space-y-3">
        <p>{message}</p>
        {details && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium hover:underline">
              Technical Details
            </summary>
            <pre className="mt-2 p-2 rounded bg-muted/50 text-xs overflow-x-auto">
              {details}
            </pre>
          </details>
        )}
        {(onRetry || onBack || onHome) && (
          <div className="flex items-center gap-2 pt-1">
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {onBack && (
              <Button onClick={onBack} variant="ghost" size="sm">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
            {onHome && (
              <Button onClick={onHome} variant="ghost" size="sm">
                <Home className="h-3 w-3 mr-1" />
                Home
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Convenience components
export function ErrorCard(props: Omit<ErrorDisplayProps, 'variant'>) {
  return <ErrorDisplay {...props} variant="card" />;
}

export function ErrorAlert(props: Omit<ErrorDisplayProps, 'variant'>) {
  return <ErrorDisplay {...props} variant="alert" />;
}

export function ErrorInline(props: Omit<ErrorDisplayProps, 'variant'>) {
  return <ErrorDisplay {...props} variant="inline" />;
}
