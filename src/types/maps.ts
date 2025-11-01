/**
 * Maps System Type Definitions
 *
 * Type definitions for the IxStats map system including projections,
 * layer states, and debugging information.
 */

/**
 * Supported map projection types
 *
 * - mercator: Web Mercator (EPSG:3857) - default flat projection
 * - globe: 3D globe view using MapLibre globe projection
 * - equalEarth: Equal Earth projection (equal-area, via plugin)
 * - naturalEarth: Natural Earth projection (not yet implemented)
 * - ixmaps: IxMaps custom linear projection (not yet implemented)
 */
export type ProjectionType = 'mercator' | 'globe' | 'equalEarth' | 'naturalEarth' | 'ixmaps';

/**
 * Layer visibility state
 * Controls which map layers are visible on the map
 */
export interface LayerState {
  showAltitudes: boolean;
  showLakes: boolean;
  showRivers: boolean;
  showIcecaps: boolean;
  showPolitical: boolean;
}

/**
 * Map debugging information
 * Used by MapDebugPanel to display technical details
 */
export interface MapDebugInfo {
  zoom: number;
  center: [number, number];
  projection: ProjectionType;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  layersLoaded: string[];
  selectedCountry: string | null;
  visibleLayers: string[];
  tileLayerCount: number;
  tileCount?: number;
  renderTime?: number;
}

/**
 * Projection metadata
 * Information about each projection's characteristics
 */
export interface ProjectionMetadata {
  name: string;
  type: 'cylindrical' | 'pseudocylindrical' | 'azimuthal' | 'perspective' | 'custom';
  preserves: 'shapes' | 'areas' | 'distances' | 'all' | 'none';
  distortion: 'none' | 'minimal' | 'medium' | 'high';
  bestFor: string[];
  supported: boolean;
  requiresPlugin?: boolean;
}

/**
 * Projection metadata map
 */
export const PROJECTION_METADATA: Record<ProjectionType, ProjectionMetadata> = {
  mercator: {
    name: 'Web Mercator',
    type: 'cylindrical',
    preserves: 'shapes',
    distortion: 'high',
    bestFor: ['navigation', 'web maps', 'street maps'],
    supported: true,
  },
  globe: {
    name: 'Globe (3D)',
    type: 'perspective',
    preserves: 'all',
    distortion: 'none',
    bestFor: ['world view', 'education', 'spatial relationships'],
    supported: true,
  },
  equalEarth: {
    name: 'Equal Earth',
    type: 'pseudocylindrical',
    preserves: 'areas',
    distortion: 'minimal',
    bestFor: ['data visualization', 'thematic maps', 'area comparison'],
    supported: true, // Server-side tile generation via PostGIS + Martin
    requiresPlugin: false,
  },
  naturalEarth: {
    name: 'Natural Earth',
    type: 'pseudocylindrical',
    preserves: 'none',
    distortion: 'minimal',
    bestFor: ['world maps', 'general reference', 'aesthetics'],
    supported: true, // Server-side tile generation via PostGIS + Martin
  },
  ixmaps: {
    name: 'IxMaps Linear',
    type: 'custom',
    preserves: 'none',
    distortion: 'medium',
    bestFor: ['IxEarth visualization', 'custom coordinate system'],
    supported: true, // Server-side tile generation via PostGIS + Martin
  },
};
