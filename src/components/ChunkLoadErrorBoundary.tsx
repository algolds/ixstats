"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasChunkError: boolean;
}

/**
 * Error boundary that catches ChunkLoadErrors caused by Next.js dev server
 * memory-triggered restarts. Shows a brief reconnecting message and auto-reloads.
 *
 * This is primarily useful in development when the server restarts due to
 * memory pressure (4GB limit on constrained servers).
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  state: State = { hasChunkError: false };

  static getDerivedStateFromError(error: Error): State | null {
    // Check if it's a chunk loading error
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("ChunkLoadError")
    ) {
      return { hasChunkError: true };
    }
    // Re-throw non-chunk errors to be handled by other error boundaries
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Only log chunk errors, don't re-throw
    if (
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("ChunkLoadError")
    ) {
      console.log(
        "[ChunkLoadErrorBoundary] Detected chunk load error, will auto-reload:",
        error.message
      );
    } else {
      // Re-throw non-chunk errors
      throw error;
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State): void {
    if (this.state.hasChunkError && !prevState.hasChunkError) {
      // Auto-reload after brief delay to let server restart complete
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }

  render(): ReactNode {
    if (this.state.hasChunkError) {
      return (
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground">Reconnecting to server...</p>
            <p className="text-muted-foreground/60 mt-2 text-xs">
              The development server restarted. Refreshing automatically...
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Global error handler component that catches ChunkLoadErrors at the window level.
 * This handles errors that occur before React mounts or outside React's error boundary scope.
 */
export function ChunkLoadErrorHandler(): null {
  if (typeof window !== "undefined") {
    // Only set up once
    if (
      !(window as unknown as { __chunkErrorHandlerInstalled?: boolean })
        .__chunkErrorHandlerInstalled
    ) {
      (
        window as unknown as { __chunkErrorHandlerInstalled?: boolean }
      ).__chunkErrorHandlerInstalled = true;

      const handleError = (event: ErrorEvent) => {
        const isChunkError =
          event.message?.includes("Loading chunk") ||
          event.message?.includes("ChunkLoadError") ||
          event.error?.name === "ChunkLoadError";

        if (isChunkError) {
          event.preventDefault();
          console.log(
            "[ChunkLoadErrorHandler] Detected chunk load error at window level, will auto-reload"
          );
          // Show a brief message before reload
          document.body.innerHTML = `
            <div style="display: flex; min-height: 100vh; align-items: center; justify-content: center; background: var(--background, #0a0a0a);">
              <div style="text-align: center; color: var(--muted-foreground, #a1a1aa);">
                <p>Reconnecting to server...</p>
                <p style="margin-top: 8px; font-size: 12px; opacity: 0.6;">The development server restarted. Refreshing automatically...</p>
              </div>
            </div>
          `;
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      };

      window.addEventListener("error", handleError);

      // Also handle unhandled promise rejections (for dynamic imports)
      const handleRejection = (event: PromiseRejectionEvent) => {
        const error = event.reason;
        const isChunkError =
          error?.message?.includes("Loading chunk") ||
          error?.message?.includes("ChunkLoadError") ||
          error?.name === "ChunkLoadError";

        if (isChunkError) {
          event.preventDefault();
          console.log(
            "[ChunkLoadErrorHandler] Detected chunk load error in promise rejection, will auto-reload"
          );
          document.body.innerHTML = `
            <div style="display: flex; min-height: 100vh; align-items: center; justify-content: center; background: var(--background, #0a0a0a);">
              <div style="text-align: center; color: var(--muted-foreground, #a1a1aa);">
                <p>Reconnecting to server...</p>
                <p style="margin-top: 8px; font-size: 12px; opacity: 0.6;">The development server restarted. Refreshing automatically...</p>
              </div>
            </div>
          `;
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      };

      window.addEventListener("unhandledrejection", handleRejection);
    }
  }

  return null;
}
