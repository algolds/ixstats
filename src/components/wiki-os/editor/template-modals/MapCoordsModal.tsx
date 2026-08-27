"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Xmark as X, Map as MapIcon, SystemRestart as Loader2, Compass } from "iconoir-react";
import { api } from "~/trpc/react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/maps/map-config";
import { Portal, type BaseModalProps } from "./types";

type MapCoordsTab = "coords" | "mapembed";

export function MapCoordsModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [activeTab, setActiveTab] = useState<MapCoordsTab>("coords");
  const [lat, setLat] = useState("0");
  const [lng, setLng] = useState("0");
  const [zoom, setZoom] = useState(5);
  const [label, setLabel] = useState("");

  // MapEmbed specific states
  const [embedHeight, setEmbedHeight] = useState(400);
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedInteractive, setEmbedInteractive] = useState(true);

  // Map rendering refs/state
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<any>(null);

  const markerRef = useRef<any>(null);
  const [_mapLoaded, setMapLoaded] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const { data: userWithRole } = api.users.getCurrentUserWithRole.useQuery();
  const viewerCountryId = userWithRole?.user?.country?.id;

  const {
    geometry,
    centroid,
    bbox,
    fillColor,
    featureId,
    subdivisions,
    worldPolitical,
    cities,
    pois,
    isLoading: isMapBundleLoading,
  } = useCountryMapEmbed(viewerCountryId);

  // Reset inputs when opening
  useEffect(() => {
    if (isOpen) {
      setLat("0");
      setLng("0");
      setZoom(5);
      setLabel("");
      setEmbedHeight(400);
      setEmbedWidth("100%");
      setEmbedInteractive(true);
      setMapLoaded(false);

      // Focus label input
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Center on country centroid if available
  useEffect(() => {
    if (isOpen && centroid) {
      setLat(centroid.lat.toFixed(5));
      setLng(centroid.lng.toFixed(5));
    }
  }, [isOpen, centroid]);

  // Close on Escape keypress
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle marker selection from quick list
  const handleMarkerSelect = (markerLat: number, markerLng: number, markerName: string) => {
    setLat(markerLat.toFixed(5));
    setLng(markerLng.toFixed(5));
    setLabel(markerName);

    // Update map coordinates
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [markerLng, markerLat], zoom: 8 });

      // Move marker
      if (markerRef.current) {
        markerRef.current.setLngLat([markerLng, markerLat]);
      }
    }
  };

  // Initialize MapLibre
  const initMapLibre = useCallback(async () => {
    if (!mapContainerRef.current || !isOpen) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as any;
    delete baseStyle.projection; // Enforce Mercator projection

    const mapCenterLat = parseFloat(lat) || (centroid ? centroid.lat : 0);
    const mapCenterLng = parseFloat(lng) || (centroid ? centroid.lng : 0);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: baseStyle,
      center: [mapCenterLng, mapCenterLat],
      zoom: centroid ? 5 : 2,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 1. Overlay world bounds and gray out non-owned countries
      if (worldPolitical && worldPolitical.features && viewerCountryId) {
        const otherCountries = {
          type: "FeatureCollection",
          features: worldPolitical.features.filter(
            (f) => f.properties?._countryId !== viewerCountryId
          ),
        };

        map.addSource("other-countries", { type: "geojson", data: otherCountries as any });
        map.addLayer({
          id: "other-countries-fill",
          type: "fill",
          source: "other-countries",
          paint: {
            "fill-color": "#475569",
            "fill-opacity": 0.2,
          },
        });
      }

      // 2. Active Country borders
      if (geometry && viewerCountryId) {
        const activeColor = fillColor || (featureId ? getCountryColor(featureId) : "#6366f1");
        const activeGeo = {
          type: "FeatureCollection",

          features: [{ type: "Feature", properties: {}, geometry: geometry as any }],
        };

        map.addSource("active-country", { type: "geojson", data: activeGeo as any });
        map.addLayer({
          id: "active-country-stroke",
          type: "line",
          source: "active-country",
          paint: {
            "line-color": activeColor,
            "line-width": 2,
          },
        });

        // 3. Subdivisions
        if (subdivisions && subdivisions.length > 0) {
          const subGeo = {
            type: "FeatureCollection",
            features: subdivisions

              .filter((s: any) => s.geometry)

              .map((s: any) => ({
                type: "Feature",
                properties: {},

                geometry: s.geometry as any,
              })),
          };

          map.addSource("active-subdivisions", { type: "geojson", data: subGeo as any });
          map.addLayer({
            id: "active-subdivisions-stroke",
            type: "line",
            source: "active-subdivisions",
            paint: {
              "line-color": "#475569",
              "line-width": 0.5,
              "line-dasharray": [3, 2],
              "line-opacity": 0.5,
            },
          });
        }
      }

      // 4. Fit bounds of owned country
      if (bbox) {
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 20, maxZoom: 8, duration: 0 }
        );
      }

      // 5. Place Marker at starting coordinates
      const startMarker = new maplibregl.Marker({ color: "#f43f5e" })
        .setLngLat([mapCenterLng, mapCenterLat])
        .addTo(map);
      markerRef.current = startMarker;

      // Click listener to grab coordinates

      map.on("click", (e: any) => {
        const clickedLng = e.lngLat.lng;
        const clickedLat = e.lngLat.lat;

        setLat(clickedLat.toFixed(5));
        setLng(clickedLng.toFixed(5));

        if (markerRef.current) {
          markerRef.current.setLngLat([clickedLng, clickedLat]);
        }
      });

      setMapLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    centroid,
    geometry,
    worldPolitical,
    bbox,
    viewerCountryId,
    fillColor,
    featureId,
    subdivisions,
    isOpen,
  ]);

  // Load/Unload map
  useEffect(() => {
    if (isOpen && !isMapBundleLoading) {
      const timer = setTimeout(() => {
        initMapLibre();
      }, 100);
      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
        }
      };
    }
    return undefined;
  }, [isOpen, isMapBundleLoading, initMapLibre]);

  if (!isOpen) return null;

  const handleInsertLink = () => {
    const l = parseFloat(lat);
    const g = parseFloat(lng);
    if (isNaN(l) || isNaN(g)) return;

    if (activeTab === "coords") {
      const lbl = label.trim() ? `|${label.trim()}` : "";
      onInsert(`[[Coords:${l.toFixed(5)},${g.toFixed(5)},${zoom}${lbl}]]`);
    } else {
      const options = [
        `height=${embedHeight}`,
        `width=${embedWidth}`,
        `interactive=${embedInteractive ? "yes" : "no"}`,
      ];
      if (label.trim()) {
        options.push(`title=${label.trim()}`);
      }
      onInsert(`[[MapEmbed:${l.toFixed(5)},${g.toFixed(5)},${zoom}|${options.join("|")}]]`);
    }
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="border-border bg-card/95 text-foreground dark:bg-card/95 relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl dark:border-white/15"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-b px-6 py-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
              <MapIcon className="h-5 w-5 text-emerald-400" />
              Insert Map Coords &amp; Embeds
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors active:scale-95 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel: Configuration */}
            <div className="border-border bg-muted/10 flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r p-6 dark:border-white/10 dark:bg-white/[0.02]">
              {/* Tab Selector */}
              <div className="border-border bg-secondary flex shrink-0 rounded-lg border p-0.5">
                <button
                  onClick={() => setActiveTab("coords")}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                    activeTab === "coords"
                      ? "bg-emerald-500/20 text-emerald-400 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coords Link
                </button>
                <button
                  onClick={() => setActiveTab("mapembed")}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                    activeTab === "mapembed"
                      ? "bg-emerald-500/20 text-emerald-400 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Map Embed
                </button>
              </div>

              {/* Coordinates status */}
              <div className="border-border bg-muted/30 grid shrink-0 grid-cols-2 gap-3 rounded-lg border p-3">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                    Latitude (Y)
                  </span>
                  <span className="text-foreground font-mono text-sm font-semibold">{lat}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                    Longitude (X)
                  </span>
                  <span className="text-foreground font-mono text-sm font-semibold">{lng}</span>
                </div>
              </div>

              {/* Markers Picker */}
              <div className="shrink-0 space-y-1.5">
                <label className="text-foreground block text-xs font-semibold">
                  Quick Select Existing Marker
                </label>
                <div className="border-border divide-border bg-muted/20 max-h-36 scrollbar-thin divide-y overflow-y-auto rounded-lg border text-xs">
                  {isMapBundleLoading && (
                    <div className="text-muted-foreground flex items-center gap-1.5 p-3">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Loading
                      features...
                    </div>
                  )}
                  {!isMapBundleLoading &&
                    cities.map((c: any) => (
                      <button
                        key={`city-${c.id}`}
                        type="button"
                        onClick={() =>
                          handleMarkerSelect(c.coordinates[1], c.coordinates[0], c.name)
                        }
                        className="hover:bg-muted/50 flex w-full items-center justify-between px-2.5 py-1.5 text-left transition-colors"
                      >
                        <span className="text-foreground font-semibold">{c.name}</span>
                        <span className="text-muted-foreground text-[9px] font-bold uppercase">
                          {c.isNationalCapital ? "Capital" : "City"}
                        </span>
                      </button>
                    ))}
                  {!isMapBundleLoading &&
                    pois.map((p: any) => (
                      <button
                        key={`poi-${p.id}`}
                        type="button"
                        onClick={() =>
                          handleMarkerSelect(p.coordinates[1], p.coordinates[0], p.name)
                        }
                        className="hover:bg-muted/50 flex w-full items-center justify-between px-2.5 py-1.5 text-left transition-colors"
                      >
                        <span className="text-foreground">{p.name}</span>
                        <span className="bg-muted text-muted-foreground rounded px-1.5 text-[9px] capitalize">
                          {p.category}
                        </span>
                      </button>
                    ))}
                  {!isMapBundleLoading && cities.length === 0 && pois.length === 0 && (
                    <div className="text-muted-foreground p-3 text-center">
                      No markers found in database.
                    </div>
                  )}
                </div>
              </div>

              {/* Shared parameters */}
              <div className="shrink-0 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-foreground block text-xs font-semibold">
                    {activeTab === "coords" ? "Link Label (Required)" : "Marker Title (Optional)"}
                  </label>
                  <input
                    type="text"
                    required={activeTab === "coords"}
                    placeholder={activeTab === "coords" ? "e.g. Royal Palace" : "e.g. My Capital"}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-2 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-foreground block text-xs font-semibold">
                    Map Zoom level ({zoom})
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={18}
                    step={1}
                    value={zoom}
                    onChange={(e) => {
                      const newZ = parseInt(e.target.value);
                      setZoom(newZ);
                      if (mapRef.current) {
                        mapRef.current.setZoom(newZ);
                      }
                    }}
                    className="bg-muted h-1 w-full cursor-pointer appearance-none rounded-lg accent-emerald-500"
                  />
                </div>
              </div>

              {/* Embed parameters */}
              {activeTab === "mapembed" && (
                <div className="border-border shrink-0 space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <label className="text-foreground block text-xs font-semibold">
                      Embed Height (px)
                    </label>
                    <input
                      type="number"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(parseInt(e.target.value) || 400)}
                      className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-foreground block text-xs font-semibold">
                      Embed Width
                    </label>
                    <input
                      type="text"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(e.target.value)}
                      className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={embedInteractive}
                      onChange={(e) => setEmbedInteractive(e.target.checked)}
                      className="border-input bg-secondary rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-foreground text-xs">Interactive panning / zoom</span>
                  </label>
                </div>
              )}

              {/* Syntax preview */}
              <div className="mt-auto shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center font-mono text-[11px] text-emerald-400">
                {activeTab === "coords" ? (
                  <span>
                    [[Coords:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}
                    {label.trim() ? `|${label.trim()}` : ""}]]
                  </span>
                ) : (
                  <span className="break-all">
                    [[MapEmbed:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}
                    |height={embedHeight}|width={embedWidth}|interactive=
                    {embedInteractive ? "yes" : "no"}
                    {label.trim() ? `|title=${label}` : ""}]]
                  </span>
                )}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleInsertLink}
                disabled={activeTab === "coords" && !label.trim()}
                className="w-full shrink-0 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-50"
              >
                Insert Map Feature
              </button>
            </div>

            {/* Right Panel: Map Canvas */}
            <div className="bg-background relative flex-1">
              {isMapBundleLoading ? (
                <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-semibold">Loading border layers...</span>
                </div>
              ) : (
                <>
                  <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
                  {/* Status Indicator overlay */}
                  <div className="pointer-events-none absolute top-4 left-4 z-10">
                    <div className="border-border bg-card/85 text-foreground flex items-center gap-2 rounded-lg border p-2.5 text-xs shadow-lg backdrop-blur-md">
                      <Compass className="animate-spin-slow h-4 w-4 text-emerald-400" />
                      <span>Click on map to capture pin coords</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
