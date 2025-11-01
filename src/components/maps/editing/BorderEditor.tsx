/**
 * BorderEditor Component
 * Advanced polygon editing interface using MapboxDraw (already initialized by MapEditorContainer)
 * Provides drawing, editing, and snapping tools for country borders
 *
 * NOTE: This component works with the MapboxDraw instance already created by MapEditorContainer.
 * It does NOT initialize its own drawing tools to avoid conflicts.
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type MapboxDraw from "@mapbox/mapbox-gl-draw";

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
 * Border Editor Component - Uses existing MapboxDraw from MapEditorContainer
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
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const {
    snapping = true,
    snapDistance = 20,
    allowSelfIntersection = false,
    continueDrawing = false,
  } = options;

  /**
   * Get the existing MapboxDraw instance from the map
   * MapEditorContainer already initializes this
   */
  useEffect(() => {
    if (!map || !isActive) return;

    // Try multiple methods to find MapboxDraw instance
    let draw: MapboxDraw | null = null;

    // Method 1: Check window global (set by MapEditorContainer)
    if ((window as any).__mapboxDrawInstance) {
      draw = (window as any).__mapboxDrawInstance;
      console.log("[BorderEditor] Found MapboxDraw via window global");
    }

    // Method 2: Check map._controls array (fallback)
    if (!draw) {
      const controls = (map as any)._controls;
      if (controls) {
        for (const control of controls) {
          if (control.options && typeof control.add === 'function' && typeof control.changeMode === 'function') {
            draw = control;
            console.log("[BorderEditor] Found MapboxDraw via map controls");
            break;
          }
        }
      }
    }

    if (!draw) {
      console.warn("[BorderEditor] MapboxDraw not found - subdivision drawing will not work");
      return;
    }

    drawRef.current = draw;

    // Load initial feature if provided
    if (initialFeature) {
      try {
        // Add the feature to MapboxDraw
        const featureIds = draw.add(initialFeature);
        if (featureIds && featureIds.length > 0) {
          setActiveFeatureId(featureIds[0]);
          console.log("[BorderEditor] Loaded initial feature:", featureIds[0]);
        }
      } catch (error) {
        console.error("[BorderEditor] Error loading initial feature:", error);
      }
    }

    // Event handlers for MapboxDraw
    const handleCreate = (e: any) => {
      onEditStart?.();
      if (e.features && e.features.length > 0) {
        const feature = e.features[0] as Feature<Polygon | MultiPolygon>;
        onGeometryChange?.(feature);
        setActiveFeatureId(feature.id as string);
      }
    };

    const handleUpdate = (e: any) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0] as Feature<Polygon | MultiPolygon>;
        onGeometryChange?.(feature);
      }
    };

    const handleDelete = (e: any) => {
      onEditEnd?.();
      setActiveFeatureId(null);
    };

    // Register event listeners
    map.on('draw.create', handleCreate);
    map.on('draw.update', handleUpdate);
    map.on('draw.delete', handleDelete);

    return () => {
      // Cleanup event listeners
      map.off('draw.create', handleCreate);
      map.off('draw.update', handleUpdate);
      map.off('draw.delete', handleDelete);

      // Remove the feature from draw if it exists
      if (activeFeatureId && draw) {
        try {
          draw.delete(activeFeatureId);
        } catch (e) {
          // Feature might already be deleted
        }
      }
    };
  }, [
    map,
    isActive,
    initialFeature,
    onGeometryChange,
    onEditStart,
    onEditEnd,
  ]);

  /**
   * Enable/disable drawing mode
   */
  const toggleDrawMode = useCallback((enable: boolean) => {
    if (!drawRef.current) return;

    if (enable) {
      drawRef.current.changeMode('draw_polygon');
    } else {
      drawRef.current.changeMode('simple_select');
    }
  }, []);

  /**
   * Enable/disable edit mode
   */
  const toggleEditMode = useCallback((enable: boolean) => {
    if (!drawRef.current || !activeFeatureId) return;

    if (enable) {
      drawRef.current.changeMode('direct_select', { featureId: activeFeatureId });
    } else {
      drawRef.current.changeMode('simple_select');
    }
  }, [activeFeatureId]);

  /**
   * Delete the current feature
   */
  const deleteFeature = useCallback(() => {
    if (!drawRef.current || !activeFeatureId || !map) return;

    const confirmed = window.confirm("Are you sure you want to delete this territory?");
    if (!confirmed) return;

    drawRef.current.delete(activeFeatureId);
    setActiveFeatureId(null);
    onEditEnd?.();
  }, [activeFeatureId, map, onEditEnd]);

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


  const deleteTerritory = useCallback(() => {
    editorRef.current?.deleteFeature();
  }, [editorRef]);

  return {
    enableDrawing,
    disableDrawing,
    enableEditing,
    disableEditing,
    deleteTerritory,
  };
}
