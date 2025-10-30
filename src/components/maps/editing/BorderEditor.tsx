/**
 * BorderEditor Component
 * Advanced polygon editing interface using MapLibre-Geoman
 * Provides drawing, editing, and snapping tools for country borders
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

// Dynamic import for MapLibre-Geoman
let geomanInstance: any = null;

interface BorderEditorProps {
  map: MapLibreMap | null;
  isActive: boolean;
  initialFeature?: Feature<Polygon | MultiPolygon> | null;
  onGeometryChange?: (feature: Feature<Polygon | MultiPolygon>) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  options?: {
    snapping?: boolean;
    snapDistance?: number;
    allowSelfIntersection?: boolean;
    continueDrawing?: boolean;
  };
}

/**
 * Border Editor Component with MapLibre-Geoman controls
 */
export function BorderEditor({
  map,
  isActive,
  initialFeature,
  onGeometryChange,
  onEditStart,
  onEditEnd,
  options = {},
}: BorderEditorProps) {
  const [isGeomanLoaded, setIsGeomanLoaded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<any>(null);
  const controlsRef = useRef<any>(null);

  const {
    snapping = true,
    snapDistance = 20,
    allowSelfIntersection = false,
    continueDrawing = false,
  } = options;

  /**
   * Load MapLibre-Geoman dynamically
   */
  useEffect(() => {
    if (typeof window === "undefined" || !map) return;

    const loadGeoman = async () => {
      try {
        if (!geomanInstance) {
          const geoman = await import("@geoman-io/maplibre-geoman-free");
          geomanInstance = geoman.default || geoman;
        }
        setIsGeomanLoaded(true);
      } catch (error) {
        console.error("[BorderEditor] Failed to load MapLibre-Geoman:", error);
      }
    };

    loadGeoman();
  }, [map]);

  /**
   * Initialize Geoman controls when map and library are ready
   */
  useEffect(() => {
    if (!map || !isGeomanLoaded || !isActive || !geomanInstance) return;

    try {
      // Initialize Geoman on the map
      if (!(map as any).pm) {
        geomanInstance.addControls(map, {
          position: "topright",
          drawControls: true,
          editControls: true,
          optionsControls: true,
          customControls: true,
          oneBlock: false,
        });
      }

      const pm = (map as any).pm;
      controlsRef.current = pm;

      // Enable only polygon drawing/editing tools
      pm.Toolbar.setBlockPosition("top-right");
      pm.Toolbar.changeActionsOfControl("Polygon", ["finish", "cancel", "removeLastVertex"]);

      // Configure global options
      pm.setGlobalOptions({
        snappable: snapping,
        snapDistance,
        allowSelfIntersection,
        continueDrawing,
        templineStyle: {
          color: "#3b82f6",
          weight: 2,
          opacity: 0.8,
        },
        hintlineStyle: {
          color: "#10b981",
          weight: 2,
          opacity: 0.6,
          dashArray: [5, 5],
        },
        pathOptions: {
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.2,
          weight: 2,
        },
      });

      // Load initial feature if provided
      if (initialFeature) {
        const geoJsonLayer = {
          type: "Feature",
          geometry: initialFeature.geometry,
          properties: initialFeature.properties || {},
        };

        try {
          map.addSource("editing-feature", {
            type: "geojson",
            data: geoJsonLayer as any,
          });

          map.addLayer({
            id: "editing-feature-fill",
            type: "fill",
            source: "editing-feature",
            paint: {
              "fill-color": "#3b82f6",
              "fill-opacity": 0.2,
            },
          });

          map.addLayer({
            id: "editing-feature-outline",
            type: "line",
            source: "editing-feature",
            paint: {
              "line-color": "#3b82f6",
              "line-width": 2,
            },
          });

          // Enable editing on the layer
          pm.enableGlobalEditMode();
        } catch (error) {
          console.error("[BorderEditor] Error loading initial feature:", error);
        }
      }

      // Event handlers
      const handleDrawStart = () => {
        onEditStart?.();
      };

      const handleDrawEnd = (e: any) => {
        const feature = e.layer.toGeoJSON() as Feature<Polygon | MultiPolygon>;
        onGeometryChange?.(feature);
        setActiveLayer(e.layer);
      };

      const handleEditEnd = (e: any) => {
        const feature = e.layer.toGeoJSON() as Feature<Polygon | MultiPolygon>;
        onGeometryChange?.(feature);
      };

      const handleCut = (e: any) => {
        const feature = e.layer.toGeoJSON() as Feature<Polygon | MultiPolygon>;
        onGeometryChange?.(feature);
      };

      const handleRemove = () => {
        onEditEnd?.();
        setActiveLayer(null);
      };

      // Register event listeners
      map.on("pm:drawstart", handleDrawStart);
      map.on("pm:create", handleDrawEnd);
      map.on("pm:edit", handleEditEnd);
      map.on("pm:cut", handleCut);
      map.on("pm:remove", handleRemove);

      return () => {
        // Cleanup event listeners
        map.off("pm:drawstart", handleDrawStart);
        map.off("pm:create", handleDrawEnd);
        map.off("pm:edit", handleEditEnd);
        map.off("pm:cut", handleCut);
        map.off("pm:remove", handleRemove);

        // Remove layers
        if (map.getLayer("editing-feature-fill")) {
          map.removeLayer("editing-feature-fill");
        }
        if (map.getLayer("editing-feature-outline")) {
          map.removeLayer("editing-feature-outline");
        }
        if (map.getSource("editing-feature")) {
          map.removeSource("editing-feature");
        }

        // Disable Geoman
        if (pm) {
          pm.disableGlobalEditMode();
          pm.removeControls();
        }
      };
    } catch (error) {
      console.error("[BorderEditor] Error initializing Geoman:", error);
    }
  }, [
    map,
    isGeomanLoaded,
    isActive,
    initialFeature,
    onGeometryChange,
    onEditStart,
    onEditEnd,
    snapping,
    snapDistance,
    allowSelfIntersection,
    continueDrawing,
  ]);

  /**
   * Enable/disable drawing mode
   */
  const toggleDrawMode = useCallback(
    (enable: boolean) => {
      if (!controlsRef.current) return;

      if (enable) {
        controlsRef.current.enableDraw("Polygon");
      } else {
        controlsRef.current.disableDraw();
      }
    },
    []
  );

  /**
   * Enable/disable edit mode
   */
  const toggleEditMode = useCallback(
    (enable: boolean) => {
      if (!controlsRef.current) return;

      if (enable) {
        controlsRef.current.enableGlobalEditMode();
      } else {
        controlsRef.current.disableGlobalEditMode();
      }
    },
    []
  );

  /**
   * Split a polygon (for territorial division)
   */
  const splitPolygon = useCallback(() => {
    if (!controlsRef.current || !activeLayer) return;

    try {
      controlsRef.current.enableGlobalCutMode();
    } catch (error) {
      console.error("[BorderEditor] Error enabling cut mode:", error);
    }
  }, [activeLayer]);

  /**
   * Delete the current feature
   */
  const deleteFeature = useCallback(() => {
    if (!activeLayer || !map) return;

    const confirmed = window.confirm("Are you sure you want to delete this territory?");
    if (!confirmed) return;

    if (map.getLayer("editing-feature-fill")) {
      map.removeLayer("editing-feature-fill");
    }
    if (map.getLayer("editing-feature-outline")) {
      map.removeLayer("editing-feature-outline");
    }
    if (map.getSource("editing-feature")) {
      map.removeSource("editing-feature");
    }

    setActiveLayer(null);
    onEditEnd?.();
  }, [activeLayer, map, onEditEnd]);

  // Don't render anything - controls are added directly to map
  return null;
}

/**
 * Utility hook for programmatic border editor control
 */
export function useBorderEditorControls(editorRef: React.RefObject<any>) {
  const enableDrawing = useCallback(() => {
    editorRef.current?.toggleDrawMode(true);
  }, [editorRef]);

  const disableDrawing = useCallback(() => {
    editorRef.current?.toggleDrawMode(false);
  }, [editorRef]);

  const enableEditing = useCallback(() => {
    editorRef.current?.toggleEditMode(true);
  }, [editorRef]);

  const disableEditing = useCallback(() => {
    editorRef.current?.toggleEditMode(false);
  }, [editorRef]);

  const splitTerritory = useCallback(() => {
    editorRef.current?.splitPolygon();
  }, [editorRef]);

  const deleteTerritory = useCallback(() => {
    editorRef.current?.deleteFeature();
  }, [editorRef]);

  return {
    enableDrawing,
    disableDrawing,
    enableEditing,
    disableEditing,
    splitTerritory,
    deleteTerritory,
  };
}
