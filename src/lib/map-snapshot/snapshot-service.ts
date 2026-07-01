// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * MapSnapshotService — renders map previews as static PNG data-URLs from a SINGLE
 * offscreen MapLibre instance, shared by every passive embed on the page.
 *
 * Why: a live WebGL map per embed exhausts the browser's context pool (~8-16) and
 * the re-parented singleton can only be in one DOM node at a time. Passive embeds
 * don't need interactivity — they need to look right and stay in sync with the
 * origin. So we render each requested view once through one hidden map, snapshot
 * the canvas, and hand every embed an <img>. Total WebGL contexts: 1 (factory) +
 * 1 (the live/focused map) regardless of how many previews are on screen.
 *
 * Isolation: each job full-resets the style (diff:false) so the previous job's
 * layers never bleed in. Jobs run serially through a promise queue. Results are
 * cached by an opaque key (caller folds in countryId/options/dataVersion) so a
 * given view renders once until its data version bumps.
 */

import { buildBaseStyle, type ProjectionMode } from "~/lib/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

export interface SnapshotSpec {
  /** Cache key — MUST include everything that changes the pixels (country, opts, dataVersion). */
  key: string;
  /** CSS pixel size of the target <img>; capped internally. */
  width: number;
  height: number;
  theme?: MapTheme;
  projectionMode?: ProjectionMode;
  center?: [number, number];
  zoom?: number;
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  boundsPadding?: number;
  maxZoom?: number;
  /** Adds sources/layers for this view. Runs after the style is reset + view applied. */
  build: (map: any, maplibregl: any) => void;
}

// Snapshots render at devicePixelRatio for sharpness; cap the CSS size so toDataURL
// on the backing store stays cheap. ponytail: fixed cap, raise if previews look soft.
const MAX_W = 640;
const MAX_H = 480;
const IDLE_TIMEOUT_MS = 8000;
const LRU_MAX = 200;

let factoryPromise: Promise<{ map: any; maplibregl: any; container: HTMLDivElement }> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>(); // insertion order = LRU

async function getFactory() {
  if (factoryPromise) return factoryPromise;
  factoryPromise = (async () => {
    const mod = await import("maplibre-gl");
    const maplibregl = ("Map" in mod ? mod : (mod as any).default) as any;

    const container = document.createElement("div");
    // Must have real dimensions to render WebGL, but stay out of view + non-interactive.
    Object.assign(container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: `${MAX_W}px`,
      height: `${MAX_H}px`,
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    } as CSSStyleDeclaration);
    document.body.appendChild(container);

    const map = new maplibregl.Map({
      container,
      style: buildBaseStyle("standard", "mercator") as any,
      center: [10, 5],
      zoom: 3,
      attributionControl: false,
      interactive: false,
      preserveDrawingBuffer: true, // REQUIRED for toDataURL; only on this hidden instance.
      fadeDuration: 0,
    });

    await new Promise<void>((resolve) => map.once("load", () => resolve()));
    return { map, maplibregl, container };
  })();
  return factoryPromise;
}

function waitIdle(map: any): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      map.off("idle", finish);
      resolve();
    };
    const timer = setTimeout(finish, IDLE_TIMEOUT_MS);
    map.once("idle", finish);
  });
}

function applyStyle(map: any, theme: MapTheme, proj: ProjectionMode): Promise<void> {
  return new Promise((resolve) => {
    map.setStyle(buildBaseStyle(theme, proj) as any, { diff: false });
    if (map.isStyleLoaded()) resolve();
    else map.once("style.load", () => resolve());
  });
}

async function doRender(spec: SnapshotSpec): Promise<string> {
  const { map, maplibregl, container } = await getFactory();

  const w = Math.min(Math.max(1, Math.round(spec.width)), MAX_W);
  const h = Math.min(Math.max(1, Math.round(spec.height)), MAX_H);
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;
  map.resize();

  await applyStyle(map, spec.theme ?? "standard", spec.projectionMode ?? "mercator");

  if (spec.bbox) {
    map.fitBounds(
      [
        [spec.bbox.minLng, spec.bbox.minLat],
        [spec.bbox.maxLng, spec.bbox.maxLat],
      ],
      { padding: spec.boundsPadding ?? 30, maxZoom: spec.maxZoom ?? 10, duration: 0 }
    );
  } else if (spec.center) {
    map.setCenter(spec.center);
    if (spec.zoom !== undefined) map.setZoom(spec.zoom);
  }

  spec.build(map, maplibregl);

  await waitIdle(map);
  return map.getCanvas().toDataURL("image/png");
}

function evictLRU() {
  while (cache.size > LRU_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Get (or render) a snapshot PNG data-URL for the given view. Cached by `spec.key`;
 * concurrent callers with the same key share one render. Renders run serially.
 */
export function getSnapshot(spec: SnapshotSpec): Promise<string> {
  const hit = cache.get(spec.key);
  if (hit) {
    // Refresh LRU position.
    cache.delete(spec.key);
    cache.set(spec.key, hit);
    return hit;
  }

  const run = queue.then(() => doRender(spec));
  // Keep the queue alive even if this job throws.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  // Don't cache failures — allow a later retry.
  run.catch(() => {
    if (cache.get(spec.key) === run) cache.delete(spec.key);
  });

  cache.set(spec.key, run);
  evictLRU();
  return run;
}
