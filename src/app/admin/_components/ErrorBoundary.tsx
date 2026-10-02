"use client";
// src/app/admin/_components/ErrorBoundary.tsx

import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
  WarningTriangle as AlertTriangle,
  Refresh as RefreshCw,
  HomeSimple as Home,
} from "iconoir-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin Dashboard Error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Use window.location.assign to ensure base path is handled correctly
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-grouped flex min-h-screen items-center justify-center p-4">
          <FacetCard padding="lg" className="w-full max-w-md text-center">
            <div className="mb-4">
              <AlertTriangle aria-hidden className="text-destructive mx-auto mb-4 size-12" />
              <h1 className="text-label text-title-1 mb-2">Admin Dashboard Error</h1>
              <p className="text-label-secondary mb-4">
                Something went wrong with the admin dashboard. This error has been logged.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-control border-red/20 bg-red/10 mb-6 border p-4 text-left">
                <h3 className="text-body text-red mb-2 font-medium">Error Details:</h3>
                <p className="text-footnote text-red font-mono break-words">
                  {this.state.error.message}
                </p>
                {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-footnote text-red cursor-pointer">
                      Stack Trace (Dev Mode)
                    </summary>
                    <pre className="text-footnote text-red mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw />
                Try Again
              </Button>

              <Button variant="secondary" onClick={this.handleReload} className="w-full">
                <RefreshCw />
                Reload Page
              </Button>

              <Button variant="secondary" onClick={this.handleGoHome} className="w-full">
                <Home />
                Go to Homepage
              </Button>
            </div>

            <div className="border-separator mt-6 border-t pt-4">
              <p className="text-label-secondary text-footnote">
                If this problem persists, please contact your system administrator.
              </p>
            </div>
          </FacetCard>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple functional error fallback for lighter use cases
export function AdminErrorFallback({
  error,
  onRetry,
}: {
  error?: Error | null;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-row border-destructive/20 bg-destructive/10 border p-6">
      <div className="flex items-center">
        <AlertTriangle className="text-red mr-2 h-5 w-5" />
        <h3 className="text-body text-red font-medium">Component Error</h3>
      </div>
      <div className="mt-2">
        <p className="text-body text-red">
          {error?.message || "An unexpected error occurred in this component."}
        </p>
        {onRetry && (
          <Button variant="destructive" size="sm" onClick={onRetry} className="mt-3">
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// Hook for using error boundaries in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error("Component error:", error, errorInfo);
    // You could also send to an error reporting service here
  };
}
