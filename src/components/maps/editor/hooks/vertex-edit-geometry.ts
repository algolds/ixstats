import type { Polygon, MultiPolygon, Position, Feature } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import {
  getAllRings,
  clampToGeometry,
  snapPointToGeometries,
  snapToNeighborBorders,
} from "~/lib/maps/border-editor";
import {
  findNearestBorderRing,
  snapGeometryToBorder,
} from "~/lib/maps/province-importer/alignment";
import { withoutDisabledSnapLayers } from "~/lib/maps/editor-prefs";
import { midpointFeatures, snapToLayerFeatures } from "../utils/map-helpers";

interface CalculateSnapTargetOptions {
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

interface SnapTargetResult {
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
      withoutDisabledSnapLayers(editorVisibleLayers),
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
  return getAllRings(geo).flatMap((ring, ringIndex) =>
    midpointFeatures(ring, (startIndex) => ({ ringIndex, startIndex }))
  );
}

/** Snaps a region's edges onto the stretch of country border it lies along. */
export function snapToCountryBorderRing(
  geo: Polygon | MultiPolygon,
  border: Polygon | MultiPolygon,
  tolerance = 0.015
): Polygon | MultiPolygon {
  const ring = findNearestBorderRing(geo, border);
  const edges = ring.slice(1).map((end, i): [Position, Position] => [ring[i]!, end]);
  return snapGeometryToBorder(geo, edges, ring, tolerance);
}

/** Snaps a region's shared edges onto the neighbouring regions' borders. */
export function snapToNeighbors(
  geo: Polygon | MultiPolygon,
  features: EditorFeature[],
  editingId: string,
  border: Polygon | MultiPolygon
): Polygon | MultiPolygon {
  const neighbors = buildNeighborGeometries(features, editingId);
  return neighbors.length > 0 ? snapToNeighborBorders(geo, neighbors, border, 0.015) : geo;
}
