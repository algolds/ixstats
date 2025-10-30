import type { StyleSpecification } from 'maplibre-gl';

export const createGoogleMapsStyle = (
  basePath: string = '',
  mapType: 'map' | 'climate' | 'terrain' = 'map'
): StyleSpecification => {
  // Ensure base path doesn't have trailing slash and construct full URLs
  const cleanBasePath = basePath.replace(/\/$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return {
  version: 8,
  projection: { type: 'globe' }, // Start with globe projection
  sources: {
    political: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/political/{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: 14,
    },
    altitudes: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/altitudes/{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: 14,
    },
    lakes: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/lakes/{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: 14,
    },
    rivers: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/rivers/{z}/{x}/{y}`],
      minzoom: 3, // Match layer minzoom - don't load river tiles when not visible
      maxzoom: 14,
    },
    climate: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/climate/{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: 14,
    },
    icecaps: {
      type: 'vector',
      tiles: [`${origin}${cleanBasePath}/api/tiles/icecaps/{z}/{x}/{y}`],
      minzoom: 0,
      maxzoom: 14,
    },
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
    // Terrain/land with elevation colors
    {
      id: 'terrain',
      type: 'fill',
      source: 'altitudes',
      'source-layer': 'map_layer_altitudes',
      paint: {
        'fill-color': ['get', 'fill'],
        'fill-opacity': mapType === 'terrain' ? 1 : 0,
      },
    },
    // Climate zones (overlays on terrain when climate mode)
    {
      id: 'climate',
      type: 'fill',
      source: 'climate',
      'source-layer': 'map_layer_climate',
      paint: {
        'fill-color': ['get', 'fill'],
        'fill-opacity': mapType === 'climate' ? 0.7 : 0, // 70% opacity when climate mode for visibility
      },
    },
    // Flat beige background when not in terrain mode
    {
      id: 'flat-background',
      type: 'fill',
      source: 'altitudes',
      'source-layer': 'map_layer_altitudes',
      paint: {
        'fill-color': '#f2efea',
        'fill-opacity': mapType === 'terrain' || mapType === 'climate' ? 0 : 1,
      },
    },
    // Country fills (uses colors from data, invisible in terrain/climate modes, ALWAYS queryable)
    {
      id: 'countries',
      type: 'fill',
      source: 'political',
      'source-layer': 'map_layer_political',
      paint: {
        'fill-color': ['get', 'fill'], // Use color from GeoJSON data
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          (mapType === 'terrain' || mapType === 'climate') ? 0.3 : 0.8, // Hover - subtle in terrain/climate, slightly transparent in map
          (mapType === 'terrain' || mapType === 'climate') ? 0.01 : 1, // Default - nearly invisible in terrain/climate (but queryable), full opacity in map
        ],
      },
    },
    // Country borders (ALWAYS visible, adaptive width at all zoom levels)
    {
      id: 'country-borders',
      type: 'line',
      source: 'political',
      'source-layer': 'map_layer_political',
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
          0, ['case', ['boolean', ['feature-state', 'hover'], false], 2, 1],    // Global view - thin but visible
          4, ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.5], // Transition zoom
          8, ['case', ['boolean', ['feature-state', 'hover'], false], 3, 2],     // Medium zoom
          14, ['case', ['boolean', ['feature-state', 'hover'], false], 4, 2.5],  // Close zoom
          18, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 3]     // Street-level zoom
        ],
        'line-opacity': 1, // Always fully visible
      },
    },
    // Lakes/water bodies (ALWAYS visible)
    {
      id: 'lakes-fill',
      type: 'fill',
      source: 'lakes',
      'source-layer': 'map_layer_lakes',
      paint: {
        'fill-color': '#a5d8f3',
        'fill-opacity': 0.8,
      },
    },
    // Rivers (visible from zoom 3+, dynamic styling)
    {
      id: 'rivers-line',
      type: 'line',
      source: 'rivers',
      'source-layer': 'map_layer_rivers',
      minzoom: 3,
      paint: {
        'line-color': '#6db3d8',  // River blue
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 0.8,   // Start thin at zoom 3
          6, 1.5,   // Good visibility at zoom 6
          10, 2.5,  // Medium at zoom 10
          14, 4     // Thick at high zoom
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 0.6,   // Slightly transparent when first visible
          6, 0.8,   // More opaque at zoom 6
          10, 1     // Fully opaque at zoom 10
        ],
      },
    },
    // Ice caps
    {
      id: 'icecaps-fill',
      type: 'fill',
      source: 'icecaps',
      'source-layer': 'map_layer_icecaps',
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': 0.9,
      },
    },
    // Country labels (Google Maps style) - LAST so they're on top, visible at all zooms
    {
      id: 'country-labels',
      type: 'symbol',
      source: 'political',
      'source-layer': 'map_layer_political',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 8,   // Small at global view
          2, 10,  // Readable at default zoom
          4, 12,  // Slightly larger
          8, 18,  // Medium zoom
          14, 24  // Large at close zoom
        ],
        'text-font': ['Open Sans Regular', 'Arial Regular'],
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#5d5d5d',
        'text-halo-color': '#ffffff',
        'text-halo-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,    // Thinner halo at global view
          4, 1.5,  // Standard halo
          8, 2     // Thicker halo at close zoom
        ],
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.7,  // Slightly transparent at global view
          2, 1     // Fully opaque at default zoom and above
        ],
      },
    },
  ],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};
};
