"use client";

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { createUrl } from "~/lib/url-utils";
import { logger, LogCategory } from '~/lib/logger';
import { discordWebhook } from '~/lib/discord-webhook';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  homeUrl?: string;
  resetKeys?: Array<string | number>;
  maxRetries?: number;
}

/**
 * Generic Error Boundary component for dashboard and other systems
 *
 * Provides graceful error handling and recovery options with glass physics design.
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 *
 * Features:
 * - Automatic error logging to console (extensible to monitoring services)
 * - Retry functionality with error count tracking
 * - Glass physics design system integration
 * - Development mode error details
 * - Async error support via hook wrapper
 * - Customizable fallback UI
 * - Max retry limit to prevent infinite loops
 *
 * @example
 * ```tsx
 * <DashboardErrorBoundary
 *   title="Dashboard Error"
 *   description="An error occurred loading your dashboard"
 *   onError={(error) => logToMonitoring(error)}
 * >
 *   <YourComponent />
 * </DashboardErrorBoundary>
 * ```
 */
export class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Increment error count
    const errorCount = this.state.errorCount + 1;

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      errorCount,
    });

    // Log to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error callback (can be used for monitoring services)
    this.props.onError?.(error, errorInfo);

    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.logToMonitoring(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: DashboardErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const currentResetKeys = this.props.resetKeys;

      if (
        prevResetKeys.length !== currentResetKeys.length ||
        prevResetKeys.some((key, index) => key !== currentResetKeys[index])
      ) {
        this.handleRetry();
      }
    }
  }

  /**
   * Log error to monitoring service
   * Integrates with logger.ts for database persistence and Discord webhook alerts
   */
  private logToMonitoring(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Use existing logger system for production error monitoring
      logger.critical(LogCategory.SYSTEM, `React Error Boundary: ${error.message}`, {
        component: 'DashboardErrorBoundary',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack || '',
        },
        metadata: {
          componentStack: errorInfo.componentStack,
          errorCount: this.state.errorCount,
          timestamp: new Date().toISOString(),
        },
      });

      // Also send directly to Discord webhook for immediate visibility
      discordWebhook.sendError(error, `React Error Boundary - Error Count: ${this.state.errorCount}`).catch(err => {
        console.error('[Error Boundary] Failed to send Discord alert:', err);
      });
    } catch (loggingError) {
      // Fallback if logging fails - don't let logging errors crash the error handler
      console.error('[Error Boundary] Failed to log error to monitoring:', loggingError);
      console.error('[Error Boundary] Original error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 5;

    // Prevent infinite retry loops
    if (this.state.errorCount >= maxRetries) {
      console.warn(
        `Max retry limit (${maxRetries}) reached. Preventing further retries.`
      );
      return;
    }

    // Reset error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    const homeUrl = this.props.homeUrl || '/dashboard';
    window.location.href = createUrl(homeUrl);
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = this.props.maxRetries || 5;
      const canRetry = this.state.errorCount < maxRetries;

      // Check for custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.handleRetry}
          />
        );
      }

      // Default error UI with glass physics design
      return (
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto glass-hierarchy-parent">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <CardTitle className="text-2xl font-bold text-red-700">
                {this.props.title || 'Something Went Wrong'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {this.props.description ||
                    'An unexpected error occurred. Please try again or return to the dashboard.'}
                </AlertDescription>
              </Alert>

              {/* Max retry warning */}
              {!canRetry && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-orange-700">
                    Maximum retry attempts reached. Please refresh the page or
                    return to the dashboard.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Error Details (Development Mode):
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-gray-600">
                        Error Count:
                      </span>{' '}
                      <span className="text-xs text-gray-700">
                        {this.state.errorCount} / {maxRetries}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-600">
                        Message:
                      </span>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-32 mt-1 p-2 bg-white rounded border">
                        {this.state.error.message}
                      </pre>
                    </div>
                    {this.state.error.stack && (
                      <details>
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Stack Trace
                        </summary>
                        <pre className="text-xs text-gray-500 mt-1 overflow-auto max-h-32 p-2 bg-white rounded border">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}
                    {this.state.errorInfo && (
                      <details>
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Component Stack
                        </summary>
                        <pre className="text-xs text-gray-500 mt-1 overflow-auto max-h-32 p-2 bg-white rounded border">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Recovery actions */}
              <div className="flex flex-col gap-3 pt-4">
                {canRetry ? (
                  <Button
                    onClick={this.handleRetry}
                    className="flex items-center justify-center gap-2 w-full"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                ) : (
                  <Button
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-center gap-2 w-full"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </Button>
                )}

                {this.props.showHomeButton !== false && (
                  <Button
                    variant="outline"
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center gap-2 w-full"
                  >
                    <Home className="h-4 w-4" />
                    Return to Dashboard
                  </Button>
                )}
              </div>

              {/* User guidance */}
              <div className="text-center text-sm text-muted-foreground pt-4">
                <p>
                  If this problem persists, try refreshing the page or contact
                  support.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version of error boundary for functional components
 *
 * Provides async error handling capabilities that class-based error boundaries cannot catch.
 * Use this hook to manually catch and handle errors in async operations, event handlers, etc.
 *
 * @param onError - Optional error handler callback
 * @returns Object with captureError and resetError functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { captureError, resetError } = useErrorBoundary();
 *
 *   async function handleClick() {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       captureError(error);
 *     }
 *   }
 *
 *   return <button onClick={handleClick}>Do Something</button>;
 * }
 * ```
 */
export function useErrorBoundary(onError?: (error: Error) => void) {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback(
    (error: Error | unknown) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error('useErrorBoundary caught an error:', errorObj);
      setError(errorObj);
      onError?.(errorObj);
    },
    [onError]
  );

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError, error };
}

/**
 * Higher-order component to wrap any component with error boundary
 *
 * @param Component - Component to wrap
 * @param errorBoundaryProps - Props to pass to error boundary
 * @returns Wrapped component with error boundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   title: "Component Error",
 *   onError: (error) => logToMonitoring(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<DashboardErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <DashboardErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </DashboardErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

export default DashboardErrorBoundary;
