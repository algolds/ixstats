'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createGoogleMapsStyle } from '~/lib/maps/google-map-style';
import { MAPLIBRE_CONFIG } from '~/lib/ixearth-constants';
import { createCustomProjectionLayer } from '~/lib/maps/custom-projection-layer';
import type { ProjectionType } from '~/types/maps';
import { registerProjectionProtocol, unregisterProjectionProtocol } from '~/lib/maps/projection-protocol';
import { api } from '~/trpc/react';
import { useTheme } from '~/context/theme-context';

interface GoogleMapContainerProps {
  onCountryClick?: (countryId: string, countryName: string, position: { x: number; y: number }) => void;
  selectedCountryId?: string | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  mapType?: 'map' | 'climate' | 'terrain';
  onMapReady?: (map: maplibregl.Map) => void;
  projection?: ProjectionType;
  onProjectionChange?: (projection: ProjectionType) => void;
  showLabels?: boolean;
  showBorders?: boolean;
}

function GoogleMapContainer({
  onCountryClick,
  selectedCountryId,
  onZoomIn,
  onZoomOut,
  mapType = 'map',
  onMapReady,
  projection = 'globe',
  onProjectionChange,
  showLabels = true,
  showBorders = true,
}: GoogleMapContainerProps) {
  const { effectiveTheme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const hoveredCountryId = useRef<number | null>(null);
  const projectionTransitioning = useRef<boolean>(false);
  const projectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const customProjectionLayer = useRef<ReturnType<typeof createCustomProjectionLayer> | null>(null);
  const currentProjectionRef = useRef<ProjectionType>(projection);

  // Helper function to load all map icons
  const loadMapIcons = useCallback((mapInstance: maplibregl.Map) => {
    console.log('[GoogleMapContainer] Loading map icons...');

    // Create standardized map icons based on Wikipedia/Google Maps conventions
    const icons = {
      // National Capital: White circle with black dot
      'capital': `
        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="white" stroke="black" stroke-width="1.5"/>
          <circle cx="8" cy="8" r="3" fill="black"/>
        </svg>
      `,
      // Large City: Large white circle
      'city-large': `
        <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7" cy="7" r="6" fill="white" stroke="black" stroke-width="1.5"/>
        </svg>
      `,
      // Medium City: Medium white circle
      'city-medium': `
        <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
          <circle cx="5" cy="5" r="4" fill="white" stroke="black" stroke-width="1.2"/>
        </svg>
      `,
      // Small Town: Small white circle
      'city-small': `
        <svg width="6" height="6" xmlns="http://www.w3.org/2000/svg">
          <circle cx="3" cy="3" r="2.5" fill="white" stroke="black" stroke-width="0.8"/>
        </svg>
      `,
    };

    // Add all icons to map with Promise tracking
    const iconPromises = Object.entries(icons).map(([name, svg]) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (mapInstance && !mapInstance.hasImage(name)) {
            mapInstance.addImage(name, img);
          }
          resolve();
        };
        img.onerror = () => {
          console.error(`[GoogleMapContainer] Failed to load icon: ${name}`);
          reject(new Error(`Failed to load icon: ${name}`));
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svg);
      });
    });

    // Wait for all icons to load before marking as ready
    return Promise.all(iconPromises)
      .then(() => {
        console.log('[GoogleMapContainer] All map icons loaded successfully');
        setIconsLoaded(true);
      })
      .catch((error) => {
        console.error('[GoogleMapContainer] Error loading icons:', error);
        // Set to true anyway to prevent blocking
        setIconsLoaded(true);
      });
  }, []);

  // Fetch all approved cities for map display
  const { data: citiesData } = api.mapEditor.getAllCities.useQuery(
    { limit: 500 },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Fetch national capitals
  const { data: capitalsData, isLoading: capitalsLoading, error: capitalsError } = api.mapEditor.getAllNationalCapitals.useQuery(
    { limit: 200 },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Debug: Log capitals data changes
  useEffect(() => {
    console.log('[GoogleMapContainer] Capitals data updated:', {
      loading: capitalsLoading,
      error: capitalsError?.message,
      hasData: !!capitalsData,
      count: capitalsData?.capitals?.length,
      data: capitalsData
    });
  }, [capitalsData, capitalsLoading, capitalsError]);

  // Initialize map ONCE
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const style = createGoogleMapsStyle(basePath, mapType, projection, effectiveTheme);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: style,
      center: MAPLIBRE_CONFIG.defaultCenter,
      zoom: MAPLIBRE_CONFIG.defaultZoom,
      minZoom: MAPLIBRE_CONFIG.minZoom,
      maxZoom: MAPLIBRE_CONFIG.maxZoom,
      // Projection is set in style, not here
    } as any);

    // Set preserveDrawingBuffer after initialization (WebGL context option for PNG/SVG export)
    if (map.current) {
      (map.current as any).preserveDrawingBuffer = true;
    }

    map.current.on('error', (e: any) => {
      // Log detailed error information for debugging
      console.error('[GoogleMapContainer] Map error details:', JSON.stringify({
        errorMessage: e?.error?.message || String(e?.error || 'unknown'),
        errorStatus: e?.error?.status,
        sourceId: e?.sourceId,
        tile: e?.tile ? `${e.tile.tileID.canonical.z}/${e.tile.tileID.canonical.x}/${e.tile.tileID.canonical.y}` : null,
        type: e?.type,
      }, null, 2));
    });

    // Expose zoom functions
    if (onZoomIn) {
      (window as any).__mapZoomIn = () => map.current?.zoomIn();
    }
    if (onZoomOut) {
      (window as any).__mapZoomOut = () => map.current?.zoomOut();
    }

    map.current.on('load', () => {
      console.log('[GoogleMapContainer] Map loaded');
      setIsMapLoaded(true);
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }

      // Debug: Check if country-labels layer exists
      if (map.current) {
        const style = map.current.getStyle();
        const countryLabelsLayer = style.layers?.find((l: any) => l.id === 'country-labels');
        console.log('[GoogleMapContainer] country-labels layer:', countryLabelsLayer ? 'EXISTS' : 'MISSING');
        if (countryLabelsLayer) {
          console.log('[GoogleMapContainer] country-labels config:', countryLabelsLayer);
        }
      }

      // Load map icons
      if (map.current) {
        void loadMapIcons(map.current);
      }

      // Debug: Log map sources after style loads
      setTimeout(() => {
        if (map.current) {
          const style = map.current.getStyle();
          console.log('[GoogleMapContainer] Map sources:', Object.keys(style.sources || {}));
          console.log('[GoogleMapContainer] Map layers:', style.layers?.map((l: any) => l.id) || []);

          // Check if rivers-polygons source exists and has data
          const riversSource = style.sources['rivers-polygons'];
          console.log('[GoogleMapContainer] rivers-polygons source:', riversSource);

          // Force load the rivers-polygons data
          if (map.current.getSource('rivers-polygons')) {
            console.log('[GoogleMapContainer] rivers-polygons source EXISTS in map');

            // Check if the layer exists
            const riversPolygonsLayer = map.current.getLayer('rivers-polygons');
            if (riversPolygonsLayer) {
              console.log('[GoogleMapContainer] rivers-polygons LAYER exists:', riversPolygonsLayer);
            } else {
              console.error('[GoogleMapContainer] rivers-polygons LAYER missing!');
            }

            // Log current zoom
            console.log('[GoogleMapContainer] Current zoom:', map.current.getZoom());
          } else {
            console.error('[GoogleMapContainer] rivers-polygons source MISSING from map!');
          }
        }
      }, 2000);
    });

    // Dynamic projection switching based on zoom level (Google Maps-like)
    const handleZoom = () => {
      if (!map.current || projectionTransitioning.current) return;

      const currentZoom = map.current.getZoom();
      const currentProjection = map.current.getProjection();

      // Guard against undefined projection
      if (!currentProjection || !currentProjection.type) return;

      // Clear any pending timeout
      if (projectionTimeout.current) {
        clearTimeout(projectionTimeout.current);
      }

      // Transition from globe to mercator around zoom 3.5 (smooth, no flicker)
      if (currentZoom >= MAPLIBRE_CONFIG.globeToMercatorZoom && currentProjection.type === 'globe') {
        projectionTransitioning.current = true;
        map.current.setProjection({ type: 'mercator' });
        projectionTimeout.current = setTimeout(() => {
          if (projectionTransitioning.current !== undefined) {
            projectionTransitioning.current = false;
          }
        }, 500);
      } else if (currentZoom < MAPLIBRE_CONFIG.globeToMercatorZoom && currentProjection.type === 'mercator') {
        projectionTransitioning.current = true;
        map.current.setProjection({ type: 'globe' });
        projectionTimeout.current = setTimeout(() => {
          if (projectionTransitioning.current !== undefined) {
            projectionTransitioning.current = false;
          }
        }, 500);
      }
    };

    map.current.on('zoom', handleZoom);

    return () => {
      // Clear projection timeout
      if (projectionTimeout.current) {
        clearTimeout(projectionTimeout.current);
        projectionTimeout.current = null;
      }

      // Remove custom projection layer if exists
      if (customProjectionLayer.current && map.current) {
        try {
          map.current.removeLayer('custom-projection');
        } catch (e) {
          // Layer might not exist, ignore
        }
      }

      // Remove map
      if (map.current) {
        map.current.off('zoom', handleZoom);
        map.current.remove();
      }
      map.current = null;
    };
  }, [effectiveTheme]); // Reinitialize when theme changes (for initial load)

  // Update map style when mapType, projection, or theme changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const style = createGoogleMapsStyle(basePath, mapType, projection, effectiveTheme);

    // Get current zoom and center before style change
    const currentZoom = map.current.getZoom();
    const currentCenter = map.current.getCenter();

    map.current.setStyle(style);

    // Restore position and reload icons after style loads (setStyle resets view and removes images)
    map.current.once('styledata', () => {
      if (!map.current) return;

      // Restore zoom and center
      map.current.setZoom(currentZoom);
      map.current.setCenter(currentCenter);

      // Reload icons (setStyle removes all custom images)
      setIconsLoaded(false);
      void loadMapIcons(map.current);
    });
  }, [mapType, projection, effectiveTheme, isMapLoaded, loadMapIcons]);

  // Register/unregister custom projection protocol
  useEffect(() => {
    const needsCustomProtocol = projection === 'equalEarth' || projection === 'naturalEarth' || projection === 'ixmaps';

    if (needsCustomProtocol) {
      console.log(`[GoogleMapContainer] Registering custom protocol for ${projection}`);
      registerProjectionProtocol(projection);
    }

    // Cleanup: unregister protocol when projection changes or component unmounts
    return () => {
      if (needsCustomProtocol) {
        unregisterProjectionProtocol(projection);
      }
    };
  }, [projection]);

  // Notify parent of projection changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Skip if projection hasn't changed
    if (currentProjectionRef.current === projection) return;

    console.log(`[GoogleMapContainer] Projection changed to: ${projection}`);

    // Update ref to track current projection
    currentProjectionRef.current = projection;

    // Notify parent of projection change
    onProjectionChange?.(projection);
  }, [projection, isMapLoaded, onProjectionChange]);

  // Handle country interactions - GLOBAL HANDLERS (work in ALL modes)
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const mapInstance = map.current;

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      // Query ALL features at this point, then filter for political source (works in ALL modes)
      const allFeatures = mapInstance.queryRenderedFeatures(e.point);
      const politicalFeatures = allFeatures.filter(f => f.source === 'political');

      if (politicalFeatures.length > 0) {
        // Set pointer cursor when over country
        mapInstance.getCanvas().style.cursor = 'pointer';

        const feature = politicalFeatures[0];
        const featureId = feature.id as number;

        // Only update if hovering a different country
        if (featureId && hoveredCountryId.current !== featureId) {
          // Clear previous hover
          if (hoveredCountryId.current !== null) {
            mapInstance.setFeatureState(
              { source: 'political', id: hoveredCountryId.current, sourceLayer: 'map_layer_political' },
              { hover: false }
            );
          }

          // Set new hover
          hoveredCountryId.current = featureId;
          mapInstance.setFeatureState(
            { source: 'political', id: featureId, sourceLayer: 'map_layer_political' },
            { hover: true }
          );
        }
      } else {
        // Reset cursor when not over country
        mapInstance.getCanvas().style.cursor = '';

        // Mouse not over any country - clear hover
        if (hoveredCountryId.current !== null) {
          mapInstance.setFeatureState(
            { source: 'political', id: hoveredCountryId.current, sourceLayer: 'map_layer_political' },
            { hover: false }
          );
          hoveredCountryId.current = null;
        }
      }
    };

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      // Query ALL features at this point, then filter for political source (works in ALL modes)
      const allFeatures = mapInstance.queryRenderedFeatures(e.point);
      const politicalFeatures = allFeatures.filter(f => f.source === 'political');

      if (politicalFeatures.length > 0) {
        const feature = politicalFeatures[0];
        const countryId = String(feature.properties?.country_id || feature.properties?.id || feature.id || '');
        const countryName = feature.properties?.name || feature.properties?.id || 'Unknown';

        // Get pixel position for info window
        const position = { x: e.point.x, y: e.point.y };
        onCountryClick?.(countryId, countryName, position);
      } else {
        // Clicked on empty space - close info window
        onCountryClick?.('', '', { x: 0, y: 0 });
      }
    };

    const attachHandlers = () => {
      mapInstance.on('mousemove', handleMouseMove);
      mapInstance.on('click', handleClick);
    };

    const detachHandlers = () => {
      mapInstance.off('mousemove', handleMouseMove);
      mapInstance.off('click', handleClick);
    };

    // Attach handlers initially
    attachHandlers();

    // Re-attach handlers when style changes (setStyle removes event listeners)
    mapInstance.on('styledata', attachHandlers);

    return () => {
      mapInstance.off('styledata', attachHandlers);
      detachHandlers();
    };
  }, [isMapLoaded, onCountryClick]);

  // Add national capitals layer
  useEffect(() => {
    if (!map.current || !isMapLoaded || !iconsLoaded || !capitalsData?.capitals) return;

    const mapInstance = map.current;

    const addCapitalsLayer = () => {
      // Wait for style to be fully loaded (ensures fonts/glyphs are available)
      if (!mapInstance.isStyleLoaded()) {
        console.warn('[GoogleMapContainer] Style not loaded yet, waiting...');
        return;
      }

      // Check icon exists
      if (!mapInstance.hasImage('capital')) {
        console.warn('[GoogleMapContainer] Capital icon not loaded, waiting for next styledata event');
        return;
      }

      console.log('[GoogleMapContainer] Adding capitals layer');

      try {
        // Remove existing layer and source if they exist
        if (mapInstance.getLayer('national-capitals')) {
          mapInstance.removeLayer('national-capitals');
        }
        if (mapInstance.getSource('national-capitals')) {
          mapInstance.removeSource('national-capitals');
        }

        // Convert capitals to GeoJSON
        const geojsonData = {
          type: 'FeatureCollection' as const,
          features: capitalsData.capitals.map((capital: any) => ({
            type: 'Feature' as const,
            geometry: capital.coordinates,
            properties: {
              id: capital.id,
              name: capital.name,
              countryId: capital.country.id,
              countryName: capital.country.name,
              population: capital.population,
            },
          })),
        };

        console.log('[GoogleMapContainer] Capital GeoJSON features:', geojsonData.features.length);
        console.log('[GoogleMapContainer] First capital:', geojsonData.features[0]);

        // Add source
        mapInstance.addSource('national-capitals', {
          type: 'geojson',
          data: geojsonData,
        });

        // Add capital city marker (white circle with black dot)
        mapInstance.addLayer({
          id: 'national-capitals',
          type: 'symbol',
          source: 'national-capitals',
          layout: {
            'icon-image': 'capital',
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              2, 0.6,   // Slightly larger at far zoom for visibility
              4, 0.75,  // Medium
              6, 0.9,   // Larger
              10, 1.0,  // Full size at close zoom
            ],
            'icon-allow-overlap': true,
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0,     // Hidden at very far zoom
              4, 0,     // Still hidden
              5, 11,    // Start showing earlier
              8, 13,    // Medium
              10, 15,   // Larger at close zoom
            ],
            'text-optional': true, // Don't fail if font is missing
          },
          paint: {
            'text-color': effectiveTheme === 'dark' ? '#e2e8f0' : '#2c2c2c',
            'text-halo-color': effectiveTheme === 'dark' ? '#0f172a' : '#FFFFFF',
            'text-halo-width': 2,
          },
          minzoom: 2,
        });

        console.log('[GoogleMapContainer] Added capitals:', capitalsData.capitals.length);
      } catch (error) {
        console.error('[GoogleMapContainer] Error adding capitals:', error);
      }
    };

    // Add initially
    addCapitalsLayer();

    // Retry after a short delay if style wasn't ready
    const retryTimeout = setTimeout(() => {
      addCapitalsLayer();
    }, 500);

    // Re-add after style changes (setStyle removes all custom layers)
    mapInstance.on('styledata', addCapitalsLayer);

    return () => {
      clearTimeout(retryTimeout);
      mapInstance.off('styledata', addCapitalsLayer);
    };
  }, [isMapLoaded, iconsLoaded, capitalsData, effectiveTheme]);

  // Add cities layer (non-capitals)
  useEffect(() => {
    if (!map.current || !isMapLoaded || !iconsLoaded || !citiesData?.cities) return;

    const mapInstance = map.current;

    const addCitiesLayer = () => {
      if (!mapInstance.isStyleLoaded()) return;

      // Check that city icons exist
      const requiredIcons = ['city-large', 'city-medium', 'city-small'];
      const missingIcons = requiredIcons.filter(icon => !mapInstance.hasImage(icon));
      if (missingIcons.length > 0) {
        console.warn('[GoogleMapContainer] City icons not loaded yet:', missingIcons);
        return;
      }

      try {
        // Remove existing layer if it exists
        if (mapInstance.getLayer('cities')) {
          mapInstance.removeLayer('cities');
        }
        if (mapInstance.getSource('cities')) {
          mapInstance.removeSource('cities');
        }

        // Filter out national capitals (they have their own layer)
        const regularCities = citiesData.cities.filter((city: any) => !city.isNationalCapital);

        // Convert cities to GeoJSON with icon type based on population
        const geojsonData = {
          type: 'FeatureCollection' as const,
          features: regularCities.map((city: any) => {
            // Determine icon type based on population
            let iconType = 'city-small';
            if (city.population && city.population > 1000000) {
              iconType = 'city-large';
            } else if (city.population && city.population > 100000) {
              iconType = 'city-medium';
            }

            return {
              type: 'Feature' as const,
              geometry: city.coordinates,
              properties: {
                id: city.id,
                name: city.name,
                population: city.population,
                iconType: iconType,
                isSubdivisionCapital: city.isSubdivisionCapital,
              },
            };
          }),
        };

        // Add source
        mapInstance.addSource('cities', {
          type: 'geojson',
          data: geojsonData,
        });

        // Add cities layer with dynamic icons
        mapInstance.addLayer({
          id: 'cities',
          type: 'symbol',
          source: 'cities',
          layout: {
            'icon-image': ['get', 'iconType'],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4, 0,     // Hidden at very low zoom
              5, 0.4,   // Start showing
              7, 0.6,   // Medium
              10, 0.8,  // Full size
            ],
            'icon-allow-overlap': false,
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-offset': [0, 1],
            'text-anchor': 'top',
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 0,     // Hidden below zoom 6
              7, 10,    // Start showing
              10, 12,   // Full size
            ],
            'text-optional': true,
          },
          paint: {
            'text-color': effectiveTheme === 'dark' ? '#e2e8f0' : '#2c2c2c',
            'text-halo-color': effectiveTheme === 'dark' ? '#0f172a' : '#FFFFFF',
            'text-halo-width': 1.5,
          },
          minzoom: 5,
        });

        console.log('[GoogleMapContainer] Added cities:', regularCities.length);
      } catch (error) {
        console.error('[GoogleMapContainer] Error adding cities:', error);
      }
    };

    // Add initially
    addCitiesLayer();

    // Re-add after style changes
    mapInstance.on('styledata', addCitiesLayer);

    return () => {
      mapInstance.off('styledata', addCitiesLayer);
    };
  }, [isMapLoaded, iconsLoaded, citiesData, effectiveTheme]);

  // Control label visibility
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const mapInstance = map.current;

    const updateLabelVisibility = () => {
      if (!mapInstance.getLayer('country-labels')) return;

      mapInstance.setLayoutProperty(
        'country-labels',
        'visibility',
        showLabels ? 'visible' : 'none'
      );
    };

    updateLabelVisibility();

    // Re-apply after style changes
    mapInstance.on('styledata', updateLabelVisibility);

    return () => {
      mapInstance.off('styledata', updateLabelVisibility);
    };
  }, [isMapLoaded, showLabels]);

  // Control border visibility
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const mapInstance = map.current;

    const updateBorderVisibility = () => {
      if (!mapInstance.getLayer('country-borders')) return;

      mapInstance.setLayoutProperty(
        'country-borders',
        'visibility',
        showBorders ? 'visible' : 'none'
      );
    };

    updateBorderVisibility();

    // Re-apply after style changes
    mapInstance.on('styledata', updateBorderVisibility);

    return () => {
      mapInstance.off('styledata', updateBorderVisibility);
    };
  }, [isMapLoaded, showBorders]);

  return <div ref={mapContainer} className="h-full w-full" />;
}

GoogleMapContainer.displayName = 'GoogleMapContainer';

export default memo(GoogleMapContainer);
