/**
 * overlay-types.ts — Shared types for the pluggable map overlay registry (Phase F).
 *
 * These types are intentionally framework-light (no React/MapLibre imports beyond
 * type-only) so the registry can be consumed by the map container, controls, and
 * renderer without dragging in heavy runtime dependencies.
 *
 * See `docs/systems/map-overlay-framework.md` for the design rationale.
 */

import type { LucideIcon } from "lucide-react";
import type { ComponentType, LazyExoticComponent } from "react";

type MapLibreMap = import("maplibre-gl").Map;

/** tRPC `api.useUtils()` return value (kept loose to avoid a hard import cycle). */
export type TRPCUtils = ReturnType<typeof import("~/trpc/react").api.useUtils>;

/**
 * How an overlay relates to the political fill layer / other overlays.
 * - `fill`     — recolors the shared `fill-political` layer; mutually exclusive
 *                with every other `fill` overlay (only one can be active).
 * - `feature`  — independent point/line features managed by IxWorldMap itself
 *                (cities, POIs, …); default-on; freely combinable.
 * - `analytics`— independent data layer drawn by an overlay component;
 *                combinable; usually default-off.
 */
export type OverlayCategory = "fill" | "feature" | "analytics";

/** Context handed to fetchers / availability gates. */
export interface OverlayFetchCtx {
  focusedCountryId?: string;
  zoom: number;
}

/** Declarative legend shapes consumed by AnalyticsLegend. */
export type OverlayLegend =
  | {
      type: "gradient";
      title: string;
      stops: { color: string; label: string }[];
      /**
       * Optional data-status note. Set by the registry entry when the metric
       * has known data-dependency requirements (e.g. needs game state to be
       * populated). Rendered as a small banner under the gradient by
       * AnalyticsLegend so users see the "all-zero / no recolor" state
       * explained rather than assuming the overlay is broken.
       */
      note?: string;
    }
  | {
      type: "line-legend";
      title: string;
      lines: { color: string; style: "solid" | "dashed"; label: string }[];
    };

/**
 * Props every overlay *component* receives from the registry-driven render loop.
 * The concrete overlay components have heterogeneous prop shapes (ChoroplethOverlay
 * needs `layerId`/`colorScale`, GeopoliticalOverlay needs `relations`/`conflicts`,
 * …). The registry bridges that gap via `renderProps`, so this type is the lowest
 * common denominator the loop relies on.
 */
export interface OverlayComponentProps {
  map: MapLibreMap | null;
  visible: boolean;
  data?: unknown;
  legend?: OverlayLegend;
  [key: string]: unknown;
}

/** Inputs available when computing a component's props in the render loop. */
export interface OverlayRenderCtx {
  map: MapLibreMap | null;
  data: unknown;
  visible: boolean;
  /** Forwarded route-click handler (used by the transport overlay). */
  onRouteClick?: (routeId: string) => void;
}

export interface OverlayPluginDefinition {
  /** Unique id; replaces the old literal `OverlayVisibility` keys. */
  id: string;
  /** Control-panel label. */
  label: string;
  category: OverlayCategory;
  icon?: LucideIcon;
  /** Whether the overlay is visible on first load. */
  defaultVisible?: boolean;
  /**
   * Fetch the GeoJSON/metadata this overlay needs. `utils = api.useUtils()`.
   * Feature overlays (managed entirely by IxWorldMap) omit this.
   */
  dataFetcher?: (utils: TRPCUtils, ctx: OverlayFetchCtx) => Promise<unknown>;
  /** Imperative MapLibre renderer (add/remove sources+layers). Lazy-loaded. */
  component?: LazyExoticComponent<ComponentType<any>>;
  /**
   * Adapter that maps the unified `{ map, data, visible }` render context to the
   * concrete component's actual prop object. Keeps the render loop generic while
   * the underlying components keep their bespoke prop shapes (equivalence-safe).
   */
  renderProps?: (ctx: OverlayRenderCtx) => Record<string, unknown> | null;
  /** Optional declarative legend. */
  legend?: OverlayLegend;
  /** Gate availability (e.g. premium, or "only when a country is focused"). */
  isAvailable?: (ctx: OverlayFetchCtx) => boolean;
}
