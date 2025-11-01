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
import { Popup } from "maplibre-gl";
import {
  calculatePolylineDistance,
  calculatePolygonArea,
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

// Helper function to calculate center point of measurement
function calculateMeasurementCenter(
  points: Array<[number, number]>,
  isPolygon: boolean
): { lng: number; lat: number } | null {
  if (points.length === 0) return null;

  if (points.length === 1) {
    return { lng: points[0][0], lat: points[0][1] };
  }

  if (isPolygon && points.length >= 3) {
    // Calculate centroid for polygon (average of all vertices)
    const sum = points.reduce(
      (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
      { lng: 0, lat: 0 }
    );
    return {
      lng: sum.lng / points.length,
      lat: sum.lat / points.length,
    };
  } else {
    // For line, calculate midpoint
    // Use middle point if odd, or average of middle two if even
    if (points.length === 2) {
      return {
        lng: (points[0][0] + points[1][0]) / 2,
        lat: (points[0][1] + points[1][1]) / 2,
      };
    } else {
      // For multi-point line, use middle point
      const midIndex = Math.floor(points.length / 2);
      if (points.length % 2 === 0) {
        // Even number of points - average of two middle points
        return {
          lng: (points[midIndex - 1][0] + points[midIndex][0]) / 2,
          lat: (points[midIndex - 1][1] + points[midIndex][1]) / 2,
        };
      } else {
        // Odd number - use middle point
        return {
          lng: points[midIndex][0],
          lat: points[midIndex][1],
        };
      }
    }
  }
}

export default function DistanceMeasurement({ map, active, onComplete }: DistanceMeasurementProps) {
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [isPolygon, setIsPolygon] = useState(false);
  const pointsRef = useRef<Array<[number, number]>>([]);
  const isPolygonRef = useRef(false);
  const popupRef = useRef<Popup | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    isPolygonRef.current = isPolygon;
  }, [isPolygon]);

  // Clear measurement layers and popup
  const clearLayers = useCallback(() => {
    if (!map) return;

    // Remove popup
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

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

      }
    },
    [map, clearLayers]
  );

  // Handle map clicks and mouse movement
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

  // Update or create popup tooltip centered on measurement
  useEffect(() => {
    if (!map || !active || points.length === 0) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }

    // Calculate center point of measurement
    const center = calculateMeasurementCenter(points, isPolygon);
    if (!center) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }

    // Calculate current measurements
    const currentDistance =
      points.length >= 2 ? calculatePolylineDistance(points.map(([lng, lat]) => ({ lng, lat }))) : 0;

    const currentArea =
      isPolygon && points.length >= 3
        ? calculatePolygonArea(points.map(([lng, lat]) => ({ lng, lat })))
        : 0;

    // Create minimal Leaflet-style tooltip
    const content = document.createElement('div');
    content.className = 'measurement-tooltip-content';
    
    // Build minimal measurement display - only show when we have a measurement
    let measurementHtml = '';
    if (points.length >= 2) {
      const distanceText = formatDistance(currentDistance, true);
      
      if (isPolygon && currentArea > 0) {
        // For polygons, show both perimeter and area in compact format
        const areaText = formatArea(currentArea, true);
        measurementHtml = `
          <div style="white-space: nowrap; font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 600; color: #111827;">${distanceText}</div>
            <div style="font-weight: 500; color: #4b5563; font-size: 11px;">${areaText}</div>
          </div>
        `;
      } else {
        // For distance, show single line
        measurementHtml = `
          <div style="white-space: nowrap; font-size: 12px; font-weight: 600; color: #111827;">
            ${distanceText}
          </div>
        `;
      }
    }
    
    // Only show tooltip if we have a measurement to display
    if (!measurementHtml) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      return;
    }
    
    content.innerHTML = `
      <div style="background: white; border-radius: 4px; padding: 4px 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 0, 0, 0.1); white-space: nowrap;">
        ${measurementHtml}
      </div>
      <style>
        .measurement-tooltip-popup .maplibregl-popup-content {
          padding: 0;
          margin: 0;
          background: transparent;
          box-shadow: none;
        }
        .measurement-tooltip-popup .maplibregl-popup-tip {
          display: none;
        }
      </style>
    `;

    // Create or update popup
    if (!popupRef.current) {
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        anchor: 'center',
        offset: [0, 0],
        className: 'measurement-tooltip-popup',
        maxWidth: 'none',
      });
      popupRef.current.setDOMContent(content);
      popupRef.current.addTo(map);
    } else {
      popupRef.current.setDOMContent(content);
    }

    // Position at center of measurement
    popupRef.current.setLngLat(center);

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, active, points, isPolygon]);

  // Component doesn't render anything - tooltip is managed via MapLibre Popup
  return null;
}
