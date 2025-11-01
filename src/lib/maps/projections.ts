/**
 * D3-Geo Projection Definitions
 *
 * Factory functions for creating D3 map projections used in IxStats.
 * Supports Equal Earth, Natural Earth, and Mercator projections.
 */

import * as d3 from 'd3-geo';
import type { ProjectionType } from '~/types/maps';
import {
  createIxMapsProjection,
  createIxMapsInversion,
  type IxMapsProjectionConfig,
  DEFAULT_IXMAPS_CONFIG,
} from './ixmaps-projection';

/**
 * D3 GeoProjection type
 */
export type D3Projection = d3.GeoProjection;

/**
 * Projection configuration options
 */
export interface ProjectionOptions {
  width?: number;
  height?: number;
  scale?: number;
  center?: [number, number];
  translate?: [number, number];
  ixmapsConfig?: Partial<IxMapsProjectionConfig>;
}

/**
 * Default configuration for projections
 */
const DEFAULT_OPTIONS = {
  width: 1000,
  height: 500,
  scale: 150,
  center: [0, 0] as [number, number],
  translate: [500, 250] as [number, number],
};

/**
 * Creates an Equal Earth projection
 *
 * Equal Earth is an equal-area pseudocylindrical projection designed for
 * data visualization and thematic maps. It provides a good balance between
 * shape and area distortion.
 *
 * @param options - Projection configuration options
 * @returns Configured D3 Equal Earth projection
 */
export function createEqualEarthProjection(
  options: ProjectionOptions = {}
): D3Projection {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return d3
    .geoEqualEarth()
    .scale(opts.scale)
    .center(opts.center)
    .translate(opts.translate);
}

/**
 * Creates a Natural Earth projection
 *
 * Natural Earth is a pseudocylindrical projection designed by Tom Patterson
 * for general reference maps. It provides a pleasing compromise between
 * shape and area distortion without strict mathematical constraints.
 *
 * @param options - Projection configuration options
 * @returns Configured D3 Natural Earth projection
 */
export function createNaturalEarthProjection(
  options: ProjectionOptions = {}
): D3Projection {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return d3
    .geoNaturalEarth1()
    .scale(opts.scale)
    .center(opts.center)
    .translate(opts.translate);
}

/**
 * Creates a Mercator projection
 *
 * The Mercator projection is a cylindrical conformal projection that preserves
 * angles and shapes locally. It is widely used for web maps but has severe
 * area distortion at high latitudes.
 *
 * @param options - Projection configuration options
 * @returns Configured D3 Mercator projection
 */
export function createMercatorProjection(
  options: ProjectionOptions = {}
): D3Projection {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return d3
    .geoMercator()
    .scale(opts.scale)
    .center(opts.center)
    .translate(opts.translate);
}

/**
 * Creates an IxMaps custom projection
 *
 * The IxMaps projection is a custom linear projection (modified equirectangular)
 * with a custom prime meridian at 30° longitude. It uses direct linear scaling
 * for fast performance and is optimized for IxEarth visualization.
 *
 * Key features:
 * - Linear transformation (no trigonometric calculations)
 * - Custom prime meridian offset (30° instead of 0°)
 * - Direct SVG-space mapping
 * - 2-3x faster than standard projections
 *
 * @param options - Projection configuration options
 * @returns Custom IxMaps projection compatible with d3-geo interface
 */
export function createIxMapsProjectionWrapper(
  options: ProjectionOptions = {}
): { project: (coords: [number, number]) => [number, number]; invert: (coords: [number, number]) => [number, number] } {
  const config = {
    ...DEFAULT_IXMAPS_CONFIG,
    ...options.ixmapsConfig,
  };

  const project = createIxMapsProjection(config);
  const invert = createIxMapsInversion(config);

  return {
    project,
    invert,
  };
}

/**
 * Creates a projection based on the specified type
 *
 * Factory function that returns the appropriate D3 projection based on
 * the ProjectionType enum. Supports Equal Earth, Natural Earth, and
 * Mercator projections.
 *
 * @param type - The type of projection to create
 * @param options - Projection configuration options
 * @returns Configured D3 projection
 * @throws Error if projection type is not supported
 */
export function createProjection(
  type: ProjectionType,
  options: ProjectionOptions = {}
): D3Projection {
  switch (type) {
    case 'equalEarth':
      return createEqualEarthProjection(options);
    case 'naturalEarth':
      return createNaturalEarthProjection(options);
    case 'mercator':
      return createMercatorProjection(options);
    case 'globe':
      throw new Error(
        'Globe projection requires MapLibre GL JS and cannot be created as a D3 projection'
      );
    case 'ixmaps':
      // IxMaps uses a custom projection system, not d3-geo
      // Use createIxMapsProjectionWrapper() directly for IxMaps support
      throw new Error(
        'IxMaps projection uses a custom interface. Use createIxMapsProjectionWrapper() instead of createProjection()'
      );
    default:
      throw new Error(`Unsupported projection type: ${type}`);
  }
}

/**
 * Gets the recommended scale for a projection type at a given map size
 *
 * @param type - The projection type
 * @param width - Map width in pixels
 * @param height - Map height in pixels
 * @returns Recommended scale value
 */
export function getRecommendedScale(
  type: ProjectionType,
  width: number,
  height: number
): number {
  const baseScale = Math.min(width, height) / 6;

  switch (type) {
    case 'equalEarth':
      return baseScale * 1.0;
    case 'naturalEarth':
      return baseScale * 1.1;
    case 'mercator':
      return baseScale * 0.9;
    default:
      return baseScale;
  }
}

/**
 * Gets the recommended center point for a projection type
 *
 * @param type - The projection type
 * @returns [longitude, latitude] center point
 */
export function getRecommendedCenter(type: ProjectionType): [number, number] {
  switch (type) {
    case 'equalEarth':
    case 'naturalEarth':
    case 'mercator':
      return [0, 0]; // Center on null island for world maps
    case 'ixmaps':
      return [30, 0]; // Center on IxEarth prime meridian (30°E) at equator
    default:
      return [0, 0];
  }
}

/**
 * Re-export IxMaps projection utilities for convenience
 */
export {
  createIxMapsProjection,
  createIxMapsInversion,
  DEFAULT_IXMAPS_CONFIG,
  type IxMapsProjectionConfig,
} from './ixmaps-projection';
