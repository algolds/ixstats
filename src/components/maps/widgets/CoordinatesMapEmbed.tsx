"use client";

/**
 * Coordinate-focused MapLibre widget. Its map is built when it scrolls near the viewport and released when it is
 * more than a viewport away (a page allows about 16 WebGL contexts); new data goes into the map it has.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { buildBaseStyle, MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import { api } from "~/trpc/react";
import { useDecodedMapLayers } from "~/hooks/useMapLayerData";
import { MapPin, SystemRestart as Loader2 } from "iconoir-react";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import {
  clampFlatCenterLat,
  fromCarrier,
  toCarrierGeoJSON,
  toCarrierLngLat,
} from "~/lib/maps/flat-projection";
import { addGeoLayers, type LayerDef } from "~/components/maps/shared/geo-layers";
import { useEmbedInRange } from "~/components/maps/widgets/hooks/useEmbedInRange";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { IXNAY_SLUG } from "~/lib/realms/realm-ids";
import { cn } from "~/lib/utils/cn";

export interface EmbedPoliticalFeature {
  featureId: string;
  displayName: string;
  fillColor: string;
  countryId: string | null;
  centroidLng: number;
  centroidLat: number;
}

interface CoordinatesMapEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
  options?: string; // height=400|width=100%|interactive=yes|title=My Title
  /**
   * The realm slug whose map the coordinates are on. Omitted: Ixnay inside an IxWiki article (its lore is
   * Ixnay's, whoever reads it); inside another wiki's article, the realm whose lore index holds it; else the
   * viewer's realm.
   */
  realm?: string;
  /** False: a plain realm map, with no marker at the coordinates and no coordinates label. */
  marker?: boolean;
  className?: string;
  /**
   * Pixels of the map's right side covered by a floating panel (the front page's realm Lens). The
   * camera centres in the uncovered part, and the world repeats sideways so the glass always has map
   * under it and panning never runs into an edge.
   */
  insetRight?: number;
  onCountryHover?: (country: EmbedPoliticalFeature | null) => void;
  onCountryClick?: (country: EmbedPoliticalFeature) => void;
}

/** Popup title as a text node: the title comes from wiki markup, so it is never parsed as HTML. */
export function buildPopupTitleNode(title: string): HTMLDivElement {
  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  titleEl.style.cssText =
    "color: #000; font-family: sans-serif; font-size: 12px; font-weight: bold; padding: 2px;";
  return titleEl;
}

/**
 * The realm whose map an embed's coordinates are on: the given slug, Ixnay in an IxWiki article, else undefined:
 * another wiki's article asks `realms.map.realmForWikiArticle` (`needsWikiRealmLookup`), anything else shows the
 * viewer's realm.
 */
export function embedRealm(
  realm: string | undefined,
  wiki: { isWikiPage: boolean; articleSource: string }
): string | undefined {
  return realm ?? (wiki.isWikiPage && wiki.articleSource === "ixwiki" ? IXNAY_SLUG : undefined);
}

/** A non-IxWiki article without an explicit realm: its realm is looked up from its wiki and title. */
export function needsWikiRealmLookup(
  realm: string | undefined,
  wiki: { isWikiPage: boolean; articleSource: string }
): boolean {
  return !realm && wiki.isWikiPage && wiki.articleSource !== "ixwiki";
}

const POLITICAL_SOURCE_ID = "source-world-political";
const POLITICAL_FILL_ID = "world-political-fill";

const POLITICAL_LAYERS: LayerDef[] = [
  {
    id: POLITICAL_FILL_ID,
    type: "fill",
    paint: {
      "fill-color": ["coalesce", ["get", "_fillColor"], ["get", "fillColor"], "#c5cae9"],
      "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.72, 0.45],
    },
  },
  {
    id: "world-political-stroke",
    type: "line",
    paint: {
      "line-color": "#475569",
      "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.6, 0.8],
      "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.5],
    },
  },
  {
    id: "world-political-labels",
    type: "symbol",
    layout: {
      "text-field": ["coalesce", ["get", "_displayName"], ["get", "name"], ""],
      "text-size": 10,
      "text-allow-overlap": false,
      "text-optional": true,
      "text-font": [...MAP_SYMBOL_FONTS.regular],
    },
    paint: {
      "text-color": "#475569",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
      "text-opacity": 0.8,
    },
    minzoom: 2,
  },
];

function toPoliticalFeature(
  props: Record<string, string | number | boolean | null | undefined> | null | undefined,
  fallbackLngLat: { lng: number; lat: number }
): EmbedPoliticalFeature {
  const rawCountryId = props?._countryId ?? props?.countryId;
  const countryId =
    typeof rawCountryId === "string" && rawCountryId.length > 0 && rawCountryId !== "null"
      ? rawCountryId
      : null;
  const rawName = props?._displayName ?? props?.name;
  const displayName =
    typeof rawName === "string" && rawName.length > 0 ? rawName : "Unclaimed territory";
  const rawFill = props?._fillColor ?? props?.fillColor;
  const fillColor = typeof rawFill === "string" && rawFill.length > 0 ? rawFill : "#c5cae9";
  const rawFeatureId = props?._id ?? props?.id;
  const featureId = typeof rawFeatureId === "string" ? rawFeatureId : String(rawFeatureId ?? "");
  const centroidLng =
    typeof props?._centroidLng === "number" ? props._centroidLng : fallbackLngLat.lng;
  const centroidLat =
    typeof props?._centroidLat === "number" ? props._centroidLat : fallbackLngLat.lat;

  return {
    featureId,
    displayName,
    fillColor,
    countryId,
    centroidLng,
    centroidLat,
  };
}

function setPoliticalHover(map: MapLibreMap, id: number | null, hover: boolean) {
  if (id === null || !map.getSource(POLITICAL_SOURCE_ID)) return;
  try {
    map.setFeatureState({ source: POLITICAL_SOURCE_ID, id }, { hover });
  } catch {
    // Source may still be updating
  }
}

/**
 * Show the political layer (in Plate Carrée, as the flat map draws it): its data goes into the source the
 * map already has, else the source and layers are added.
 */
function showPolitical(map: MapLibreMap, data: FeatureCollection) {
  const flat = toCarrierGeoJSON(data);
  const source = map.getSource(POLITICAL_SOURCE_ID) as GeoJSONSource | undefined;
  if (source) source.setData(flat);
  else addGeoLayers(map, POLITICAL_SOURCE_ID, flat, POLITICAL_LAYERS);
}

export function CoordinatesMapEmbed({
  lat,
  lng,
  zoom = 5,
  options = "",
  realm: realmProp,
  marker = true,
  className,
  insetRight,
  onCountryHover,
  onCountryClick,
}: CoordinatesMapEmbedProps) {
  const wiki = useWikiContext();
  const explicitRealm = embedRealm(realmProp, wiki);
  const lookupRealm = needsWikiRealmLookup(explicitRealm, wiki);
  const elementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHoverRef = useRef(onCountryHover);
  const onClickRef = useRef(onCountryClick);

  useEffect(() => {
    onHoverRef.current = onCountryHover;
    onClickRef.current = onCountryClick;
  }, [onCountryHover, onCountryClick]);

  const inRange = useEmbedInRange(elementRef);
  const [mapReady, setMapReady] = useState(false);

  const parsedOptions = useMemo(
    () =>
      Object.fromEntries(
        options
          .split("|")
          .map((opt) => opt.split("="))
          .filter(
            (parts): parts is [string, string] => parts.length === 2 && !!parts[0] && !!parts[1]
          )
          .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
      ) as Record<string, string>,
    [options]
  );

  const heightVal = parsedOptions.height
    ? isNaN(Number(parsedOptions.height))
      ? parsedOptions.height
      : `${parsedOptions.height}px`
    : "300px";
  const interactiveVal = parsedOptions.interactive !== "no";
  const titleVal = parsedOptions.title || "";

  // Another wiki's article: the realm whose lore index holds it (else the viewer's realm)
  const { data: wikiRealm, isFetched: wikiRealmFetched } =
    api.realms.map.realmForWikiArticle.useQuery(
      { wikiSource: wiki.articleSource, title: wiki.articleTitle ?? "" },
      { enabled: lookupRealm && inRange, staleTime: 60 * 60_000 }
    );
  const realm = explicitRealm ?? wikiRealm?.slug ?? undefined;

  // The political layer /maps downloads (same packed URL, same cache)
  const { layers: worldMap } = useDecodedMapLayers({
    layers: ["political"],
    realm,
    enabled: inRange && (!lookupRealm || wikiRealmFetched),
  });

  const worldPolitical = worldMap?.political;

  // A covered map repeats sideways (see insetRight)
  const wraps = insetRight !== undefined;

  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!containerRef.current) return;

      // maplibre-gl 6 is ESM-only, so the module namespace itself carries the
      // named exports (Map, Popup, …).
      const maplibregl = await loadMaplibre();
      await import("maplibre-gl/dist/maplibre-gl.css");
      // Unmounted (or deps changed) while MapLibre was loading — don't create an orphan map.
      if (isCancelled() || !containerRef.current) return;

      const baseStyle: any = buildBaseStyle();
      // Flat, in Plate Carrée drawn through Mercator (flat-projection.ts): no polar swelling or cut
      delete baseStyle.projection;
      const container = containerRef.current;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle,
        center: toCarrierLngLat(lng, lat),
        // Never past a pole; a map that doesn't repeat stays within ±180°
        transformConstrain: (center, z) => ({
          center: new maplibregl.LngLat(
            wraps ? center.lng : Math.max(-180, Math.min(180, center.lng)),
            clampFlatCenterLat(center.lat, z, container.clientHeight)
          ),
          zoom: z,
        }),
        zoom: zoom,
        minZoom: marker ? undefined : zoom,
        renderWorldCopies: wraps,
        dragRotate: false,
        touchPitch: false,
        attributionControl: false,
        interactive: interactiveVal,
        // Touch: one finger scrolls the page, two pan the map.
        cooperativeGestures: window.matchMedia("(pointer: coarse)").matches,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (isCancelled()) return;
        if (marker) {
          const pin = new maplibregl.Marker({ color: "#ef4444" })
            .setLngLat(toCarrierLngLat(lng, lat))
            .addTo(map);
          if (titleVal) {
            pin.setPopup(
              new maplibregl.Popup({ offset: 25 }).setDOMContent(buildPopupTitleNode(titleVal))
            );
          }
        }

        if (interactiveVal) {
          const cancelHoverClear = () => {
            if (hoverClearTimerRef.current !== null) {
              clearTimeout(hoverClearTimerRef.current);
              hoverClearTimerRef.current = null;
            }
          };

          map.on("mousemove", (e: MapMouseEvent) => {
            if (!map.getLayer(POLITICAL_FILL_ID)) return;
            const feature = map.queryRenderedFeatures(e.point, {
              layers: [POLITICAL_FILL_ID],
            })[0];
            const nextId = typeof feature?.id === "number" ? feature.id : null;

            if (feature && nextId !== null) {
              cancelHoverClear();
              if (hoveredIdRef.current !== nextId) {
                setPoliticalHover(map, hoveredIdRef.current, false);
                hoveredIdRef.current = nextId;
                setPoliticalHover(map, nextId, true);
                onHoverRef.current?.(toPoliticalFeature(feature.properties, fromCarrier(e.lngLat)));
              }
              map.getCanvas().style.cursor = "pointer";
              return;
            }

            if (hoveredIdRef.current !== null) {
              setPoliticalHover(map, hoveredIdRef.current, false);
              hoveredIdRef.current = null;
              map.getCanvas().style.cursor = "";
              cancelHoverClear();
              hoverClearTimerRef.current = setTimeout(() => {
                hoverClearTimerRef.current = null;
                onHoverRef.current?.(null);
              }, 100);
            }
          });

          map.getCanvas().addEventListener("mouseleave", () => {
            cancelHoverClear();
            setPoliticalHover(map, hoveredIdRef.current, false);
            hoveredIdRef.current = null;
            map.getCanvas().style.cursor = "";
            onHoverRef.current?.(null);
          });

          map.on("click", (e: MapMouseEvent) => {
            if (!map.getLayer(POLITICAL_FILL_ID)) return;
            const feature = map.queryRenderedFeatures(e.point, {
              layers: [POLITICAL_FILL_ID],
            })[0];
            if (!feature) return;
            onClickRef.current?.(toPoliticalFeature(feature.properties, fromCarrier(e.lngLat)));
          });
        }

        setMapReady(true);
      });
    },
    // insetRight itself is applied by its own effect
    [lat, lng, zoom, interactiveVal, titleVal, marker, wraps]
  );

  useEffect(() => {
    if (!inRange) return undefined;
    let cancelled = false;
    // Small delay to ensure container has layout dimensions
    const timer = setTimeout(() => void initMap(() => cancelled), 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (hoverClearTimerRef.current !== null) {
        clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      hoveredIdRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [initMap, inRange]);

  // A covered right side moves the camera's centre, without rebuilding the map
  useEffect(() => {
    if (mapReady) mapRef.current?.setPadding({ right: insetRight ?? 0 });
  }, [mapReady, insetRight]);

  // New data goes into the map it has: the map is built once, not again when the layer arrives or changes
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !worldPolitical?.features?.length) return;
    showPolitical(map, worldPolitical);
  }, [mapReady, worldPolitical]);

  // Resize map when container dimensions change
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
    // oxlint-disable-next-line
  }, [mapReady]);

  return (
    <div
      ref={elementRef}
      data-app="maps"
      className={cn(
        "wikios-ixworld-embed bg-map-ocean/40 rounded-row border-separator relative overflow-hidden border",
        className
      )}
      style={{ height: heightVal }}
    >
      {inRange && <div ref={containerRef} className="absolute inset-0 h-full w-full" />}

      {!mapReady && (
        <div className="bg-map-ocean/60 absolute inset-0 z-10 flex flex-col items-center justify-center">
          <Loader2 className="text-tint mb-2 h-6 w-6 animate-spin" />
          <span className="text-caption text-label-secondary">Loading map...</span>
        </div>
      )}

      {mapReady && marker && (
        <div className="facet-chrome rounded-control text-footnote text-label-secondary pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1 select-none">
          <MapPin className="text-tint h-2.5 w-2.5" />
          <span className="font-semibold">{titleVal || "Map Embed"}</span>
          <span className="text-footnote text-label-secondary font-mono">
            ({lat.toFixed(3)}, {lng.toFixed(3)})
          </span>
        </div>
      )}
    </div>
  );
}
