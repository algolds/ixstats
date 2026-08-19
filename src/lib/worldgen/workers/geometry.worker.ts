/**
 * Geometry Offloading Web Worker (Phase 3)
 *
 * Offloads heavy Turf.js geometry math (splines, union, difference, area calculations)
 * off the main UI thread during drag and editing operations.
 */

import { area } from "@turf/area";
import { bezierSpline } from "@turf/bezier-spline";
import { difference } from "@turf/difference";
import { intersect } from "@turf/intersect";
import { union } from "@turf/union";
import { lineString, polygon, featureCollection } from "@turf/helpers";

export interface GeometryWorkerMessage {
  id: string;
  type:
    | "COMPUTE_SPLINE"
    | "COMPUTE_AREA"
    | "COMPUTE_UNION"
    | "COMPUTE_DIFFERENCE"
    | "FILTER_SPATIAL_FEATURES";
  payload: any;
}

self.onmessage = (e: MessageEvent<GeometryWorkerMessage>) => {
  const { id, type, payload } = e.data;

  try {
    let result: any = null;

    switch (type) {
      case "COMPUTE_SPLINE": {
        const line = lineString(payload.coordinates);
        const curved = bezierSpline(line, payload.options);
        result = curved.geometry;
        break;
      }
      case "COMPUTE_AREA": {
        const poly = polygon(payload.coordinates);
        result = area(poly);
        break;
      }
      case "COMPUTE_UNION": {
        const p1 = polygon(payload.poly1);
        const p2 = polygon(payload.poly2);
        const combined = union(featureCollection([p1, p2]));
        result = combined ? combined.geometry : null;
        break;
      }
      case "COMPUTE_DIFFERENCE": {
        const p1 = polygon(payload.poly1);
        const p2 = polygon(payload.poly2);
        const diff = difference(featureCollection([p1, p2]));
        result = diff ? diff.geometry : null;
        break;
      }
      case "FILTER_SPATIAL_FEATURES": {
        const { features, currentZoom, hasFocus, selectedCountryId } = payload;
        result = features.filter((f: any) => {
          if (f.properties?.isCapital) return false;
          const pop = f.properties?.population ?? 0;
          if (currentZoom >= 6.0) return true;
          if (currentZoom >= 4.5) return pop >= 100000;
          if (currentZoom >= 3.0) return pop >= 250000;
          return pop >= 500000;
        });
        break;
      }
    }

    self.postMessage({ id, success: true, result });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || "Worker geometry error" });
  }
};
