/**
 * D3-Geo Projection Transformer
 *
 * Core transformation utilities for converting geographic coordinates
 * to projected coordinates using D3 projections. Handles various
 * GeoJSON geometry types.
 */

import type { D3Projection } from './projections';

/**
 * GeoJSON coordinate types
 */
export type Coordinate = [number, number];
export type CoordinateArray = Coordinate[];
export type CoordinateArrayArray = CoordinateArray[];
export type CoordinateArrayArrayArray = CoordinateArrayArray[];

/**
 * Transformation error types
 */
export class ProjectionTransformError extends Error {
  constructor(message: string, public readonly coordinate?: Coordinate) {
    super(message);
    this.name = 'ProjectionTransformError';
  }
}

/**
 * Transforms a single coordinate using a D3 projection
 *
 * @param coordinate - [longitude, latitude] coordinate pair
 * @param projection - D3 projection function
 * @returns [x, y] projected coordinate pair or null if unprojectable
 * @throws ProjectionTransformError if coordinate is invalid
 */
export function transformCoordinate(
  coordinate: Coordinate,
  projection: D3Projection
): Coordinate | null {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) {
    throw new ProjectionTransformError(
      'Invalid coordinate: must be [lng, lat] array',
      coordinate
    );
  }

  const [lng, lat] = coordinate;

  if (typeof lng !== 'number' || typeof lat !== 'number') {
    throw new ProjectionTransformError(
      'Invalid coordinate: longitude and latitude must be numbers',
      coordinate
    );
  }

  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new ProjectionTransformError(
      `Invalid coordinate: longitude must be [-180, 180], latitude must be [-90, 90]. Got: [${lng}, ${lat}]`,
      coordinate
    );
  }

  const projected = projection(coordinate);
  return projected ?? null;
}

/**
 * Transforms an array of coordinates using a D3 projection
 *
 * @param coordinates - Array of [longitude, latitude] coordinate pairs
 * @param projection - D3 projection function
 * @returns Array of [x, y] projected coordinates (null entries filtered out)
 */
export function transformCoordinates(
  coordinates: CoordinateArray,
  projection: D3Projection
): CoordinateArray {
  return coordinates
    .map((coord) => transformCoordinate(coord, projection))
    .filter((coord): coord is Coordinate => coord !== null);
}

/**
 * Transforms a nested array of coordinates (for Polygons)
 *
 * @param coordinates - Array of coordinate arrays
 * @param projection - D3 projection function
 * @returns Array of projected coordinate arrays
 */
export function transformCoordinateArrays(
  coordinates: CoordinateArrayArray,
  projection: D3Projection
): CoordinateArrayArray {
  return coordinates.map((coordArray) =>
    transformCoordinates(coordArray, projection)
  );
}

/**
 * Transforms a deeply nested array of coordinates (for MultiPolygons)
 *
 * @param coordinates - Array of arrays of coordinate arrays
 * @param projection - D3 projection function
 * @returns Array of arrays of projected coordinate arrays
 */
export function transformCoordinateArrayArrays(
  coordinates: CoordinateArrayArrayArray,
  projection: D3Projection
): CoordinateArrayArrayArray {
  return coordinates.map((coordArrayArray) =>
    transformCoordinateArrays(coordArrayArray, projection)
  );
}

/**
 * Transforms a GeoJSON geometry using a D3 projection
 *
 * Handles Point, LineString, Polygon, MultiPoint, MultiLineString,
 * and MultiPolygon geometries. GeometryCollections are recursively processed.
 *
 * @param geometry - GeoJSON geometry object
 * @param projection - D3 projection function
 * @returns Transformed GeoJSON geometry
 * @throws ProjectionTransformError if geometry type is unsupported
 */
export function transformGeometry(
  geometry: GeoJSON.Geometry,
  projection: D3Projection
): GeoJSON.Geometry {
  switch (geometry.type) {
    case 'Point': {
      const transformed = transformCoordinate(geometry.coordinates as Coordinate, projection);
      if (!transformed) {
        throw new ProjectionTransformError(
          'Point coordinate could not be projected',
          geometry.coordinates as Coordinate
        );
      }
      return {
        type: 'Point',
        coordinates: transformed,
      };
    }

    case 'LineString': {
      return {
        type: 'LineString',
        coordinates: transformCoordinates(
          geometry.coordinates as CoordinateArray,
          projection
        ),
      };
    }

    case 'Polygon': {
      return {
        type: 'Polygon',
        coordinates: transformCoordinateArrays(
          geometry.coordinates as CoordinateArrayArray,
          projection
        ),
      };
    }

    case 'MultiPoint': {
      return {
        type: 'MultiPoint',
        coordinates: transformCoordinates(
          geometry.coordinates as CoordinateArray,
          projection
        ),
      };
    }

    case 'MultiLineString': {
      return {
        type: 'MultiLineString',
        coordinates: transformCoordinateArrays(
          geometry.coordinates as CoordinateArrayArray,
          projection
        ),
      };
    }

    case 'MultiPolygon': {
      return {
        type: 'MultiPolygon',
        coordinates: transformCoordinateArrayArrays(
          geometry.coordinates as CoordinateArrayArrayArray,
          projection
        ),
      };
    }

    case 'GeometryCollection': {
      return {
        type: 'GeometryCollection',
        geometries: geometry.geometries.map((geom) =>
          transformGeometry(geom, projection)
        ),
      };
    }

    default:
      throw new ProjectionTransformError(
        `Unsupported geometry type: ${(geometry as GeoJSON.Geometry).type}`
      );
  }
}

/**
 * Transforms a GeoJSON Feature using a D3 projection
 *
 * @param feature - GeoJSON Feature object
 * @param projection - D3 projection function
 * @returns Transformed GeoJSON Feature
 */
export function transformFeature(
  feature: GeoJSON.Feature,
  projection: D3Projection
): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: transformGeometry(feature.geometry, projection),
    id: feature.id,
  };
}

/**
 * Transforms a GeoJSON FeatureCollection using a D3 projection
 *
 * @param featureCollection - GeoJSON FeatureCollection object
 * @param projection - D3 projection function
 * @returns Transformed GeoJSON FeatureCollection
 */
export function transformFeatureCollection(
  featureCollection: GeoJSON.FeatureCollection,
  projection: D3Projection
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: featureCollection.features.map((feature) =>
      transformFeature(feature, projection)
    ),
  };
}

/**
 * Transforms any GeoJSON object using a D3 projection
 *
 * @param geojson - GeoJSON object (Geometry, Feature, or FeatureCollection)
 * @param projection - D3 projection function
 * @returns Transformed GeoJSON object
 * @throws ProjectionTransformError if GeoJSON type is unsupported
 */
export function transformGeoJSON(
  geojson: GeoJSON.GeoJSON,
  projection: D3Projection
): GeoJSON.GeoJSON {
  if (geojson.type === 'FeatureCollection') {
    return transformFeatureCollection(geojson, projection);
  }

  if (geojson.type === 'Feature') {
    return transformFeature(geojson, projection);
  }

  // Must be a Geometry type
  return transformGeometry(geojson as GeoJSON.Geometry, projection);
}

/**
 * Checks if a coordinate is valid for transformation
 *
 * @param coordinate - Coordinate to validate
 * @returns True if coordinate is valid
 */
export function isValidCoordinate(coordinate: Coordinate): boolean {
  if (!Array.isArray(coordinate) || coordinate.length !== 2) {
    return false;
  }

  const [lng, lat] = coordinate;

  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return false;
  }

  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Safely transforms a coordinate, returning null on error
 *
 * @param coordinate - [longitude, latitude] coordinate pair
 * @param projection - D3 projection function
 * @returns [x, y] projected coordinate or null if transformation fails
 */
export function safeTransformCoordinate(
  coordinate: Coordinate,
  projection: D3Projection
): Coordinate | null {
  try {
    return transformCoordinate(coordinate, projection);
  } catch {
    return null;
  }
}
