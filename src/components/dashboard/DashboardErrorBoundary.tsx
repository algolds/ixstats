"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { WarningTriangle as AlertTriangle, SystemRestart as RotateCcw } from "iconoir-react";

export interface DashboardErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  resetKeys?: any[];
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[DashboardErrorBoundary] Uncaught error:", error, errorInfo);
  }

  public componentDidUpdate(prevProps: DashboardErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKeys) {
      if (
        !prevProps.resetKeys ||
        this.props.resetKeys.some((k, i) => k !== prevProps.resetKeys![i])
      ) {
        this.reset();
      }
    }
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="border-destructive/20 bg-destructive/5 flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border p-8 text-center backdrop-blur-md">
          <div className="bg-destructive/10 text-destructive mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-foreground text-base font-bold">
            {this.props.title || "Something went wrong"}
          </h3>
          <p className="text-muted-foreground mt-1.5 max-w-md text-xs">
            {this.props.description ||
              this.state.error?.message ||
              "An unexpected error occurred while loading this view."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={this.reset}
            className="mt-6 gap-2 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
