/**
 * Projection Transition Utility (Plan 110: Globe-to-2D Projection Blend)
 *
 * Provides camera-driven smooth linear interpolation between 3D Globe projection
 * and 2D Mercator projection without view juts.
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import type { ProjectionMode } from "~/lib/maps/map-config";

export interface ProjectionSpec {
  type: string | unknown[];
}

/**
 * Returns a continuous interpolated projection spec for dynamic mode
 * that smoothly transitions between globe (z <= 2.5) and mercator (z >= 5.5).
 */
export function getInterpolatedProjectionSpec(mode: ProjectionMode): ProjectionSpec {
  switch (mode) {
    case "globe":
      return { type: "globe" };
    case "mercator":
      return { type: "mercator" };
    case "dynamic":
    default:
      return {
        type: ["interpolate", ["linear"], ["zoom"], 2.5, "globe", 5.5, "mercator"],
      };
  }
}

/**
 * Smoothly applies a projection change to a MapLibre instance.
 */
export function applySmoothProjection(map: MapLibreMap, mode: ProjectionMode): void {
  if (!map) return;

  try {
    const spec = getInterpolatedProjectionSpec(mode);

    if ("setProjection" in map && typeof (map as any).setProjection === "function") {
      (map as any).setProjection(spec);
    }
  } catch (err) {
    console.warn("[ProjectionTransition] Smooth transition caught:", err);
  }
}
