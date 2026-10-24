"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import { RealmMapFace } from "~/components/realms/RealmMapFace";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { SharedElement } from "~/components/ui/view-transition";
import { getMapGlyphsUrl } from "~/lib/base-path";
import type { CardRealmBadge } from "~/lib/cards/face/types";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import { coverView, heroNationHref, heroNationStatus } from "~/lib/realms/hero-map";
import { cn } from "~/lib/utils/cn";
import { api, type RouterOutputs } from "~/trpc/react";

type HeroGeo = NonNullable<RouterOutputs["realms"]["mapGeo"]>;
type HeroNation = HeroGeo["nations"][number]["properties"];

/** Facet colours the map draws with, read from the element so they follow the realm tint and theme. */
interface MapColours {
  water: string;
  land: string;
  tint: string;
  border: string;
  label: string;
}

/** The hover card: the nation, and where on the map it sits. */
interface Hovered {
  nation: HeroNation;
  x: number;
  y: number;
}

/** Hard zoom ceiling: the hero's geometry is simplified to about 11 km. */
const MAX_ZOOM = 5;
const HATCH = "hero-open-hatch";

/**
 * Facet colours as `rgba()`, which MapLibre parses: browsers report tokens as `color-mix(...)` or
 * `color(srgb ...)`, so each is resolved through a probe element and read back from a 1px canvas.
 */
function readColours(el: HTMLElement): MapColours {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const probe = document.createElement("span");
  el.appendChild(probe);
  const rgba = (css: string) => {
    probe.style.color = css;
    if (!ctx) return getComputedStyle(probe).color;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`;
  };
  const colours = {
    water: rgba(getComputedStyle(el).backgroundColor),
    land: rgba("var(--color-fill-3)"),
    tint: rgba("var(--tint)"),
    border: rgba("var(--color-surface)"),
    label: rgba("var(--color-label)"),
  };
  probe.remove();
  return colours;
}

/** The open-nation hatch as a MapLibre image: the land ground with a 45 degree tint stripe at 55%. */
function hatchImage(colours: MapColours): ImageData | null {
  const size = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = colours.land;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = colours.tint;
  ctx.lineWidth = size / 3;
  ctx.beginPath();
  for (const offset of [-size, 0, size]) {
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

const isHovered: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];

function heroStyle(geo: HeroGeo, colours: MapColours, labelZoom: number): StyleSpecification {
  return {
    version: 8,
    glyphs: getMapGlyphsUrl(),
    sources: {
      land: {
        type: "geojson",
        data: geo.land ?? { type: "FeatureCollection", features: [] },
      },
      nations: {
        type: "geojson",
        data: { type: "FeatureCollection", features: geo.nations },
        promoteId: "key",
      },
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": colours.water } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": colours.land } },
      {
        id: "nations",
        type: "fill",
        source: "nations",
        filter: ["!=", ["get", "status"], "open"],
        paint: {
          "fill-color": ["match", ["get", "status"], "claimed", colours.tint, colours.land],
        },
      },
      {
        id: "borders",
        type: "line",
        source: "nations",
        paint: {
          "line-color": ["case", isHovered, colours.label, colours.border],
          "line-width": ["case", isHovered, 2, 0.6],
        },
      },
      {
        id: "labels",
        type: "symbol",
        source: "nations",
        minzoom: labelZoom,
        layout: {
          "text-field": ["coalesce", ["get", "name"], ""],
          "text-font": MAP_SYMBOL_FONTS.regular,
          "text-size": 11,
          "text-max-width": 8,
        },
        paint: {
          "text-color": colours.label,
          "text-halo-color": colours.border,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}

/** Open nations in the hatch. Added once the hatch image exists: a fill-pattern laid out before its image
 * arrives stays blank on the tiles already drawn. */
function addOpenLayer(map: MapLibreMap, colours: MapColours) {
  const hatch = hatchImage(colours);
  if (!hatch) return;
  map.addImage(HATCH, hatch, { pixelRatio: 2 });
  map.addLayer(
    {
      id: "nations-open",
      type: "fill",
      source: "nations",
      filter: ["==", ["get", "status"], "open"],
      paint: { "fill-pattern": HATCH },
    },
    "borders"
  );
}

/** Repaints the map in the element's current colours (after a theme change). */
function repaint(map: MapLibreMap, colours: MapColours) {
  map.setPaintProperty("water", "background-color", colours.water);
  map.setPaintProperty("land", "fill-color", colours.land);
  map.setPaintProperty("nations", "fill-color", [
    "match",
    ["get", "status"],
    "claimed",
    colours.tint,
    colours.land,
  ]);
  map.setPaintProperty("borders", "line-color", ["case", isHovered, colours.label, colours.border]);
  map.setPaintProperty("labels", "text-color", colours.label);
  map.setPaintProperty("labels", "text-halo-color", colours.border);
  const hatch = map.hasImage(HATCH) ? hatchImage(colours) : null;
  if (hatch) map.updateImage(HATCH, hatch);
}

/** True once the browser is idle after first paint, so MapLibre never competes with the page. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setIdle(true), 200);
    return () => clearTimeout(id);
  }, []);
  return idle;
}

/** Calls `onChange` when the theme (html `data-theme` or class) or the system scheme changes. */
function useThemeChange(onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    const fire = () => latest.current();
    const observer = new MutationObserver(fire);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", fire);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", fire);
    };
  }, []);
}

interface MountOptions {
  box: HTMLDivElement;
  shell: HTMLDivElement;
  geo: HeroGeo;
  realmSlug: string;
  reduceMotion: boolean;
  hoverCapable: boolean;
  isCancelled: () => boolean;
  onLive: () => void;
  onHover: (hovered: Hovered | null) => void;
  onNavigate: (href: string) => void;
}

const nationOf = (e: MapLayerMouseEvent) => e.features?.[0]?.properties as HeroNation | undefined;

/** Hover state, the hover card and click-through on the nation layers. A touch tap shows the card, whose
 * link does the navigating. */
function wireNations(map: MapLibreMap, opts: MountOptions) {
  let hoverKey: number | null = null;
  const setHover = (key: number | null) => {
    if (hoverKey !== null)
      map.setFeatureState({ source: "nations", id: hoverKey }, { hover: false });
    hoverKey = key;
    if (key !== null) map.setFeatureState({ source: "nations", id: key }, { hover: true });
  };
  const show = (e: MapLayerMouseEvent) => {
    const nation = nationOf(e);
    if (!nation) return;
    setHover(nation.key);
    opts.onHover({ nation, x: e.point.x, y: e.point.y });
    map.getCanvas().style.cursor = heroNationHref(nation, opts.realmSlug) ? "pointer" : "";
  };
  const hide = () => {
    setHover(null);
    opts.onHover(null);
    map.getCanvas().style.cursor = "";
  };
  for (const layer of ["nations", "nations-open"]) {
    if (opts.hoverCapable) {
      map.on("mousemove", layer, show);
      map.on("mouseleave", layer, hide);
    }
    map.on("click", layer, (e) => {
      const nation = nationOf(e);
      const href = nation ? heroNationHref(nation, opts.realmSlug) : null;
      if (opts.hoverCapable && href) opts.onNavigate(href);
      else show(e);
    });
  }
}

/** Builds the live map in `box`, framed like the SVG face, or null when cancelled while MapLibre loaded. */
async function mountHeroMap(opts: MountOptions): Promise<MapLibreMap | null> {
  const maplibregl = await loadMaplibre();
  await import("maplibre-gl/dist/maplibre-gl.css");
  if (opts.isCancelled()) return null;
  const colours = readColours(opts.shell);
  const view = coverView(opts.geo.bounds, opts.box.clientWidth, opts.box.clientHeight);
  const map = new maplibregl.Map({
    container: opts.box,
    style: heroStyle(opts.geo, colours, Math.min(view.zoom + 1.5, MAX_ZOOM)),
    center: view.center,
    zoom: view.zoom,
    minZoom: Math.max(0, view.zoom - 1),
    maxZoom: Math.max(MAX_ZOOM, view.zoom + 2),
    attributionControl: false,
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: opts.reduceMotion ? 0 : 300,
  });
  map.touchZoomRotate.disableRotation();
  // Bottom-left: the top corners sit under the floating shell chrome, and "Open full map" takes bottom-right.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
  map.once("load", () => {
    addOpenLayer(map, colours);
    wireNations(map, opts);
  });
  map.once("idle", () => !opts.isCancelled() && opts.onLive());
  return map;
}

function HoverCard({
  hovered,
  href,
  touch,
}: {
  hovered: Hovered;
  href: string | null;
  touch: boolean;
}) {
  const { nation } = hovered;
  return (
    <div
      className={cn(
        "bg-popover border-separator rounded-control z-raised absolute flex max-w-56 -translate-x-1/2 -translate-y-full flex-col gap-0.5 border px-3 py-2 shadow-lg",
        !touch && "pointer-events-none"
      )}
      style={{ left: hovered.x, top: hovered.y - 10 }}
    >
      <span className="text-label text-footnote flex items-center gap-2 font-medium">
        {nation.flag && (
          <img
            src={nation.flag}
            alt=""
            referrerPolicy="no-referrer"
            className="h-3 w-5 shrink-0 rounded-sm object-cover"
          />
        )}
        <span className="truncate">{nation.name ?? "Unnamed region"}</span>
      </span>
      <span className="text-label-secondary text-caption">{heroNationStatus(nation.status)}</span>
      {touch && href && (
        <Link href={href} className="text-tint text-caption font-medium">
          {nation.status === "open" ? "Claim this nation" : "View nation"}
        </Link>
      )}
    </div>
  );
}

/**
 * A realm page's hero when it has no banner: the realm's SVG face at once (and the shared element the
 * atlas card morphs into), then, once the browser is idle, a live MapLibre map crossfaded over it.
 * Drag to pan, +/- or Ctrl/Cmd + scroll to zoom (two fingers on touch), a hover card per nation, and a click
 * through to the nation. With a banner it is just the banner.
 */
export function RealmHeroMap({
  realm,
  bannerUrl,
}: {
  realm: CardRealmBadge;
  bannerUrl: string | null;
}) {
  const router = useRouter();
  const reduceMotion = useFacetReducedMotion();
  const idle = useIdle();
  const shellRef = useRef<HTMLDivElement>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [live, setLive] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [touch, setTouch] = useState(false);
  const { data: geo } = api.realms.mapGeo.useQuery(
    { realmSlug: realm.slug },
    { enabled: idle && !bannerUrl, staleTime: 3_600_000 }
  );

  useThemeChange(() => {
    if (mapRef.current && shellRef.current) repaint(mapRef.current, readColours(shellRef.current));
  });

  useEffect(() => {
    const box = mapBoxRef.current;
    const shell = shellRef.current;
    if (!geo || !box || !shell) return undefined;
    let cancelled = false;
    const hoverCapable = window.matchMedia("(hover: hover)").matches;
    setTouch(!hoverCapable);
    void mountHeroMap({
      box,
      shell,
      geo,
      realmSlug: realm.slug,
      reduceMotion,
      hoverCapable,
      isCancelled: () => cancelled,
      onLive: () => setLive(true),
      onHover: setHovered,
      onNavigate: (href) => router.push(href),
    }).then((map) => {
      if (cancelled) map?.remove();
      else mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setLive(false);
      setHovered(null);
    };
  }, [geo, realm.slug, reduceMotion, router]);

  useEffect(() => {
    const box = mapBoxRef.current;
    if (!box || !live) return undefined;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(box);
    return () => observer.disconnect();
  }, [live]);

  if (bannerUrl) return <RealmMapFace realm={realm} bannerUrl={bannerUrl} showCrest={false} />;

  const hoveredHref = hovered ? heroNationHref(hovered.nation, realm.slug) : null;
  return (
    <div ref={shellRef} className="facet-well relative h-full w-full overflow-hidden">
      <SharedElement name={`realm-map-${realm.slug}`}>
        <RealmMapFace realm={realm} bannerUrl={null} showCrest={false} />
      </SharedElement>
      <div
        ref={mapBoxRef}
        aria-hidden={!live}
        className={cn(
          "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
          live ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      {hovered && <HoverCard hovered={hovered} href={hoveredHref} touch={touch} />}
      {live && (
        <Link
          href={`/maps?realm=${encodeURIComponent(realm.slug)}`}
          className="facet-chrome text-label text-footnote z-raised absolute right-3 bottom-3 rounded-full px-3 py-1 font-medium"
        >
          Open full map
        </Link>
      )}
    </div>
  );
}
