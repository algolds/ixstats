"use client";

import React from "react";
import { MapControls, type MapControlsProps } from "./MapControls";

/**
 * MapControlsFAB — Backward-compatible wrapper delegating to responsive MapControls.
 */
export function MapControlsFAB(props: MapControlsProps) {
  return <MapControls variant="mobile" {...props} />;
}
