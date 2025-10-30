/**
 * Simple Map Container Component
 *
 * A basic div container for MapLibre GL JS.
 * The map initialization is handled by useMapInstance hook.
 */

"use client";

import React, { forwardRef } from "react";

interface MapContainerProps {
  height?: number;
  className?: string;
}

export const MapContainer = forwardRef<HTMLDivElement, MapContainerProps>(function MapContainer(
  { height, className = "" },
  ref
) {
  return (
    <div
      ref={ref}
      className={`h-full w-full ${className}`}
      style={height ? { height: `${height}px` } : undefined}
    />
  );
});
