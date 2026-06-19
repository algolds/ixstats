import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";

interface UsePointDragProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  features: EditorFeature[];
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  updatePointCoordinates?: (
    featureId: string,
    featureType: "city" | "poi" | "storyPin" | "mapLabel",
    coordinates: [number, number]
  ) => Promise<void>;
}

export function usePointDrag({
  map,
  isLoaded,
  mode,
  features,
  onFeatureSelect,
  updatePointCoordinates,
}: UsePointDragProps) {
  const dragRef = useRef<{
    featureId: string;
    featureType: string;
    originalCoords: [number, number];
    currentCoords: [number, number];
  } | null>(null);

  const featuresRef = useRef(features);
  featuresRef.current = features;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const onFeatureSelectRef = useRef(onFeatureSelect);
  onFeatureSelectRef.current = onFeatureSelect;

  const updatePointCoordinatesRef = useRef(updatePointCoordinates);
  updatePointCoordinatesRef.current = updatePointCoordinates;

  useEffect(() => {
    if (!map || !isLoaded) return;

    const draggableLayers = [
      "editor-points-capital",
      "editor-points-city",
      "editor-points-poi",
      "editor-points-story-pin",
      "editor-points-map-label",
      "editor-points-labels",
      "editor-map-labels",
    ];

    const onMouseDown = (e: any) => {
       const activeMode = modeRef.current;
       const isAddMode =
         activeMode.startsWith("add-") ||
         activeMode.startsWith("import-") ||
         activeMode.includes("route") ||
         activeMode === "split-subdivision" ||
         activeMode === "pan" ||
         activeMode === "lasso-select" ||
         activeMode === "ruler" ||
         activeMode === "paint-fill";
       if (isAddMode) return;

       const dragBbox = [
         [e.point.x - 8, e.point.y - 8],
         [e.point.x + 8, e.point.y + 8],
       ] as [import("maplibre-gl").PointLike, import("maplibre-gl").PointLike];
       const hits = map.queryRenderedFeatures(dragBbox, { layers: draggableLayers });
       if (hits.length === 0) return;

       const hit = hits[0]!;
       const id = hit.properties?.id;
       
       // Look up feature to make sure we drag by ID and get its canonical properties
       if (!id) return;
       const feature = featuresRef.current.find((f) => f.id === id);
       if (!feature || !feature.coordinates) return;

       // Prevent default map behaviors (like panning / box zoom / selection rings)
       e.preventDefault();

       map.dragPan.disable();

       dragRef.current = {
         featureId: id,
         featureType: feature.type, // e.g. "city", "poi", "storyPin", "mapLabel"
         originalCoords: [...feature.coordinates] as [number, number],
         currentCoords: [...feature.coordinates] as [number, number],
       };

       map.getCanvas().style.cursor = "grabbing";

       // Select feature in editor
       if (onFeatureSelectRef.current) {
         onFeatureSelectRef.current(feature);
       }

       // Populate ghost source at starting coordinates
       const ghostSource = map.getSource("editor-points-ghost") as GeoJSONSource;
       if (ghostSource) {
         ghostSource.setData({
           type: "FeatureCollection",
           features: [
             {
               type: "Feature",
               geometry: {
                 type: "Point",
                 coordinates: feature.coordinates,
               },
               properties: {},
             },
           ],
         });
       }
     };

    const onMouseMove = (e: any) => {
      if (!dragRef.current) return;

      const newCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      dragRef.current.currentCoords = newCoords;

      // Directly update the coordinates of the dragged feature on the map source for 60fps responsiveness
      const source = map.getSource("editor-points") as GeoJSONSource;
      if (source) {
        const pointFeatures = featuresRef.current
          .filter((f) => f.coordinates)
          .map((f) => {
            const coords = f.id === dragRef.current?.featureId ? newCoords : f.coordinates!;
            return {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: coords,
              },
              properties: {
                id: f.id,
                name: f.name,
                featureType: f.type,
                isCapital: f.properties.isNationalCapital ?? false,
                rotation: Number(f.properties.rotation) || 0,
                opacity: f.properties.opacity !== undefined ? Number(f.properties.opacity) : 1,
                color: f.properties.color || "#374151",
                fontSize: Number(f.properties.fontSize) || 11,
                fontWeight: f.properties.fontWeight || "normal",
                letterSpacing: Number(f.properties.letterSpacing) || 0,
              },
            };
          });

        source.setData({
          type: "FeatureCollection",
          features: pointFeatures,
        });
      }

      map.getCanvas().style.cursor = "grabbing";
    };

    const onMouseUp = async () => {
      if (!dragRef.current) return;

      const { featureId, featureType, originalCoords, currentCoords } = dragRef.current;
      dragRef.current = null;

      map.dragPan.enable();
      map.getCanvas().style.cursor = "";

      // Hide ghost marker
      const ghostSource = map.getSource("editor-points-ghost") as GeoJSONSource;
      if (ghostSource) {
        ghostSource.setData({ type: "FeatureCollection", features: [] });
      }

      // If position changed, update in DB
      if (originalCoords[0] !== currentCoords[0] || originalCoords[1] !== currentCoords[1]) {
        if (updatePointCoordinatesRef.current) {
          await updatePointCoordinatesRef.current(
            featureId,
            featureType as any,
            currentCoords
          );
        }
      }
    };

    // Wire up events
    draggableLayers.forEach((layerId) => {
      map.on("mousedown", layerId, onMouseDown);
    });

    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      draggableLayers.forEach((layerId) => {
        if (map.getStyle()) {
          map.off("mousedown", layerId, onMouseDown);
        }
      });
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
    };
  }, [map, isLoaded]);
}
