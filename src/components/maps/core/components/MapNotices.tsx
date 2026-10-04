"use client";

import { useEffect, useState } from "react";
import { Xmark, WarningTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { useIsStaff } from "~/hooks/usePermissions";

const BETA_DISMISS_KEY = "ixmaps:beta-notice-dismissed";

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

/** Private-beta banner for non-staff; stays dismissed for this browser. */
export function BetaNotice() {
  const isStaff = useIsStaff();
  // Read after mount (not in the initialiser) so server and client render the same markup.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(BETA_DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* storage unavailable — show the notice */
    }
  }, []);

  if (isStaff || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BETA_DISMISS_KEY, "1");
    } catch {
      /* storage unavailable (private mode) — dismissal lasts for this visit only */
    }
  };

  return (
    <FacetMaterial
      layer="chrome"
      role="note"
      className="rounded-card pointer-events-auto w-full max-w-sm p-3"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <WarningTriangle className="text-yellow mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-label text-headline">Maps private beta</h4>
          <p className="text-label-secondary text-footnote leading-relaxed">
            Explore the world map, terrain and other nations freely. Adding your own borders or
            claiming territory isn&apos;t open to external players yet.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismiss}
          className="text-label-secondary -m-2 h-8 w-8 shrink-0 rounded-full"
          aria-label="Dismiss private beta notice"
        >
          <Xmark aria-hidden />
        </Button>
      </div>
    </FacetMaterial>
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
