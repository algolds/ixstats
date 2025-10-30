// src/app/admin/_components/ErrorBoundary.tsx
"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

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
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-lg dark:bg-gray-800">
            <div className="mb-4">
              <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-500" />
              <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard Error
              </h1>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Something went wrong with the admin dashboard. This error has been logged.
              </p>
            </div>

            {this.state.error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-800 dark:bg-red-900/20">
                <h3 className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">
                  Error Details:
                </h3>
                <p className="font-mono text-xs break-words text-red-700 dark:text-red-300">
                  {this.state.error.message}
                </p>
                {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400">
                      Stack Trace (Dev Mode)
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto text-xs whitespace-pre-wrap text-red-600 dark:text-red-400">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={this.handleRetry}
                className="flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </button>

              <button
                onClick={this.handleReload}
                className="flex w-full items-center justify-center rounded-md bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex w-full items-center justify-center rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Homepage
              </button>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If this problem persists, please contact your system administrator.
              </p>
            </div>
          </div>
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
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-center">
        <AlertTriangle className="mr-2 h-5 w-5 text-red-400" />
        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Component Error</h3>
      </div>
      <div className="mt-2">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error?.message || "An unexpected error occurred in this component."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
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
