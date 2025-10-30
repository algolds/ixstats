"use client";

/**
 * Distance & Area Measurement Component
 *
 * Provides interactive distance and area measurement tools for MapLibre GL maps.
 * Features:
 * - Click to add points and measure distances
 * - Double-click to close polygon and measure area
 * - Escape to cancel measurement
 * - Shows segment distances and total distance/area
 * - Supports both imperial and metric units
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import {
  calculatePolylineDistance,
  calculatePolygonArea,
  calculateDistanceFromLngLat,
  formatDistance,
  formatArea,
  coordsToLineString,
  coordsToPolygon,
  coordsToPoints,
  KM_TO_MILES,
} from "~/lib/maps/measurement-utils";

interface DistanceMeasurementProps {
  map: MapLibreMap | null;
  active: boolean;
  onComplete?: (result: MeasurementResult) => void;
}

export interface MeasurementResult {
  type: "distance" | "area";
  distanceKm?: number;
  distanceMi?: number;
  areaKm2?: number;
  areaMi2?: number;
  points: Array<[number, number]>;
}

export default function DistanceMeasurement({ map, active, onComplete }: DistanceMeasurementProps) {
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [isPolygon, setIsPolygon] = useState(false);
  const pointsRef = useRef<Array<[number, number]>>([]);
  const isPolygonRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    isPolygonRef.current = isPolygon;
  }, [isPolygon]);

  // Clear measurement layers
  const clearLayers = useCallback(() => {
    if (!map) return;

    try {
      // Remove layers
      if (map.getLayer("measurement-line")) {
        map.removeLayer("measurement-line");
      }
      if (map.getLayer("measurement-polygon")) {
        map.removeLayer("measurement-polygon");
      }
      if (map.getLayer("measurement-polygon-outline")) {
        map.removeLayer("measurement-polygon-outline");
      }
      if (map.getLayer("measurement-points")) {
        map.removeLayer("measurement-points");
      }
      if (map.getLayer("measurement-labels")) {
        map.removeLayer("measurement-labels");
      }

      // Remove sources
      if (map.getSource("measurement-line")) {
        map.removeSource("measurement-line");
      }
      if (map.getSource("measurement-polygon")) {
        map.removeSource("measurement-polygon");
      }
      if (map.getSource("measurement-points")) {
        map.removeSource("measurement-points");
      }
      if (map.getSource("measurement-labels")) {
        map.removeSource("measurement-labels");
      }
    } catch (e) {
      // Ignore errors if layers/sources don't exist
    }
  }, [map]);

  // Update map visualization
  const updateVisualization = useCallback(
    (currentPoints: Array<[number, number]>, isPoly: boolean) => {
      if (!map || currentPoints.length === 0) return;

      clearLayers();

      // Create point features
      const pointFeatures = coordsToPoints(currentPoints);

      // Add points source and layer
      map.addSource("measurement-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: pointFeatures,
        },
      });

      map.addLayer({
        id: "measurement-points",
        type: "circle",
        source: "measurement-points",
        paint: {
          "circle-radius": 6,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FF4500",
        },
      });

      if (currentPoints.length >= 2) {
        if (isPoly && currentPoints.length >= 3) {
          // Create polygon
          const polygonFeature = coordsToPolygon(currentPoints);

          map.addSource("measurement-polygon", {
            type: "geojson",
            data: polygonFeature,
          });

          // Polygon fill
          map.addLayer({
            id: "measurement-polygon",
            type: "fill",
            source: "measurement-polygon",
            paint: {
              "fill-color": "#FF4500",
              "fill-opacity": 0.15,
            },
          });

          // Polygon outline
          map.addLayer({
            id: "measurement-polygon-outline",
            type: "line",
            source: "measurement-polygon",
            paint: {
              "line-color": "#FF4500",
              "line-width": 3,
              "line-dasharray": [2, 2],
            },
          });
        } else {
          // Create line
          const lineFeature = coordsToLineString(currentPoints);

          map.addSource("measurement-line", {
            type: "geojson",
            data: lineFeature,
          });

          map.addLayer({
            id: "measurement-line",
            type: "line",
            source: "measurement-line",
            paint: {
              "line-color": "#FF4500",
              "line-width": 3,
              "line-dasharray": [2, 2],
            },
          });
        }

        // Add segment distance labels
        const labelFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
        for (let i = 1; i < currentPoints.length; i++) {
          const [lng1, lat1] = currentPoints[i - 1];
          const [lng2, lat2] = currentPoints[i];

          // Calculate segment distance
          const segmentKm = calculateDistanceFromLngLat(
            { lng: lng1, lat: lat1 },
            { lng: lng2, lat: lat2 }
          );

          // Calculate midpoint
          const midLng = (lng1 + lng2) / 2;
          const midLat = (lat1 + lat2) / 2;

          labelFeatures.push({
            type: "Feature",
            properties: {
              text: formatDistance(segmentKm, true),
            },
            geometry: {
              type: "Point",
              coordinates: [midLng, midLat],
            },
          });
        }

        // Skip segment distance labels - they require glyphs configuration
        // TODO: Add proper glyphs configuration if segment labels are needed
        // The measurement widget shows total distance/area which is sufficient
        if (labelFeatures.length > 0) {
          // Commenting out text labels to avoid glyphs errors
          // map.addSource('measurement-labels', {
          //   type: 'geojson',
          //   data: {
          //     type: 'FeatureCollection',
          //     features: labelFeatures,
          //   },
          // });
          // map.addLayer({
          //   id: 'measurement-labels',
          //   type: 'symbol',
          //   source: 'measurement-labels',
          //   layout: {
          //     'text-field': ['get', 'text'],
          //     'text-size': 12,
          //     'text-font': ['Open Sans Regular'],
          //     'text-offset': [0, -1],
          //     'text-anchor': 'bottom',
          //   },
          //   paint: {
          //     'text-color': '#FF4500',
          //     'text-halo-color': '#FFFFFF',
          //     'text-halo-width': 2,
          //   },
          // });
        }
      }
    },
    [map, clearLayers]
  );

  // Handle map clicks
  useEffect(() => {
    if (!map || !active) return;

    const handleClick = (e: MapMouseEvent) => {
      e.preventDefault();

      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const currentPoints = [...pointsRef.current, newPoint];

      setPoints(currentPoints);
      updateVisualization(currentPoints, isPolygonRef.current);
    };

    const handleDblClick = (e: MapMouseEvent) => {
      e.preventDefault();

      const currentPoints = pointsRef.current;
      if (currentPoints.length < 2) return;

      // Double-click closes the polygon and calculates area
      if (currentPoints.length >= 3) {
        setIsPolygon(true);
        updateVisualization(currentPoints, true);

        // Calculate area
        const pointsForArea = currentPoints.map(([lng, lat]) => ({
          lng,
          lat,
        }));
        const areaKm2 = calculatePolygonArea(pointsForArea);
        const areaMi2 = areaKm2 * 0.386102;

        // Also calculate perimeter
        const perimeterKm = calculatePolylineDistance(pointsForArea);
        const perimeterMi = perimeterKm * KM_TO_MILES;

        if (onComplete) {
          onComplete({
            type: "area",
            distanceKm: perimeterKm,
            distanceMi: perimeterMi,
            areaKm2,
            areaMi2,
            points: currentPoints,
          });
        }
      } else {
        // Just finish distance measurement
        const pointsForDistance = currentPoints.map(([lng, lat]) => ({
          lng,
          lat,
        }));
        const distanceKm = calculatePolylineDistance(pointsForDistance);
        const distanceMi = distanceKm * KM_TO_MILES;

        if (onComplete) {
          onComplete({
            type: "distance",
            distanceKm,
            distanceMi,
            points: currentPoints,
          });
        }
      }
    };

    map.on("click", handleClick);
    map.on("dblclick", handleDblClick);

    // Set crosshair cursor
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";

    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
      canvas.style.cursor = "";
    };
  }, [map, active, onComplete, updateVisualization]);

  // Handle escape key
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearLayers();
        setPoints([]);
        setIsPolygon(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, clearLayers]);

  // Clear when deactivated
  useEffect(() => {
    if (!active) {
      clearLayers();
      setPoints([]);
      setIsPolygon(false);
    }
  }, [active, clearLayers]);

  // Calculate current measurements
  const currentDistance =
    points.length >= 2 ? calculatePolylineDistance(points.map(([lng, lat]) => ({ lng, lat }))) : 0;

  const currentArea =
    isPolygon && points.length >= 3
      ? calculatePolygonArea(points.map(([lng, lat]) => ({ lng, lat })))
      : 0;

  if (!active || points.length === 0) return null;

  return (
    <div className="glass-hierarchy-interactive pointer-events-auto absolute top-20 left-4 z-[10000] min-w-[250px] rounded-lg border border-orange-500/50 px-4 py-3 shadow-lg shadow-orange-500/30 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-orange-500"></div>
        <div className="text-xs font-bold tracking-wide text-orange-400 uppercase">
          {isPolygon ? "Area Measurement" : "Distance Measurement"}
        </div>
      </div>

      <div className="space-y-1">
        {points.length >= 2 && (
          <div className="text-foreground text-sm font-medium">
            {isPolygon ? "Perimeter" : "Distance"}: {formatDistance(currentDistance, true)}
          </div>
        )}

        {isPolygon && currentArea > 0 && (
          <div className="text-foreground text-sm font-medium">
            Area: {formatArea(currentArea, true)}
          </div>
        )}

        <div className="mt-2 border-t border-orange-500/30 pt-2 text-xs text-[--intel-silver]">
          {points.length === 0 && "Click to start measuring"}
          {points.length === 1 && "Click to add points"}
          {points.length >= 2 && points.length < 3 && "Double-click to finish"}
          {points.length >= 3 && !isPolygon && "Double-click to close polygon & measure area"}
          {isPolygon && "Polygon complete"}
        </div>

        <div className="text-xs text-[--intel-silver]">Press Esc to cancel</div>
      </div>
    </div>
  );
}
