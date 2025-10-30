/**
 * Map error state component
 * Displays error message when map fails to load
 */

"use client";

import React from "react";

interface MapErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export const MapErrorState = React.memo(function MapErrorState({
  error,
  onRetry,
}: MapErrorStateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h2 className="mb-2 text-xl font-semibold text-gray-800">Map Error</h2>
        <p className="mb-4 text-gray-600">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
});
