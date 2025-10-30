/**
 * Map loading state component
 * Displays loading indicator while map initializes
 */

"use client";

import React from "react";

interface MapLoadingStateProps {
  show: boolean;
}

export const MapLoadingState = React.memo(function MapLoadingState({
  show,
}: MapLoadingStateProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-gray-100/80 backdrop-blur-sm z-[10000]">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
        <p className="text-gray-600 font-medium">Loading map...</p>
      </div>
    </div>
  );
});
