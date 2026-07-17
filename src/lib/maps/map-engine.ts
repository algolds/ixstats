// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * Map Engine (P1) — persistent, per-ROLE MapLibre instances.
 *
 * Goal: the map "loads once". Heavy surfaces (main world map, editor) each keep ONE
 * long-lived MapLibre instance that is PARKED in a hidden holder on unmount instead of
 * destroyed, so navigating away and back re-attaches a warm instance (no WebGL context
 * recreation, no style/glyph/sprite reload, no data refetch — data is already React-Query
 * cached).
 *
 * Roles are SEPARATE instances (world ≠ editor), so — unlike the old single re-parented
 * SharedMapContext — two surfaces never fight over one canvas. Embeds are NOT handled here
 * in P1 (they stay standalone; a bounded embed pool is P2).
 *
 * Lessons baked in:
 *  - Module singleton, not a React context → no context-value churn re-render loops.
 *  - Readiness is a single awaited Promise (resolved on load / style.load), never a poller.
 *  - Every acquire gets a unique id; stale acquires are guarded out (StrictMode-safe).
 *  - On re-acquire the style is reset (diff:false) so the borrowing surface starts clean;
 *    the first acquire of a freshly-created instance skips the reset.
 */

import { buildBaseStyle, type ProjectionMode } from "~/lib/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";

export type MapRole = "world" | "editor";

export interface AcquireOpts {
  container: HTMLElement;
  /** Applied only at instance CREATION (persisted view survives re-acquire on purpose). */
  initialCenter?: [number, number];
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  theme?: MapTheme;
  projectionMode?: ProjectionMode;
  interactive?: boolean;
  /** Runs ONCE after the role's instance is created AND its style has loaded (add controls, etc.). */
  onCreate?: (map: any, maplibregl: any) => void;
  /** Runs on every successful acquire, after attach + style ready + resize. */
  onReady?: (map: any) => void;
}

export interface SurfaceHandle {
  ready: Promise<any>;
  getMap: () => any | null;
  release: () => void;
}

interface RoleState {
  map: any | null;
  holder: HTMLDivElement;
  container: HTMLDivElement;
  base: Promise<any> | null; // resolves once, on first 'load'
  activeId: number | null;
  styleKey: string | null;
  dirty: boolean; // instance currently holds a surface's custom layers
  createdMs: number;
}

const roles = new Map<MapRole, RoleState>();
const isDev = process.env.NODE_ENV !== "production";
let liveContexts = 0;
let acquireCounter = 0;

const styleKeyOf = (theme: MapTheme, proj: ProjectionMode) => `${theme}::${proj}`;

function makeHolder(): HTMLDivElement {
  const holder = document.createElement("div");
  // display:none stops rendering while parked; context is preserved, needs resize on show.
  holder.style.cssText = "display:none;";
  document.body.appendChild(holder);
  return holder;
}

function ensureRole(role: MapRole, opts: AcquireOpts): RoleState {
  let st = roles.get(role);
  if (st) return st;

  const holder = makeHolder();
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  holder.appendChild(container);

  st = {
    map: null,
    holder,
    container,
    base: null,
    activeId: null,
    styleKey: null,
    dirty: false,
    createdMs: 0,
  };
  roles.set(role, st);

  const theme = opts.theme ?? "standard";
  const proj = opts.projectionMode ?? "dynamic";
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  st.base = (async () => {
    const mod = await import("maplibre-gl");
    const maplibregl = ("Map" in mod ? mod : (mod as any).default) as any;

    const map = new maplibregl.Map({
      container,
      style: buildBaseStyle(theme, proj) as any,
      center: opts.initialCenter ?? [0, 0],
      zoom: opts.initialZoom ?? 1,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
      attributionControl: false,
      dragRotate: false,
    });
    st!.map = map;
    st!.styleKey = styleKeyOf(theme, proj);
    liveContexts++;

    // Wait for the style to load BEFORE onCreate — style-dependent calls (e.g.
    // setProjection) throw "Style is not done loading" if run any earlier.
    await new Promise<void>((res) => map.once("load", () => res()));
    // A throwing onCreate must not reject the shared base promise (would blank every
    // acquire of this role). Log and continue.
    try {
      opts.onCreate?.(map, maplibregl);
    } catch (err) {
      console.error(`[map-engine] onCreate for role "${role}" threw:`, err);
    }
    st!.createdMs = typeof performance !== "undefined" ? performance.now() - t0 : 0;

    if (isDev && typeof window !== "undefined") {
      console.info(
        `[map-engine] created role "${role}" in ${st!.createdMs.toFixed(0)}ms · live WebGL contexts: ${liveContexts}`
      );
      (window as any).__mapEngine = { getStats: getMapEngineStats };
    }
    return map;
  })();

  return st;
}

function applyInteractivity(map: any, interactive?: boolean) {
  if (interactive === undefined) return;
  const handlers = [
    "boxZoom",
    "doubleClickZoom",
    "dragPan",
    "keyboard",
    "scrollZoom",
    "touchZoomRotate",
  ];
  for (const h of handlers) {
    if (map[h]) interactive ? map[h].enable() : map[h].disable();
  }
}

/**
 * Borrow the persistent instance for `role`, attaching it to `opts.container`.
 * Returns synchronously; await `handle.ready` (or use `opts.onReady`) for the live map.
 * Call `handle.release()` on unmount to park the instance (kept warm, NOT destroyed).
 */
export function acquireSurface(role: MapRole, opts: AcquireOpts): SurfaceHandle {
  const st = ensureRole(role, opts);
  const id = ++acquireCounter;
  st.activeId = id;

  const requestedStyleKey = styleKeyOf(opts.theme ?? "standard", opts.projectionMode ?? "dynamic");

  const ready = (async () => {
    const map = await st.base!;
    if (st.activeId !== id) return map; // superseded by a newer acquire

    // Attach the warm canvas into the surface's container.
    opts.container.appendChild(st.container);

    // Reset to a clean base style if the instance is dirty (previous surface's layers)
    // or the theme/projection changed. Skips on the first acquire of a fresh instance.
    if (st.dirty || st.styleKey !== requestedStyleKey) {
      await new Promise<void>((res) => {
        map.setStyle(
          buildBaseStyle(opts.theme ?? "standard", opts.projectionMode ?? "dynamic") as any,
          { diff: false }
        );
        st.styleKey = requestedStyleKey;
        if (map.isStyleLoaded()) res();
        else map.once("style.load", () => res());
      });
      if (st.activeId !== id) return map;
    }

    applyInteractivity(map, opts.interactive);
    // Re-parenting changes layout bounds; resize on the next frame.
    requestAnimationFrame(() => {
      if (st.activeId === id) map.resize();
    });

    st.dirty = true;
    opts.onReady?.(map);
    return map;
  })();

  return {
    ready,
    getMap: () => (st.activeId === id ? st.map : null),
    release: () => {
      if (st.activeId !== id) return;
      st.activeId = null;
      // Park: move the canvas back to the hidden holder, keep the instance warm.
      st.holder.appendChild(st.container);
    },
  };
}

export interface MapEngineStats {
  liveContexts: number;
  roles: Array<{ role: MapRole; created: boolean; active: boolean; createdMs: number }>;
}

/** Dev instrumentation (P0): live WebGL context count + per-role init timing. */
export function getMapEngineStats(): MapEngineStats {
  return {
    liveContexts,
    roles: Array.from(roles.entries()).map(([role, st]) => ({
      role,
      created: !!st.map,
      active: st.activeId !== null,
      createdMs: st.createdMs,
    })),
  };
}

/** Tear down every persistent instance (used on HMR dispose to avoid orphaned canvases). */
export function destroyAllSurfaces() {
  for (const st of roles.values()) {
    try {
      st.map?.remove();
    } catch {
      /* ignore */
    }
    try {
      st.holder?.remove();
    } catch {
      /* ignore */
    }
  }
  roles.clear();
  liveContexts = 0;
  acquireCounter = 0;
}

// Dev-only: dispose the singleton on hot reload so old parked instances/holders don't
// orphan and collide with the freshly-evaluated module.
if (isDev && typeof module !== "undefined" && (module as any).hot) {
  (module as any).hot.dispose(() => destroyAllSurfaces());
}
