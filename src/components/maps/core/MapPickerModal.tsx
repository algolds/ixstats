"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { FacetMaterial } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import { useEffect, useRef, useCallback, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Feature, Geometry } from "geojson";
import { MapPin, WarningTriangle as AlertTriangle, CheckCircle } from "iconoir-react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/maps/map-config";
import { Button } from "~/components/ui/button";

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { addGeoLayers } from "~/components/maps/shared/geo-layers";

type EmbedData = ReturnType<typeof useCountryMapEmbed>;

/** Draw the picked country (plus greyed neighbours and subdivision outlines) and fit to its bounds. */
function drawCountryLayers(
  map: MapLibreMap,
  countryId: string,
  { geometry, bbox, featureId, fillColor, subdivisions, worldPolitical }: EmbedData
) {
  if (worldPolitical?.features.length) {
    addGeoLayers(
      map,
      "source-world-political",
      worldPolitical.features.filter((f) => f.properties?._countryId !== countryId),
      [
        {
          id: "world-political-fill",
          type: "fill",
          paint: { "fill-color": "#94a3b8", "fill-opacity": 0.15 },
        },
        {
          id: "world-political-stroke",
          type: "line",
          paint: { "line-color": "#64748b", "line-width": 0.5, "line-opacity": 0.3 },
        },
      ]
    );
  }

  const countryColor = fillColor || (featureId ? getCountryColor(featureId) : "#c5cae9");
  addGeoLayers(
    map,
    "source-country",
    [{ type: "Feature", properties: { _fillColor: countryColor }, geometry: geometry as Geometry }],
    [
      {
        id: "country-fill",
        type: "fill",
        paint: { "fill-color": countryColor, "fill-opacity": 0.35 },
      },
      {
        id: "country-stroke",
        type: "line",
        paint: { "line-color": "#1e293b", "line-width": 1.5 },
      },
    ]
  );

  if (subdivisions?.length) {
    addGeoLayers(
      map,
      "source-subdivisions",
      subdivisions
        .filter((s) => s.geometry)
        .map((s): Feature => ({
          type: "Feature",
          properties: { name: s.name },
          geometry: s.geometry as Geometry,
        })),
      [
        {
          id: "subdivision-stroke",
          type: "line",
          paint: {
            "line-color": "#64748b",
            "line-width": 0.5,
            "line-dasharray": [3, 2],
            "line-opacity": 0.5,
          },
        },
      ]
    );
  }

  if (bbox) {
    map.fitBounds(
      [
        [bbox.minLng, bbox.minLat],
        [bbox.maxLng, bbox.maxLat],
      ],
      { padding: 30, maxZoom: 10, duration: 0 }
    );
  }
}

function PickerStatus({
  coords,
  isValid,
}: {
  coords: [number, number] | null;
  isValid: boolean | null;
}) {
  const { Icon, iconClass, textClass, text } = !coords
    ? {
        Icon: MapPin,
        iconClass: "text-label-secondary",
        textClass: "text-label",
        text: "Click on the map inside your borders to select a point",
      }
    : isValid
      ? {
          Icon: CheckCircle,
          iconClass: "text-green",
          textClass: "text-label",
          text: `Valid location: ${coords[1].toFixed(5)}\u00b0, ${coords[0].toFixed(5)}\u00b0`,
        }
      : {
          Icon: AlertTriangle,
          iconClass: "text-destructive",
          textClass: "text-destructive",
          text: "These coordinates lie outside your country's borders.",
        };

  return (
    <FacetMaterial
      layer="chrome"
      role="status"
      className="rounded-control text-caption inline-flex items-center gap-2 px-3 py-2 font-semibold"
    >
      <Icon className={`${iconClass} h-4 w-4 shrink-0`} aria-hidden />
      <span className={textClass}>{text}</span>
    </FacetMaterial>
  );
}

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
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(
    initialCoordinates ? [initialCoordinates[0], initialCoordinates[1]] : null
  );
  // initMap reads the latest selection for its initial view/marker only; keeping it out of the
  // initMap deps stops every click from rebuilding the whole map.
  const selectedCoordsRef = useRef(selectedCoords);
  useEffect(() => {
    selectedCoordsRef.current = selectedCoords;
  }, [selectedCoords]);

  const embedData = useCountryMapEmbed(countryId);
  const { geometry, isLoading } = embedData;

  // Client-side containment check; without geometry (or if Turf errors) the server decides.
  const validateCoords = useCallback(
    (coords: [number, number]): boolean => {
      if (!geometry) return true;
      try {
        return booleanPointInPolygon(point(coords), geometry as any);
      } catch (err) {
        console.error("Turf containment check failed:", err);
        return true;
      }
    },
    [geometry]
  );
  const isValid = selectedCoords && geometry ? validateCoords(selectedCoords) : null;

  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!containerRef.current || !embedData.geometry || !isOpen) return;

      // maplibre-gl 6 is ESM-only, so the module namespace itself carries the
      // named exports (Map, Popup, …).
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Closed/unmounted (or deps changed) while MapLibre was loading — don't create an orphan map.
      if (isCancelled() || !containerRef.current) return;

      mapRef.current?.remove();

      const baseStyle = buildBaseStyle() as any;
      delete baseStyle.projection; // Ensure flat Mercator projection for local picking

      const initialCoords = selectedCoordsRef.current;
      const { centroid } = embedData;
      const initialCenter: [number, number] =
        initialCoords ?? (centroid ? [centroid.lng, centroid.lat] : [10, 5]);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: initialCenter,
        zoom: initialCoords ? 6 : 4,
        attributionControl: false,
      });
      mapRef.current = map;

      const placeMarker = (coords: [number, number]) => {
        if (markerRef.current) markerRef.current.setLngLat(coords);
        else
          markerRef.current = new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat(coords)
            .addTo(map);
      };

      map.on("load", () => {
        if (isCancelled()) return;
        drawCountryLayers(map, countryId, embedData);
        if (initialCoords) placeMarker(initialCoords);

        map.on("click", (e) => {
          const clicked: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          setSelectedCoords(clicked);
          placeMarker(clicked);
        });

        setMapReady(true);
      });
    },
    [embedData, countryId, isOpen]
  );

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
        <DialogHeader className="border-separator border-b px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="text-blue h-5 w-5" aria-hidden />
            {title}
          </DialogTitle>
        </DialogHeader>

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
              <div ref={containerRef} className="absolute inset-0 h-full w-full" />
              <div className="pointer-events-none absolute top-4 right-4 left-4 z-10">
                <PickerStatus coords={selectedCoords} isValid={isValid} />
              </div>
            </>
          )}
        </div>

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
