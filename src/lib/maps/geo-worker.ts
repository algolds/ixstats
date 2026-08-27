/**
 * GeoJSON processing Web Worker.
 *
 * Handles CPU-intensive operations off the main thread:
 * - FILTER_BY_AREA: Filter features by minimum area
 * - FILTER_BY_BOUNDS: Filter features by bounding box (future)
 */

import type { FeatureCollection } from "geojson";

interface FilterByAreaMessage {
  type: "FILTER_BY_AREA";
  id: number;
  data: FeatureCollection;
  minArea: number;
}

interface FilteredResponse {
  type: "FILTERED";
  id: number;
  result: FeatureCollection;
}

type WorkerMessage = FilterByAreaMessage;
type WorkerResponse = FilteredResponse;

function filterByArea(data: FeatureCollection, minArea: number): FeatureCollection {
  if (minArea <= 0) return data;
  return {
    ...data,
    features: data.features.filter((f) => {
      const area = (f.properties?._areaSqKm as number) ?? 0;
      return area >= minArea;
    }),
  };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "FILTER_BY_AREA": {
      const result = filterByArea(msg.data, msg.minArea);
      const response: WorkerResponse = { type: "FILTERED", id: msg.id, result };
      self.postMessage(response, self.location.origin);
      break;
    }
  }
};

// Make it a module
