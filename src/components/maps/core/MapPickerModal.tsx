"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { FacetMaterial } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import { useEffect, useRef, useCallback, useState } from "react";
import { MapPin, WarningTriangle as AlertTriangle, CheckCircle } from "iconoir-react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/maps/map-config";
import { Button } from "~/components/ui/button";

// Tree-shakeable Turf imports for containment checks
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { loadMaplibre } from "~/lib/maps/load-maplibre";

interface MapPickerModalProps {
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
  // initMap reads the latest selection for its initial view/marker only; keeping it out of the
  // initMap deps stops every click from rebuilding the whole map.
  const selectedCoordsRef = useRef(selectedCoords);
  useEffect(() => {
    selectedCoordsRef.current = selectedCoords;
  }, [selectedCoords]);

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
      // oxlint-disable-next-line
      setIsValid(validateCoords(selectedCoords));
    }
  }, [selectedCoords, geometry, validateCoords]);

  // Map initialization
  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!containerRef.current || !geometry || !isOpen) return;

      // maplibre-gl 6 is ESM-only, so the module namespace itself carries the
      // named exports (Map, Popup, …).
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Closed/unmounted (or deps changed) while MapLibre was loading — don't create an orphan map.
      if (isCancelled() || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const baseStyle = buildBaseStyle() as any;
      delete baseStyle.projection; // Ensure flat Mercator projection for local picking

      const initialCoords = selectedCoordsRef.current;
      const initialCenter: [number, number] = initialCoords
        ? initialCoords
        : centroid
          ? [centroid.lng, centroid.lat]
          : [10, 5];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: initialCenter,
        zoom: initialCoords ? 6 : 4,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (isCancelled()) return;
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
        if (initialCoords) {
          const marker = new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat(initialCoords)
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
    },
    [
      geometry,
      centroid,
      bbox,
      fillColor,
      subdivisions,
      worldPolitical,
      countryId,
      isOpen,
      validateCoords,
      featureId,
    ]
  );

  // Initialize/remove map
  useEffect(() => {
    if (isOpen && geometry) {
      let cancelled = false;
      const timer = setTimeout(() => void initMap(() => cancelled), 50);
      return () => {
        cancelled = true;
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-card flex h-[550px] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* Header */}
        <DialogHeader className="border-separator border-b px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="text-blue h-5 w-5" aria-hidden />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="bg-map-ocean relative flex-1">
          {isLoading ? (
            <div
              role="status"
              className="bg-map-ocean absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
              <Skeleton className="bg-fill-4 h-3 w-40" />
              <p className="text-body text-white/70">Loading map data…</p>
            </div>
          ) : !geometry ? (
            <div className="bg-map-ocean absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <AlertTriangle className="text-yellow h-10 w-10" aria-hidden />
              <p className="text-headline">No map boundary linked</p>
              <p className="text-footnote max-w-xs text-white/70">
                Your country has no boundary coordinates assigned. Contact an administrator to link
                it.
              </p>
            </div>
          ) : (
            <>
              {/* Map container */}
              <div ref={containerRef} className="absolute inset-0 h-full w-full" />

              {/* Status overlay */}
              <div className="pointer-events-none absolute top-4 right-4 left-4 z-10">
                <FacetMaterial
                  material="regular"
                  role="status"
                  className="rounded-control text-caption inline-flex items-center gap-2 px-3 py-2 font-semibold"
                >
                  {selectedCoords ? (
                    isValid ? (
                      <>
                        <CheckCircle className="text-green h-4 w-4 shrink-0" aria-hidden />
                        <span className="text-label">
                          Valid location: {selectedCoords[1].toFixed(5)}&deg;,{" "}
                          {selectedCoords[0].toFixed(5)}&deg;
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="text-destructive h-4 w-4 shrink-0" aria-hidden />
                        <span className="text-destructive">
                          These coordinates lie outside your country&apos;s borders.
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <MapPin className="text-label-secondary h-4 w-4 shrink-0" aria-hidden />
                      <span className="text-label">
                        Click on the map inside your borders to select a point
                      </span>
                    </>
                  )}
                </FacetMaterial>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-separator flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCoords || isValid === false || !mapReady}
            className="bg-blue text-on-blue hover:bg-blue/90"
          >
            Confirm selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
