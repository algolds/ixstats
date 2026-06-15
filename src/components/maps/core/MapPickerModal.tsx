"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { X, MapPin, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/map-config";
import { Button } from "~/components/ui/button";

// Tree-shakeable Turf imports for containment checks
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

export interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coordinates: [number, number]) => void;
  countryId: string;
  initialCoordinates?: [number, number] | null;
  title?: string;
}

export function MapPickerModal({
  isOpen,
  onClose,
  onConfirm,
  countryId,
  initialCoordinates,
  title = "Select Location on Map",
}: MapPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(
    initialCoordinates ? [initialCoordinates[0], initialCoordinates[1]] : null
  );
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const {
    geometry,
    centroid,
    bbox,
    featureId,
    fillColor,
    subdivisions,
    worldPolitical,
    isLoading,
  } = useCountryMapEmbed(countryId);

  // Validate coordinates client-side using Turf
  const validateCoords = useCallback(
    (coords: [number, number]): boolean => {
      if (!geometry) return true; // If no geometry loaded, bypass client check
      try {
        const pt = point(coords);
        return booleanPointInPolygon(pt, geometry as any);
      } catch (err) {
        console.error("Turf containment check failed:", err);
        return true; // Fallback to server check if Turf errors
      }
    },
    [geometry]
  );

  // Set initial coordinates validation once geometry is ready
  useEffect(() => {
    if (selectedCoords && geometry) {
      setIsValid(validateCoords(selectedCoords));
    }
  }, [selectedCoords, geometry, validateCoords]);

  // Map initialization
  const initMap = useCallback(async () => {
    if (!containerRef.current || !geometry || !isOpen) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as any;
    delete baseStyle.projection; // Ensure flat Mercator projection for local picking

    const initialCenter: [number, number] = selectedCoords
      ? selectedCoords
      : centroid
        ? [centroid.lng, centroid.lat]
        : [10, 5];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: initialCenter,
      zoom: selectedCoords ? 6 : 4,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // ── Gray out other countries ──
      if (worldPolitical && worldPolitical.features.length > 0) {
        const otherCountries = {
          type: "FeatureCollection",
          features: worldPolitical.features.filter((f) => f.properties?._countryId !== countryId),
        };

        map.addSource("source-world-political", {
          type: "geojson",
          data: otherCountries as any,
        });

        map.addLayer({
          id: "world-political-fill",
          type: "fill",
          source: "source-world-political",
          paint: {
            "fill-color": "#94a3b8",
            "fill-opacity": 0.15,
          },
        });

        map.addLayer({
          id: "world-political-stroke",
          type: "line",
          source: "source-world-political",
          paint: {
            "line-color": "#64748b",
            "line-width": 0.5,
            "line-opacity": 0.3,
          },
        });
      }

      // ── Active Country borders and fill ──
      const countryColor = fillColor || (featureId ? getCountryColor(featureId) : "#c5cae9");
      const countryGeo = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { _fillColor: countryColor },
            geometry: geometry as any,
          },
        ],
      };

      map.addSource("source-country", { type: "geojson", data: countryGeo as any });

      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "source-country",
        paint: {
          "fill-color": countryColor,
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "country-stroke",
        type: "line",
        source: "source-country",
        paint: {
          "line-color": "#1e293b",
          "line-width": 1.5,
        },
      });

      // ── Subdivisions ──
      if (subdivisions && subdivisions.length > 0) {
        const subGeo = {
          type: "FeatureCollection",
          features: subdivisions
            .filter((s: any) => s.geometry)
            .map((s: any) => ({
              type: "Feature",
              properties: { name: s.name },
              geometry: s.geometry as any,
            })),
        };

        map.addSource("source-subdivisions", { type: "geojson", data: subGeo as any });

        map.addLayer({
          id: "subdivision-stroke",
          type: "line",
          source: "source-subdivisions",
          paint: {
            "line-color": "#64748b",
            "line-width": 0.5,
            "line-dasharray": [3, 2],
            "line-opacity": 0.5,
          },
        });
      }

      // Fit bounds
      if (bbox) {
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 30, maxZoom: 10, duration: 0 }
        );
      }

      // Add a marker if we have coordinates
      if (selectedCoords) {
        const marker = new maplibregl.Marker({ color: "#ef4444" })
          .setLngLat(selectedCoords)
          .addTo(map);
        markerRef.current = marker;
      }

      // Handle map clicks
      map.on("click", (e: any) => {
        const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setSelectedCoords(clickedCoords);

        // Run validation
        const valid = validateCoords(clickedCoords);
        setIsValid(valid);

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLngLat(clickedCoords);
        } else {
          const marker = new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat(clickedCoords)
            .addTo(map);
          markerRef.current = marker;
        }
      });

      setMapReady(true);
    });
  }, [
    geometry,
    centroid,
    bbox,
    fillColor,
    subdivisions,
    worldPolitical,
    countryId,
    isOpen,
    selectedCoords,
    validateCoords,
    featureId,
  ]);

  // Initialize/remove map
  useEffect(() => {
    if (isOpen && geometry) {
      const timer = setTimeout(() => initMap(), 50);
      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
          setMapReady(false);
        }
      };
    }
    return undefined;
  }, [isOpen, geometry, initMap]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedCoords && isValid !== false) {
      onConfirm(selectedCoords);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-surface glass-refraction flex h-[550px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 dark:bg-black/20">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <MapPin className="h-5 w-5 text-emerald-400" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 bg-[#0a1628]">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a1628] text-white">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm text-white/60">Loading map data...</p>
            </div>
          ) : !geometry ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a1628] p-6 text-center text-white">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <p className="text-sm font-semibold">No map boundary linked</p>
              <p className="max-w-xs text-xs text-white/50">
                Your country has no boundary coordinates assigned. Contact an administrator to link
                it.
              </p>
            </div>
          ) : (
            <>
              {/* Map container */}
              <div ref={containerRef} className="absolute inset-0 h-full w-full" />

              {/* Status Bar Overlay */}
              <div className="pointer-events-none absolute top-4 right-4 left-4 z-10">
                {selectedCoords ? (
                  isValid ? (
                    <div className="glass-surface inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/80 px-3 py-2 text-xs font-semibold text-emerald-400 shadow-lg backdrop-blur-md">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span>
                        Valid Location: {selectedCoords[1].toFixed(5)}&deg;,{" "}
                        {selectedCoords[0].toFixed(5)}&deg;
                      </span>
                    </div>
                  ) : (
                    <div className="glass-surface inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/80 px-3 py-2 text-xs font-semibold text-red-400 shadow-lg backdrop-blur-md">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Warning: Coordinates lie outside your country borders!</span>
                    </div>
                  )
                ) : (
                  <div className="glass-surface inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs font-semibold text-white/80 shadow-lg backdrop-blur-md">
                    <MapPin className="h-4 w-4 shrink-0 animate-bounce" />
                    <span>Click on the map inside your borders to select a point</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-white/5 px-6 py-4 dark:bg-black/20">
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCoords || isValid === false || !mapReady}
            className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
