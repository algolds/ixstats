"use client";

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error Boundary component for MyCountry system
 * 
 * Provides graceful error handling and recovery options for the MyCountry interface.
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 */
export class MyCountryErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
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
    // Log error details
    console.error('[MyCountryErrorBoundary] Error caught:', error);
    console.error('[MyCountryErrorBoundary] Error info:', errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    // Reset error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
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

      // Default error UI
      return (
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto glass-hierarchy-parent">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <CardTitle className="text-2xl font-bold text-red-700">
                MyCountry System Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  An unexpected error occurred while loading your country dashboard. 
                  This could be due to a temporary network issue or system problem.
                </AlertDescription>
              </Alert>

              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Error Details:</h4>
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">
                        Component Stack
                      </summary>
                      <pre className="text-xs text-gray-500 mt-1 overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Recovery actions */}
              <div className="flex gap-4 justify-center pt-4">
                <Button 
                  onClick={this.handleRetry}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Return to Dashboard
                </Button>
              </div>

              {/* User guidance */}
              <div className="text-center text-sm text-muted-foreground pt-4">
                <p>
                  If this problem persists, please contact support or try refreshing your browser.
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
 * @param onError - Optional error handler callback
 * @returns Error state and reset function
 */
export function useErrorBoundary(onError?: (error: Error) => void) {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
    onError?.(error);
  }, [onError]);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

export default MyCountryErrorBoundary;