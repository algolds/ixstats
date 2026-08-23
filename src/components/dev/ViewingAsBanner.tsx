"use client";

import React from "react";
import { WarningTriangle as AlertTriangle, ArrowLeft } from "iconoir-react";
import { useDevCountryView } from "~/context/DevCountryViewContext";
import { cn } from "~/lib/utils";

// Only render in development mode
const isDevelopment = process.env.NODE_ENV === "development";

export function ViewingAsBanner() {
  const { canUseDevView, isViewingOtherCountry, viewCountryName, clearViewCountry, viewCountryId } =
    useDevCountryView();

  // Don't render if not in dev mode, user can't use dev view, or viewing own country
  if (!isDevelopment || !canUseDevView || !isViewingOtherCountry) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 right-0 left-0 z-[100]",
        "flex items-center justify-center gap-4 px-4 py-2",
        "bg-amber-500/95 backdrop-blur-sm",
        "text-amber-950 shadow-md"
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        DEV MODE: Viewing as <strong>{viewCountryName || viewCountryId}</strong>
      </span>
      <button
        onClick={clearViewCountry}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1",
          "bg-amber-600/20 text-amber-950",
          "transition-colors hover:bg-amber-600/30",
          "text-sm font-medium"
        )}
      >
        <ArrowLeft className="h-3 w-3" />
        Return to My Country
      </button>
    </div>
  );
}
