'use client';

import { useEffect, useRef, useState, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createGoogleMapsStyle } from '~/lib/maps/google-map-style';
import { MAPLIBRE_CONFIG } from '~/lib/ixearth-constants';
import { createCustomProjectionLayer } from '~/lib/maps/custom-projection-layer';
import type { ProjectionType } from '~/types/maps';
import { registerProjectionProtocol, unregisterProjectionProtocol } from '~/lib/maps/projection-protocol';

interface GoogleMapContainerProps {
  onCountryClick?: (countryId: string, countryName: string, position: { x: number; y: number }) => void;
  selectedCountryId?: string | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  mapType?: 'map' | 'climate' | 'terrain';
  onMapReady?: (map: maplibregl.Map) => void;
  projection?: ProjectionType;
  onProjectionChange?: (projection: ProjectionType) => void;
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
}: GoogleMapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const hoveredCountryId = useRef<number | null>(null);
  const projectionTransitioning = useRef<boolean>(false);
  const projectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const customProjectionLayer = useRef<ReturnType<typeof createCustomProjectionLayer> | null>(null);
  const currentProjectionRef = useRef<ProjectionType>(projection);

  // Initialize map ONCE
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const style = createGoogleMapsStyle(basePath, mapType, projection);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: style,
      center: MAPLIBRE_CONFIG.defaultCenter,
      zoom: MAPLIBRE_CONFIG.defaultZoom,
      minZoom: MAPLIBRE_CONFIG.minZoom,
      maxZoom: MAPLIBRE_CONFIG.maxZoom,
      // Projection is set in style, not here
    });

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
      setIsMapLoaded(true);
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }
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
  }, []); // Initialize ONCE only

  // Update map style when mapType or projection changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const style = createGoogleMapsStyle(basePath, mapType, projection);

    // Get current zoom and center before style change
    const currentZoom = map.current.getZoom();
    const currentCenter = map.current.getCenter();

    map.current.setStyle(style);

    // Restore position after style loads (setStyle resets view)
    map.current.once('styledata', () => {
      if (!map.current) return;

      // Restore zoom and center
      map.current.setZoom(currentZoom);
      map.current.setCenter(currentCenter);
    });
  }, [mapType, projection, isMapLoaded]);

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

  return <div ref={mapContainer} className="h-full w-full" />;
}

GoogleMapContainer.displayName = 'GoogleMapContainer';

export default memo(GoogleMapContainer);
