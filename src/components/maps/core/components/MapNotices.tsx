"use client";

import { WarningTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

export function MapLoadError({
  className,
  message,
  onRetry,
}: {
  className: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className={`bg-surface absolute inset-0 flex items-center justify-center p-6 ${className}`}
    >
      <div className="max-w-sm space-y-3 text-center">
        <WarningTriangle className="text-destructive mx-auto h-6 w-6" aria-hidden />
        <p className="text-label text-title-3">Couldn&apos;t load the map</p>
        <p className="text-label-secondary text-body">
          {message || "The map data didn't arrive. Check your connection and try again."}
        </p>
        <Button type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function MapFailureOverlay({
  webglError,
  onKeepWaiting,
}: {
  webglError: boolean;
  onKeepWaiting: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-map-ocean z-chrome absolute inset-0 flex items-center justify-center p-6 text-center"
    >
      <FacetMaterial layer="overlay" className="rounded-card max-w-md space-y-6 p-8">
        <WarningTriangle className="text-destructive mx-auto h-8 w-8" aria-hidden />
        <div className="space-y-2">
          <h3 className="text-label text-title-2">
            {webglError ? "WebGL Error Detected" : "Map Loading Timeout"}
          </h3>
          <p className="text-label-secondary text-body">
            {webglError
              ? "WebGL is either disabled, crashed, or not supported by your browser. Please check your hardware acceleration settings."
              : "The map engine is taking longer than expected to load. This might be due to slow network speeds or database recovery mode."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!webglError && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onKeepWaiting}
              className="w-full sm:flex-1"
            >
              Keep waiting
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            onClick={() => window.location.reload()}
            className="bg-blue text-on-blue hover:bg-blue/90 w-full sm:flex-1"
          >
            Reload page
          </Button>
        </div>
      </FacetMaterial>
    </div>
  );
}
