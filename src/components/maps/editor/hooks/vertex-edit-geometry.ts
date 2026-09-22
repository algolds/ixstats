import type { Polygon, MultiPolygon, Position, Feature } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import {
  getAllRings,
  clampToGeometry,
  snapPointToGeometries,
} from "~/lib/maps/border-editor";
import { snapToLayerFeatures } from "../utils/map-helpers";

export interface CalculateSnapTargetOptions {
  coords: [number, number];
  snapEnabled: boolean;
  snapTolerance: number;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  border: Polygon | MultiPolygon | null;
  features: EditorFeature[];
  editingFeatureId: string;
  snapPointGuide?: (coords: [number, number]) => [number, number];
}

export interface SnapTargetResult {
  target: Position;
  didSnap: boolean;
  origTarget: Position;
}

/**
 * Calculates a snapped coordinate position across visible background layers,
 * country boundary clipping, neighbor subdivision geometries, and guide lines.
 */
export function calculateSnapTarget({
  coords,
  snapEnabled,
  snapTolerance,
  worldMapLayers,
  editorVisibleLayers,
  border,
  features,
  editingFeatureId,
  snapPointGuide,
}: CalculateSnapTargetOptions): SnapTargetResult {
  let target: Position = [coords[0], coords[1]];
  const origTarget: Position = [coords[0], coords[1]];

  if (snapEnabled && worldMapLayers && editorVisibleLayers) {
    target = snapToLayerFeatures(
      target as [number, number],
      worldMapLayers,
      editorVisibleLayers,
      snapTolerance
    );
  }

  if (border) {
    target = clampToGeometry(target, border);
  }

  if (snapEnabled) {
    const snapGeoms: (Polygon | MultiPolygon)[] = [];
    if (border) {
      snapGeoms.push(border);
    }
    for (const feat of features) {
      if (feat.type === "subdivision" && feat.id !== editingFeatureId && feat.geometry) {
        snapGeoms.push(feat.geometry as Polygon | MultiPolygon);
      }
    }
    target = snapPointToGeometries(target, snapGeoms, snapTolerance);
  }

  if (snapEnabled && snapPointGuide) {
    target = snapPointGuide(target as [number, number]);
  }

  const didSnap = target[0] !== origTarget[0] || target[1] !== origTarget[1];
  return { target, didSnap, origTarget };
}

/**
 * Extracts neighbor subdivision geometries excluding the actively edited feature.
 */
export function buildNeighborGeometries(
  features: EditorFeature[],
  editingId: string
): Array<{ id: string; geometry: Polygon | MultiPolygon }> {
  const result: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
  for (const feat of features) {
    if (feat.type === "subdivision" && feat.id !== editingId && feat.geometry) {
      result.push({
        id: feat.id,
        geometry: feat.geometry as Polygon | MultiPolygon,
      });
    }
  }
  return result;
}

/**
 * Generates GeoJSON point features for all polygon edge midpoints (used for add-vertex handles).
 */
export function buildMidpointFeatures(geo: Polygon | MultiPolygon): Feature[] {
  const rings = getAllRings(geo);
  const midFeatures: Feature[] = [];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]!;
    const len = ring.length;
    for (let i = 0; i < len - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      midFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        },
        properties: { ringIndex: ri, startIndex: i },
      });
    }
  }
  return midFeatures;
}
