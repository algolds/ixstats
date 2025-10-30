"use client";
import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log WebGL-related errors
    if (error.message.includes("WebGL") || error.message.includes("THREE")) {
      console.warn("WebGL Error caught by boundary:", error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
            <div className="text-center text-gray-600">
              <div className="text-sm">Graphics temporarily unavailable</div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
