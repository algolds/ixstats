"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: "page" | "section" | "component";
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  showDetails: boolean;
  retryCount: number;
}

export class ComprehensiveErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      eventId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.group("🚨 Error Boundary Caught Error");
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Component Stack:", errorInfo.componentStack);
    console.error("Context:", this.props.context);
    console.groupEnd();

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (process.env.NODE_ENV === "production") {
      this.logErrorToService(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((resetKey, idx) => resetKey !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
    }));
  };

  retryWithDelay = () => {
    this.setState({ retryCount: this.state.retryCount + 1 });

    // Add a small delay to prevent rapid retries
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 1000);
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  logErrorToService = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real app, you'd send this to your error tracking service
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        context: this.props.context,
        level: this.props.level,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        eventId: this.state.eventId,
      };

      console.log("Would log to service:", errorData);
    } catch (loggingError) {
      console.error("Failed to log error:", loggingError);
    }
  };

  getErrorSeverity = (): "low" | "medium" | "high" | "critical" => {
    const { level } = this.props;
    const { error } = this.state;

    if (level === "page") return "critical";
    if (level === "section") return "high";

    if (error?.name === "ChunkLoadError") return "medium";
    if (error?.message?.includes("hydration")) return "high";
    if (error?.message?.includes("Cannot read property")) return "medium";

    return "low";
  };

  getSeverityColor = () => {
    const severity = this.getErrorSeverity();
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, eventId, showDetails, retryCount } = this.state;
      const { level = "component", context, isolate } = this.props;
      const severity = this.getErrorSeverity();

      return (
        <div className={`${isolate ? "isolated-error-boundary" : ""} p-4`}>
          <Card className="glass-hierarchy-parent border-destructive/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <AlertTriangle className="text-destructive h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-destructive text-lg font-semibold">
                      Something went wrong
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {level === "page" &&
                        "This page encountered an error and cannot be displayed."}
                      {level === "section" &&
                        "This section encountered an error and cannot be displayed."}
                      {level === "component" && "A component on this page encountered an error."}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={this.getSeverityColor() as any} className="text-xs">
                    {severity.toUpperCase()}
                  </Badge>
                  {retryCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Retry #{retryCount}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error summary */}
              <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                <p className="text-destructive mb-1 text-sm font-medium">
                  {error?.name || "Unknown Error"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {error?.message || "An unexpected error occurred"}
                </p>
              </div>

              {/* Context information */}
              {context && (
                <div className="text-muted-foreground text-xs">
                  <strong>Context:</strong> {context}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={this.retryWithDelay}
                  size="sm"
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>

                <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                  Reload Page
                </Button>

                {process.env.NODE_ENV === "development" && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        onClick={this.toggleDetails}
                        size="sm"
                        variant="ghost"
                        className="flex items-center gap-2"
                      >
                        <Bug className="h-4 w-4" />
                        Debug Info
                        {showDetails ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-4">
                      <div className="space-y-3">
                        {/* Error ID */}
                        {eventId && (
                          <div className="text-xs">
                            <strong>Error ID:</strong>{" "}
                            <code className="bg-muted rounded px-1">{eventId}</code>
                          </div>
                        )}

                        {/* Stack trace */}
                        {error?.stack && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium">Stack Trace:</h4>
                            <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                              {error.stack}
                            </pre>
                          </div>
                        )}

                        {/* Component stack */}
                        {errorInfo?.componentStack && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium">Component Stack:</h4>
                            <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              {/* User-friendly suggestions */}
              <div className="text-muted-foreground text-sm">
                <p className="mb-2">
                  <strong>What you can try:</strong>
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs">
                  <li>Click "Try Again" to retry loading this component</li>
                  <li>Refresh the page to reload all components</li>
                  <li>Check your internet connection</li>
                  {severity === "critical" && (
                    <li>Try navigating to a different page and coming back</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenient wrapper components for different levels
export function PageErrorBoundary({ children, context, onError }: Omit<Props, "level">) {
  return (
    <ComprehensiveErrorBoundary level="page" context={context} onError={onError} isolate>
      {children}
    </ComprehensiveErrorBoundary>
  );
}

export function SectionErrorBoundary({ children, context, onError }: Omit<Props, "level">) {
  return (
    <ComprehensiveErrorBoundary level="section" context={context} onError={onError}>
      {children}
    </ComprehensiveErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children, context, onError }: Omit<Props, "level">) {
  return (
    <ComprehensiveErrorBoundary level="component" context={context} onError={onError}>
      {children}
    </ComprehensiveErrorBoundary>
  );
}

// Hook for functional components to trigger error boundaries
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    throw error;
  }, []);
}
