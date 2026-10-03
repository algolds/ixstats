"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { WarningTriangle as AlertTriangle, SystemRestart as RotateCcw } from "iconoir-react";
import { Card } from "~/components/ui/card";

interface DashboardErrorBoundaryProps {
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
        <Card role="alert" className="flex min-h-[300px] w-full items-center justify-center">
          <EmptyState
            icon={<AlertTriangle className="text-destructive" />}
            title={this.props.title || "Something went wrong"}
            message={
              this.props.description ||
              this.state.error?.message ||
              "An unexpected error occurred while loading this view."
            }
            action={
              <Button type="button" variant="outline" size="sm" onClick={this.reset}>
                <RotateCcw aria-hidden />
                Try again
              </Button>
            }
          />
        </Card>
      );
    }

    return this.props.children;
  }
}
