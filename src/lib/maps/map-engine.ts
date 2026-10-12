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
 *  - The editor starts clean: on re-acquire its style is reset (diff:false). The world surface
 *    refreshes its sources in place, so it keeps the warm map (sources, layers, tiles) and the
 *    style is reset only when the theme changed or the map last showed another realm
 *    (`warmKey`); `onReady` says so. The first acquire of a freshly-created instance never resets.
 */

import { buildBaseStyle, type ProjectionMode } from "./map-config";
import type { MapTheme } from "~/lib/map-styles/registry";
import { loadMaplibre } from "~/lib/maps/load-maplibre";

type MapRole = "world" | "editor";

interface AcquireOpts {
  container: HTMLElement;
  /** Applied only at instance CREATION (persisted view survives re-acquire on purpose). */
  initialCenter?: [number, number];
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  theme?: MapTheme;
  projectionMode?: ProjectionMode;
  interactive?: boolean;
  /**
   * World role: what the map is about to show (the realm id). A parked map that last showed something else is reset,
   * so no other realm's data is left in it. Unnamed: the realm is not known yet, and a map that last showed a named
   * one is reset too. A map that was never named takes this one.
   */
  warmKey?: string;
  /** Runs ONCE after the role's instance is created AND its style has loaded (add controls, etc.). */
  onCreate?: (map: any, maplibregl: any) => void;
  /**
   * Runs on every successful acquire, after attach + style ready + resize. `styleReset`: the base style was put
   * back, so the map's sources are empty again.
   */
  onReady?: (map: any, info: { styleReset: boolean }) => void;
}

interface SurfaceHandle {
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
  theme: MapTheme | null; // the base style currently in place
  projectionMode: ProjectionMode | null;
  warmKey: string | null; // what the map last showed (world role); null: never named
  dirty: boolean; // instance currently holds a surface's custom layers
  createdMs: number;
}

const roles = new Map<MapRole, RoleState>();
const isDev = process.env.NODE_ENV !== "production";
let liveContexts = 0;
let acquireCounter = 0;

interface StyleRequest {
  theme: MapTheme;
  projectionMode: ProjectionMode;
  /** The realm the surface will show; null: not known yet. */
  warmKey: string | null;
}

/**
 * Whether borrowing the role's map again must put the base style back. The world surface keeps its map warm: its
 * hooks refresh sources in place and it applies its projection on every mount, so only a theme change, or a map
 * that last showed another realm, resets it. Any other role starts from a clean style whenever its last surface
 * left layers or the style differs.
 */
function needsStyleReset(role: MapRole, st: RoleState, want: StyleRequest): boolean {
  if (role === "world") {
    return st.theme !== want.theme || (st.warmKey !== null && st.warmKey !== want.warmKey);
  }
  return st.dirty || st.theme !== want.theme || st.projectionMode !== want.projectionMode;
}

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
    theme: null,
    projectionMode: null,
    warmKey: null,
    dirty: false,
    createdMs: 0,
  };
  roles.set(role, st);

  const theme = opts.theme ?? "standard";
  const proj = opts.projectionMode ?? "dynamic";
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  st.base = (async () => {
    const mod = await loadMaplibre();
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
    st!.theme = theme;
    st!.projectionMode = proj;
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
    if (map[h]) {
      if (interactive) map[h].enable();
      else map[h].disable();
    }
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

  const want: StyleRequest = {
    theme: opts.theme ?? "standard",
    projectionMode: opts.projectionMode ?? "dynamic",
    warmKey: opts.warmKey ?? null,
  };

  const ready = (async () => {
    const map = await st.base!;
    if (st.activeId !== id) return map; // superseded by a newer acquire

    // Attach the warm canvas into the surface's container.
    opts.container.appendChild(st.container);

    // Reset to a clean base style when the previous surface left layers the next one must not
    // inherit, or the theme changed. A fresh instance already has the requested style.
    const styleReset = needsStyleReset(role, st, want);
    if (styleReset) {
      await new Promise<void>((res) => {
        map.setStyle(buildBaseStyle(want.theme, want.projectionMode) as any, { diff: false });
        st.theme = want.theme;
        st.projectionMode = want.projectionMode;
        st.warmKey = null;
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
    st.warmKey = want.warmKey ?? st.warmKey;
    opts.onReady?.(map, { styleReset });
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

/**
 * Name what the role's parked map shows once the surface knows it (the realm resolves after the map is borrowed), so
 * the next borrower for another realm starts clean. A role with no map yet is left alone.
 */
export function setSurfaceWarmKey(role: MapRole, warmKey: string): void {
  const st = roles.get(role);
  if (st) st.warmKey = warmKey;
}

interface MapEngineStats {
  liveContexts: number;
  roles: Array<{ role: MapRole; created: boolean; active: boolean; createdMs: number }>;
}

/** Dev instrumentation (P0): live WebGL context count + per-role init timing. */
function getMapEngineStats(): MapEngineStats {
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
function destroyAllSurfaces() {
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
