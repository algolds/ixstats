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
    window.location.href = "/";
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Admin Dashboard Error
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Something went wrong with the admin dashboard. This error has been logged.
              </p>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  Error Details:
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 font-mono break-words">
                  {this.state.error.message}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                      Stack Trace (Dev Mode)
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium flex items-center justify-center transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium flex items-center justify-center transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-medium flex items-center justify-center transition-colors"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Homepage
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
  onRetry 
}: { 
  error?: Error | null; 
  onRetry?: () => void; 
}) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div className="flex items-center">
        <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
          Component Error
        </h3>
      </div>
      <div className="mt-2">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error?.message || "An unexpected error occurred in this component."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium"
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