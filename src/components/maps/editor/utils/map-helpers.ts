import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import {
  getAllRings,
  rebuildGeometry,
  projectPointToSegment,
  distanceDeg,
} from "~/lib/maps/border-editor";
import { distanceKm } from "~/lib/maps/geo-math";
import { SNAP_LAYER_TYPES } from "~/lib/maps/editor-prefs";

export const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as Feature[] };

export const pointFeature = (
  coordinates: Position,
  properties: GeoJsonProperties = {}
): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});

export const lineFeature = (
  coordinates: Position[],
  properties: GeoJsonProperties = {}
): Feature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates },
  properties,
});

/** A point at the middle of each consecutive pair of coordinates. */
export function midpointFeatures<P extends Position>(
  points: P[],
  toProperties: (index: number, a: P, b: P) => GeoJsonProperties
): Feature[] {
  return points.slice(1).map((b, i) => {
    const a = points[i]!;
    return pointFeature([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], toProperties(i, a, b));
  });
}

export const collection = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

/** Point features for every feature that has coordinates, with the label/marker style properties. */
export function buildPointFeatures(
  features: EditorFeature[],
  override?: { id: string; coordinates: [number, number] }
) {
  return features
    .filter((f) => f.coordinates)
    .map((f) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: override?.id === f.id ? override.coordinates : f.coordinates!,
      },
      properties: {
        id: f.id,
        name: f.name,
        featureType: f.type,
        isCapital: f.properties.isNationalCapital ?? false,
        rotation: Number(f.properties.rotation) || 0,
        opacity: f.properties.opacity !== undefined ? Number(f.properties.opacity) : 1,
        color: f.properties.color || "#374151",
        fontSize: Number(f.properties.fontSize) || 11,
        fontWeight: f.properties.fontWeight || "normal",
        letterSpacing: Number(f.properties.letterSpacing) || 0,
      },
    }));
}

const SNAP_GUIDE_SOURCE = "editor-snap-guide";
const SNAP_GUIDE_LAYERS: SourcelessLayer[] = [
  {
    id: "editor-snap-guide-line",
    type: "line",
    paint: {
      "line-color": "#06b6d4",
      "line-width": 1.5,
      "line-dasharray": [3, 3],
      "line-opacity": 0.8,
    },
  },
  {
    id: "editor-snap-guide-point",
    type: "circle",
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": 5,
      "circle-color": "#06b6d4",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  },
];

export function getGeoJSONSource(map: MapLibreMap | null, id: string): GeoJSONSource | undefined {
  if (!map) return;
  try {
    return map.getSource(id) as GeoJSONSource;
  } catch {
    return undefined;
  }
}

export type SourcelessLayer = LayerSpecification extends infer L
  ? L extends unknown
    ? Omit<L, "source">
    : never
  : never;

/** First call adds the GeoJSON source and its layers (in order); later calls only replace the data. */
export function upsertGeoJSONLayers(
  map: MapLibreMap,
  sourceId: string,
  data: GeoJSON.GeoJSON,
  layers: SourcelessLayer[]
) {
  if (map.getSource(sourceId)) {
    getGeoJSONSource(map, sourceId)?.setData(data);
    return;
  }
  map.addSource(sourceId, { type: "geojson", data });
  for (const layer of layers) map.addLayer({ ...layer, source: sourceId } as LayerSpecification);
}

type OpacityProperty = "fill-opacity" | "line-opacity" | "circle-opacity" | "text-opacity";

/** Sets a paint opacity on a layer if it exists. */
export function setLayerOpacity(
  map: MapLibreMap,
  layerId: string,
  property: OpacityProperty,
  value: number
) {
  if (map.getLayer(layerId)) map.setPaintProperty(layerId, property as "line-opacity", value);
}

/**
 * Safely parses an untyped object / JsonValue into a GeoJSON Polygon or MultiPolygon.
 */
export function toPolygonGeometry(geom: object | null | undefined): Polygon | MultiPolygon | null {
  if (!geom || Array.isArray(geom)) return null;
  const obj = geom as { type?: string; coordinates?: Position[][] | Position[][][] };
  if ((obj.type === "Polygon" || obj.type === "MultiPolygon") && Array.isArray(obj.coordinates)) {
    return obj as Polygon | MultiPolygon;
  }
  return null;
}

/** The vertex run of a route geometry (a LineString, or every part of a MultiLineString). */
export function routeVertices(geometry: Geometry | null | undefined): [number, number][] {
  if (geometry?.type === "LineString") return geometry.coordinates as [number, number][];
  if (geometry?.type === "MultiLineString")
    return geometry.coordinates.flat() as [number, number][];
  return [];
}

export function getFeatureCoords(geometry: Geometry): Position | undefined {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "MultiPoint") return geometry.coordinates[0];
  return undefined;
}

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function getGenericBBox(
  geom: (Geometry & { _bbox?: BoundingBox }) | null | undefined
): BoundingBox {
  if (!geom) return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
  if (geom._bbox) return geom._bbox;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const processCoords = (coords: Position | Position[] | Position[][] | Position[][][]) => {
    if (!coords) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) {
        processCoords(coords[i] as Position | Position[] | Position[][]);
      }
    }
  };

  if ("coordinates" in geom) {
    processCoords(geom.coordinates as Position | Position[] | Position[][]);
  }
  const bbox: BoundingBox = { minLng, minLat, maxLng, maxLat };
  geom._bbox = bbox;
  return bbox;
}

/**
 * Calculate overlap GeoJSON between a drawn geometry and other subdivisions
 */
export function calculateOverlapGeoJson(
  drawnGeom:
    (Geometry & { coordinates?: Position[][] | Position[][][] }) | Feature | null | undefined,
  allFeatures: EditorFeature[],
  currentFeatureId?: string
) {
  if (!drawnGeom) {
    return EMPTY_FC;
  }
  const geom =
    drawnGeom.type === "Feature"
      ? (drawnGeom.geometry as Polygon | MultiPolygon)
      : (drawnGeom as Polygon | MultiPolygon);

  const coords = geom && "coordinates" in geom ? geom.coordinates : undefined;

  if (!coords || (Array.isArray(coords) && coords.length === 0)) {
    return EMPTY_FC;
  }

  const overlapFeatures: Feature[] = [];
  try {
    const turfDrawn: Feature<Polygon | MultiPolygon> =
      drawnGeom.type === "Feature"
        ? (drawnGeom as Feature<Polygon | MultiPolygon>)
        : {
            type: "Feature",
            geometry: geom,
            properties: {},
          };

    const otherSubdivisions = allFeatures.filter((f) => {
      if (f.type !== "subdivision" || f.id === currentFeatureId || !f.geometry) return false;
      const g = f.geometry as Polygon | MultiPolygon;
      return g.coordinates && g.coordinates.length > 0;
    });

    const drawnBBox = getGenericBBox(geom);

    for (const sub of otherSubdivisions) {
      const subGeom = sub.geometry as Polygon | MultiPolygon;
      const subBBox = getGenericBBox(subGeom);

      // Skip heavy turf intersection if bounding boxes do not overlap at all
      if (
        drawnBBox.minLng > subBBox.maxLng ||
        drawnBBox.maxLng < subBBox.minLng ||
        drawnBBox.minLat > subBBox.maxLat ||
        drawnBBox.maxLat < subBBox.minLat
      ) {
        continue;
      }

      const turfSub: Feature<Polygon | MultiPolygon> = {
        type: "Feature",
        geometry: subGeom,
        properties: {},
      };

      const intersection = intersect(featureCollection([turfDrawn, turfSub]));
      if (intersection && intersection.geometry) {
        overlapFeatures.push(intersection);
      }
    }
  } catch (err) {
    console.warn("[calculateOverlapGeoJson] Error calculating turf overlap:", err);
  }

  return {
    type: "FeatureCollection" as const,
    features: overlapFeatures,
  };
}

/** Shows (or, with null ends, clears) a snap guide between the drag origin and its snap target. */
export function updateSnapGuide(map: MapLibreMap, from: Position | null, to: Position | null) {
  const fc = collection(from && to ? [lineFeature([from, to]), pointFeature(to)] : []);

  upsertGeoJSONLayers(map, SNAP_GUIDE_SOURCE, fc, SNAP_GUIDE_LAYERS);
}

export const haversineDistance = distanceKm;

/** Every coordinate run (line or ring) a geometry is made of. */
function coordinateRuns(geom: Geometry): Position[][] {
  switch (geom.type) {
    case "LineString":
      return [geom.coordinates];
    case "MultiLineString":
    case "Polygon":
      return geom.coordinates;
    case "MultiPolygon":
      return geom.coordinates.flat();
    default:
      return [];
  }
}

/** Cached bbox of a layer feature (stored on the feature itself). */
function featureBBox(feature: Feature, geom: Geometry): BoundingBox {
  const cached = feature as Feature & { _bbox?: BoundingBox };
  cached._bbox ??= getGenericBBox(geom);
  return cached._bbox;
}

/**
 * Snap a coordinate point to visible background features (rivers, lakes, coastline,
 * elevation contour, climate zones). Only layer types present in `visibleLayers` are used.
 */
export function snapToLayerFeatures(
  point: [number, number],
  worldMapLayers: MapLayerData[] | undefined,
  visibleLayers: Set<string>,
  tolerance: number = 0.015
): [number, number] {
  if (!worldMapLayers) return point;

  let bestDist = Infinity;
  let bestProj: [number, number] = point;

  for (const layerType of SNAP_LAYER_TYPES) {
    if (!visibleLayers.has(layerType)) continue;
    const features = worldMapLayers.find((l) => l.type === layerType)?.data?.features ?? [];

    for (const feature of features) {
      const geom = feature.geometry;
      if (!geom) continue;

      // Skip distance checks if point is not within tolerance of feature's bounding box
      const bbox = featureBBox(feature, geom);
      if (
        point[0] < bbox.minLng - tolerance ||
        point[0] > bbox.maxLng + tolerance ||
        point[1] < bbox.minLat - tolerance ||
        point[1] > bbox.maxLat + tolerance
      ) {
        continue;
      }

      for (const run of coordinateRuns(geom)) {
        for (let i = 0; i < run.length - 1; i++) {
          const proj = projectPointToSegment(point, run[i] as Position, run[i + 1] as Position);
          const d = distanceDeg(point, proj);
          if (d < bestDist && d <= tolerance) {
            bestDist = d;
            bestProj = proj as [number, number];
          }
        }
      }
    }
  }

  return bestDist <= tolerance ? bestProj : point;
}

/**
 * Snap all rings/vertices of a polygon geometry to visible background layers.
 */
export function snapGeometryToBackgroundLayers(
  geometry: Polygon | MultiPolygon,
  worldMapLayers: MapLayerData[] | undefined,
  visibleLayers: Set<string>,
  tolerance: number = 0.015
): Polygon | MultiPolygon {
  if (!worldMapLayers || !visibleLayers || visibleLayers.size === 0) return geometry;

  const rings = getAllRings(geometry);
  const newRings: Position[][] = [];

  for (const ring of rings) {
    const newRing: Position[] = [];
    for (const pt of ring) {
      const snapped = snapToLayerFeatures(
        pt as [number, number],
        worldMapLayers,
        visibleLayers,
        tolerance
      );
      newRing.push(snapped);
    }
    if (newRing.length > 0) {
      const first = newRing[0]!;
      const last = newRing[newRing.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        newRing.push([...first] as Position);
      }
    }
    newRings.push(newRing);
  }

  return rebuildGeometry(geometry, newRings);
}
