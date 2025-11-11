import type { StyleSpecification } from 'maplibre-gl';
import { MAPLIBRE_CONFIG } from '~/lib/ixearth-constants';
import type { ProjectionType } from '~/types/maps';

/**
 * Generate GeoJSON for latitude/longitude grid lines (graticule)
 */
function generateGraticule() {
  const features = [];

  // Generate latitude lines (horizontal, -80 to 80 degrees, every 20 degrees)
  for (let lat = -80; lat <= 80; lat += 20) {
    const coordinates = [];
    for (let lon = -180; lon <= 180; lon += 5) {
      coordinates.push([lon, lat]);
    }
    features.push({
      type: 'Feature',
      properties: {
        type: lat === 0 ? 'equator' : 'latitude',
        value: lat
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    });
  }

  // Generate longitude lines (vertical, -180 to 180 degrees, every 20 degrees)
  for (let lon = -180; lon <= 180; lon += 20) {
    const coordinates = [];
    for (let lat = -85; lat <= 85; lat += 5) {
      coordinates.push([lon, lat]);
    }
    features.push({
      type: 'Feature',
      properties: {
        type: 'longitude',
        value: lon
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Generate source configuration for a given layer and projection
 * Custom projections use GeoJSON with D3 transformation
 * Standard projections use vector tiles
 */
function getLayerSource(
  layer: string,
  projection: ProjectionType,
  origin: string,
  basePath: string
): any {
  const customProjection = ['equalEarth', 'naturalEarth', 'ixmaps'].includes(projection);
  const cleanBasePath = basePath.replace(/\/$/, '');

  if (customProjection) {
    // Use GeoJSON source with server-side D3 transformation
    return {
      type: 'geojson',
      data: `${origin}${cleanBasePath}/api/geojson/${projection}/${layer}`,
    };
  } else {
    // Use vector tiles for mercator/globe
    // Use logical layer names - the API route will map to Martin table names
    return {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/${layer}/{z}/{x}/{y}`],
      minzoom: layer === 'rivers' ? 3 : MAPLIBRE_CONFIG.tileMinZoom,
      maxzoom: MAPLIBRE_CONFIG.tileMaxZoom,
    };
  }
}

export const createGoogleMapsStyle = (
  basePath: string = '',
  mapType: 'map' | 'climate' | 'terrain' = 'map',
  projection: ProjectionType = 'globe'
): StyleSpecification => {
  // Ensure base path doesn't have trailing slash and construct full URLs
  const cleanBasePath = basePath.replace(/\/$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Determine if we're using GeoJSON (custom projections) or vector tiles (mercator/globe)
  const useGeoJSON = ['equalEarth', 'naturalEarth', 'ixmaps'].includes(projection);

  console.log('[google-map-style] Creating style:', { projection, useGeoJSON, basePath: cleanBasePath });

  const style = {
  version: 8 as const,
  projection: { type: projection === 'globe' ? 'globe' : 'mercator' },
  sky: {
    'sky-color': '#e8f4f8',  // Very light blue-white to blend with ice caps
    'horizon-color': '#ffffff',  // White horizon
    'sky-horizon-blend': 0.8,  // High blend to soften transitions
    'atmosphere-blend': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 0.95,  // Strong atmosphere at far zoom (masks pole artifacts)
      3, 0.6,
      6, 0.2,
      8, 0   // Minimal atmosphere at close zoom
    ] as any,
  },
  sources: {
    graticule: {
      type: 'geojson',
      data: generateGraticule() as any,
    },
    political: getLayerSource('political', projection, origin, cleanBasePath),
    // Dedicated labels source for vector tiles (mercator/globe)
    // Uses point geometries at centroids for clean, deduplicated labels
    ...(useGeoJSON ? {} : {
      'political-labels': {
        type: 'geojson',
        data: `${origin}${cleanBasePath}/api/geojson/labels/political`,
      }
    }),
    altitudes: getLayerSource('altitudes', projection, origin, cleanBasePath),
    lakes: getLayerSource('lakes', projection, origin, cleanBasePath),
    rivers: getLayerSource('rivers', projection, origin, cleanBasePath),
    // Rivers polygons source - ALWAYS add for proper polygon rendering
    'rivers-polygons': {
      type: 'geojson',
      data: `${origin}${cleanBasePath}/api/geojson/rivers-polygons`,
    },
    climate: getLayerSource('climate', projection, origin, cleanBasePath),
    icecaps: getLayerSource('icecaps', projection, origin, cleanBasePath),
  },
  layers: [
    // Ocean/water background (Google Maps blue)
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#a5d8f3',
      },
    },
    // Graticule (lat/lon grid lines) - Google Maps style
    {
      id: 'graticule',
      type: 'line',
      source: 'graticule',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'type'], 'equator'],
          '#b0b0b0', // Slightly darker for equator
          '#d0d0d0'  // Light gray for other lines
        ],
        'line-width': [
          'case',
          ['==', ['get', 'type'], 'equator'],
          0.8,  // Slightly thicker equator
          0.5   // Thin grid lines
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.3,   // Subtle at far zoom
          2, 0.4,   // More visible at default view
          4, 0.5,   // Clear at closer zoom
          8, 0.2    // Fade out at very close zoom
        ],
      },
    },
    // Terrain/land with elevation colors
    {
      id: 'terrain',
      type: 'fill',
      source: 'altitudes',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_altitudes' }),
      paint: {
        'fill-color': ['coalesce', ['get', 'fill'], '#ececec'],
        'fill-opacity': (mapType === 'terrain' || mapType === 'climate') ? 1 : 0, // Visible in terrain/climate modes
        'fill-outline-color': 'transparent', // Hide polygon edges to prevent seam artifacts
      },
    },
    // Ice caps (imprinted on globe with terrain)
    {
      id: 'icecaps-fill',
      type: 'fill',
      source: 'icecaps',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_icecaps' }),
      paint: {
        'fill-color': ['coalesce', ['get', 'fill'], '#ffffff'],
        'fill-opacity': (mapType === 'terrain' || mapType === 'climate') ? 0.9 : 0, // Visible in terrain/climate modes only
        'fill-outline-color': 'transparent', // Hide polygon edges (removes circular artifacts on globe)
      },
    },
    // Climate zones (overlays on terrain when climate mode)
    {
      id: 'climate',
      type: 'fill',
      source: 'climate',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_climate' }),
      paint: {
        'fill-color': ['coalesce', ['get', 'fill'], '#ececec'],
        'fill-opacity': mapType === 'climate' ? 0.7 : 0, // 70% opacity when climate mode for visibility
      },
    },
    // Country fills (uses colors from data, terrain shows through in terrain/climate modes, ALWAYS queryable)
    {
      id: 'countries',
      type: 'fill',
      source: 'political',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_political' }),
      paint: {
        'fill-color': ['coalesce', ['get', 'fill'], '#ececec'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          (mapType === 'terrain' || mapType === 'climate') ? 0.3 : 0.8, // Hover - visible in all modes
          mapType === 'map' ? 1 : 0, // Full opacity in map mode, INVISIBLE in terrain/climate modes
        ],
        'fill-outline-color': 'transparent', // Hide polygon edges to prevent seam artifacts from multi-part geometries
      },
    },
    // Country borders (ALWAYS visible, adaptive width at all zoom levels)
    {
      id: 'country-borders',
      type: 'line',
      source: 'political',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_political' }),
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#1a73e8', // Hover - Google blue
          '#888888'  // Default - medium gray (visible at all zoom levels)
        ],
        'line-width': [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          0, ['case', ['boolean', ['feature-state', 'hover'], false], 1.5, 0.8], // Far zoom - very thin
          2, ['case', ['boolean', ['feature-state', 'hover'], false], 2, 1],      // Default view
          4, ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.5],  // Transition zoom
          8, ['case', ['boolean', ['feature-state', 'hover'], false], 3, 2],      // Medium zoom
          14, ['case', ['boolean', ['feature-state', 'hover'], false], 4, 2.5],   // Close zoom
          18, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 3]      // Max zoom
        ],
        'line-opacity': 1, // Always fully visible
      },
    },
    // Lakes/water bodies (ALWAYS visible)
    {
      id: 'lakes-fill',
      type: 'fill',
      source: 'lakes',
      ...(useGeoJSON ? {} : { 'source-layer': 'map_layer_lakes' }),
      paint: {
        'fill-color': '#a5d8f3',
        'fill-opacity': 0.8,
      },
    },
    // Rivers - ACTUAL POLYGON FILLS from buffered geometry
    {
      id: 'rivers-polygons',
      type: 'fill',
      source: 'rivers-polygons',
      minzoom: 3, // Show from zoom 3 onward
      paint: {
        'fill-color': '#6db3d8',
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 0.6,   // Visible from zoom 3
          5, 0.75,  // More opaque at zoom 5
          8, 0.85,  // Nearly opaque at zoom 8+
        ],
      },
    },
    // Country labels (Google Maps style) - LAST so they're on top, visible at all zooms
    {
      id: 'country-labels',
      type: 'symbol',
      // Use dedicated labels source for vector tiles (GeoJSON), political source for custom projections
      source: useGeoJSON ? 'political' : 'political-labels',
      minzoom: 1,  // Don't render labels at zoom 0 (too far out)
      layout: {
        'text-field': [
          'coalesce',
          ['get', 'name'],
          ['get', 'id'],
          ''
        ],  // Get name, fallback to id, then empty string
        // Simple zoom-based text sizing (area-based sizing removed due to MapLibre limitations)
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1, 10,
          2, 12,
          4, 14,
          6, 16,
          8, 20,
          10, 24,
          14, 30
        ],
        'text-font': ['Noto Sans Regular'],
        'text-anchor': 'center',
        'text-justify': 'center',
        'symbol-placement': 'point',  // Place one label per feature (at centroid)
        'text-allow-overlap': false,  // Prevent overlapping labels
        'text-ignore-placement': false,
        'text-optional': false,
        'symbol-avoid-edges': true,   // Avoid labels at tile edges (critical for vector tiles)
        'text-padding': 10,           // Larger padding for better collision detection
        'text-max-width': 10,         // Wrap text after 10 ems
        'text-rotate': 0,
        'text-rotation-alignment': 'viewport',
        'text-pitch-alignment': 'viewport',
        'text-radial-offset': 0,
        'text-variable-anchor': ['center'], // Allow MapLibre to find best position and deduplicate
        'symbol-z-order': 'auto',    // Automatic z-ordering for better label placement
      },
      paint: {
        'text-color': '#2c2c2c',  // Darker gray for better contrast
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
        'text-halo-blur': 1,
        // Simple fade-in visibility (area-based removed to prevent errors)
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1, 0.6,
          2, 0.9,
          3, 1
        ],
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };

  return style as StyleSpecification;
};
