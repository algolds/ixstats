/**
 * overlay-registry.ts — Declarative catalog of every map overlay (Phase F).
 *
 * One entry per overlay. The map container (visibility/fetch/toggle), the controls
 * panel (toggle UI grouped by category), and the renderer (IxWorldMap render loop)
 * all read from this single source of truth, so adding a data-driven overlay is a
 * ~30-line registry entry instead of edits across four files.
 *
 * Behavior parity: the 5 pre-existing overlays (wealth, population, crises,
 * diplomacy, transport) plus the feature toggles (cities, pois, subdivisions,
 * storyPins, mapLabels) are registered here with their original ids, labels,
 * defaults, and data so the map keeps working identically.
 *
 * See `docs/systems/map-overlay-framework.md`.
 */

import { lazy } from "react";
import {
  City as Building2,
  MapPin,
  Map as LandPlot,
  OpenBook as BookOpen,
  Label as Tag,
  StatUp as TrendingUp,
  Group as Users,
  Network,
  WarningTriangle as AlertTriangle,
  DeliveryTruck as Truck,
  Activity,
  Dashboard as Gauge,
  Heart,
  ScaleFrameEnlarge as Scale,
  FireFlame as Flame,
} from "iconoir-react";
import type { FeatureCollection } from "geojson";
import type {
  OverlayLegend,
  OverlayPluginDefinition,
  OverlayRenderCtx,
  TRPCUtils,
} from "./overlay-types";

// Lazy overlay components (mirrors the original IxWorldMap lazy imports so the
// render path keeps the same chunking / Suspense behavior).
const ChoroplethOverlay = lazy(() =>
  import("~/components/maps/overlays/ChoroplethOverlay").then((m) => ({
    default: m.ChoroplethOverlay,
  }))
);
const RiskHeatmapOverlay = lazy(() =>
  import("~/components/maps/overlays/RiskHeatmapOverlay").then((m) => ({
    default: m.RiskHeatmapOverlay,
  }))
);
const GeopoliticalOverlay = lazy(() =>
  import("~/components/maps/overlays/GeopoliticalOverlay").then((m) => ({
    default: m.GeopoliticalOverlay,
  }))
);
const TransportOverlay = lazy(() =>
  import("~/components/maps/overlays/TransportOverlay").then((m) => ({
    default: m.TransportOverlay,
  }))
);

// ── Legend constants (match AnalyticsLegend's original LEGENDS exactly) ──────

const WEALTH_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Wealth Map — GDP per Capita",
  stops: [
    { color: "#94a3b8", label: "Low" },
    { color: "#6ee7b7", label: "" },
    { color: "#34d399", label: "Mid" },
    { color: "#fbbf24", label: "" },
    { color: "#f59e0b", label: "High" },
  ],
};

const POPULATION_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Population Density",
  stops: [
    { color: "#e0f2fe", label: "Sparse" },
    { color: "#7dd3fc", label: "" },
    { color: "#6366f1", label: "Mid" },
    { color: "#a855f7", label: "" },
    { color: "#ec4899", label: "Dense" },
  ],
};

const CRISES_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Crisis Risk",
  stops: [
    { color: "#22c55e", label: "Low" },
    { color: "#facc15", label: "Moderate" },
    { color: "#f97316", label: "Elevated" },
    { color: "#dc2626", label: "High" },
  ],
};

const DIPLOMACY_LEGEND: OverlayLegend = {
  type: "line-legend",
  title: "Diplomatic Relations",
  lines: [
    { color: "#22c55e", style: "solid", label: "Friendly" },
    { color: "#f59e0b", style: "dashed", label: "Neutral" },
    { color: "#ef4444", style: "solid", label: "Hostile" },
  ],
};

const TRANSPORT_LEGEND: OverlayLegend = {
  type: "line-legend",
  title: "Transport Network",
  lines: [
    { color: "#374151", style: "solid", label: "Rail" },
    { color: "#f97316", style: "solid", label: "Highway" },
    { color: "#92400e", style: "dashed", label: "Road" },
    { color: "#3b82f6", style: "dashed", label: "Shipping" },
  ],
};

// New overlays reuse the choropleth fill renderer with their own legend titles.
const ECONOMIC_TIER_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Economic Tier — GDP per Capita",
  stops: [
    { color: "#94a3b8", label: "Low" },
    { color: "#6ee7b7", label: "" },
    { color: "#34d399", label: "Mid" },
    { color: "#fbbf24", label: "" },
    { color: "#f59e0b", label: "High" },
  ],
};

const VITALITY_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Economic Vitality",
  stops: [
    { color: "#94a3b8", label: "Low" },
    { color: "#6ee7b7", label: "" },
    { color: "#34d399", label: "Mid" },
    { color: "#fbbf24", label: "" },
    { color: "#f59e0b", label: "High" },
  ],
};

// Health legend: green-toned (distinct from WEALTH_LEGEND's slate→emerald→amber).
// Green-only gradient so the two wealth-adjacent legends don't collide visually.
const HEALTH_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Health Map — National Health Index",
  stops: [
    { color: "#bbf7d0", label: "Low" },
    { color: "#86efac", label: "" },
    { color: "#4ade80", label: "Mid" },
    { color: "#16a34a", label: "" },
    { color: "#15803d", label: "High" },
  ],
};

// MAINTENANCE: Trade balance is a signed metric (negative = deficit, positive =
// surplus), so the ideal legend is diverging (red→neutral→green). The current
// `choroplethRenderProps` helper only supports sequential scales
// ("wealth" | "population" | "neutral"), so this v1 legend is a sequential
// blue/slate gradient that reads as "balance magnitude". A follow-up plan should
// extend the helper with a "diverging" scale option and update this legend.
const TRADE_BALANCE_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Trade Balance (surplus → deficit)",
  stops: [
    { color: "#e0f2fe", label: "Surplus" },
    { color: "#7dd3fc", label: "" },
    { color: "#64748b", label: "Balanced" },
    { color: "#94a3b8", label: "" },
    { color: "#475569", label: "Deficit" },
  ],
};

const CANON_DENSITY_LEGEND: OverlayLegend = {
  type: "gradient",
  title: "Canon Density — Story Heat",
  stops: [
    { color: "#fef9c3", label: "Quiet" },
    { color: "#fde047", label: "" },
    { color: "#f97316", label: "Active" },
    { color: "#dc2626", label: "" },
    { color: "#7f1d1d", label: "Story-Dense" },
  ],
};

// ── renderProps adapters ────────────────────────────────────────────────────
// Bridge the unified render context to each component's concrete prop shape so
// IxWorldMap can render every overlay from one loop without rewriting components.

/** ChoroplethOverlay-style fill: data is a FeatureCollection (+ optional metadata). */
function choroplethRenderProps(
  colorScale: "wealth" | "population" | "neutral" | "canon",
  layerId: string
) {
  return ({ map, data, visible }: OverlayRenderCtx) => {
    if (!data) return null;
    const fc = data as FeatureCollection & {
      metadata?: { minVal: number; maxVal: number };
    };
    return {
      map,
      data: fc,
      visible,
      layerId,
      colorScale,
      metadata: fc.metadata,
    };
  };
}

// ── Registry ────────────────────────────────────────────────────────────────

export const OVERLAY_REGISTRY: Record<string, OverlayPluginDefinition> = {
  // ── Feature overlays (managed by IxWorldMap's own layers; default-on) ──
  // No component/fetcher: their visibility is driven by IxWorldMap's overlay
  // visibility effect. Registered so the controls panel is fully data-driven.
  cities: {
    id: "cities",
    label: "Cities",
    category: "feature",
    icon: Building2,
    defaultVisible: true,
  },
  pois: {
    id: "pois",
    label: "Points of Interest",
    category: "feature",
    icon: MapPin,
    defaultVisible: true,
  },
  subdivisions: {
    id: "subdivisions",
    label: "Regions",
    category: "feature",
    icon: LandPlot,
    defaultVisible: true,
  },
  storyPins: {
    id: "storyPins",
    label: "Story Pins",
    category: "feature",
    icon: BookOpen,
    defaultVisible: true,
  },
  mapLabels: {
    id: "mapLabels",
    label: "Map Labels",
    category: "feature",
    icon: Tag,
    defaultVisible: true,
  },

  // ── Fill overlays (recolor fill-political; mutually exclusive) ──
  wealth: {
    id: "wealth",
    label: "Wealth Map",
    category: "fill",
    icon: TrendingUp,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "gdpPerCapita",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("wealth", "wealth"),
    legend: WEALTH_LEGEND,
  },
  population: {
    id: "population",
    label: "Population Density",
    category: "fill",
    icon: Users,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "population",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("population", "population"),
    legend: POPULATION_LEGEND,
  },
  crises: {
    id: "crises",
    label: "Crisis Hotspots",
    category: "fill",
    icon: AlertTriangle,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) => utils.geoCore.getCrisisRiskMap.fetch({}),
    component: RiskHeatmapOverlay,
    renderProps: ({ map, data, visible }: OverlayRenderCtx) => {
      if (!data) return null;
      const d = data as {
        riskMap: FeatureCollection;
        crisisEvents: FeatureCollection;
      };
      return {
        map,
        riskData: d.riskMap,
        crisisEvents: d.crisisEvents,
        visible,
      };
    },
    legend: CRISES_LEGEND,
  },

  // ── Analytics overlays (independent layers; combinable; default-off) ──
  diplomacy: {
    id: "diplomacy",
    label: "Diplomatic Network",
    category: "analytics",
    icon: Network,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getGeopoliticalOverlay
        .fetch()
        .then((d) => ({ relations: d.relations, conflicts: d.conflicts })),
    component: GeopoliticalOverlay,
    renderProps: ({ map, data, visible }: OverlayRenderCtx) => {
      if (!data) return null;
      const d = data as {
        relations: FeatureCollection;
        conflicts: FeatureCollection;
      };
      return {
        map,
        relations: d.relations,
        conflicts: d.conflicts,
        visible,
      };
    },
    legend: DIPLOMACY_LEGEND,
  },
  transport: {
    id: "transport",
    label: "Transport Routes",
    category: "analytics",
    icon: Truck,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) => utils.transport.getAllRoutesGeoJSON.fetch({}),
    component: TransportOverlay,
    renderProps: ({ map, data, visible, onRouteClick }: OverlayRenderCtx) => {
      if (!data) return null;
      return {
        map,
        routeData: data as FeatureCollection,
        visible,
        onRouteClick: onRouteClick ? (id: string) => onRouteClick(id) : undefined,
      };
    },
    legend: TRANSPORT_LEGEND,
  },

  // ── NEW overlays — prove the ~30-line registry path (reuse ChoroplethOverlay) ──
  economicTier: {
    id: "economicTier",
    label: "Economic Tier",
    category: "fill",
    icon: Activity,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "gdpPerCapita",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("wealth", "economicTier"),
    legend: ECONOMIC_TIER_LEGEND,
  },
  vitality: {
    id: "vitality",
    label: "Economic Vitality",
    category: "fill",
    icon: Gauge,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "vitality",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("wealth", "vitality"),
    legend: VITALITY_LEGEND,
  },
  health: {
    id: "health",
    label: "Health Map",
    category: "fill",
    icon: Heart,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "health",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("neutral", "health"),
    legend: HEALTH_LEGEND,
  },
  tradeBalance: {
    id: "tradeBalance",
    label: "Trade Balance",
    category: "fill",
    icon: Scale,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) =>
      utils.geoCore.getRegionalChoropleth.fetch({
        metric: "tradeBalance",
        groupBy: "country",
      }),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("neutral", "tradeBalance"),
    legend: TRADE_BALANCE_LEGEND,
  },
  canonDensity: {
    id: "canonDensity",
    label: "Canon Density",
    category: "fill",
    icon: Flame,
    defaultVisible: false,
    dataFetcher: (utils: TRPCUtils) => utils.geoCore.getCanonDensity.fetch(),
    component: ChoroplethOverlay,
    renderProps: choroplethRenderProps("canon", "canonDensity"),
    legend: CANON_DENSITY_LEGEND,
  },
};

/** Ordered list view of the registry (insertion order = display order). */
export const OVERLAY_LIST: OverlayPluginDefinition[] = Object.values(OVERLAY_REGISTRY);

/** Ids of fill-category overlays (mutually exclusive group). */
export const FILL_OVERLAY_IDS: string[] = OVERLAY_LIST.filter((o) => o.category === "fill").map(
  (o) => o.id
);

/** Build the default visibility map from `defaultVisible` flags. */
export function buildDefaultVisibility(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const def of OVERLAY_LIST) {
    out[def.id] = !!def.defaultVisible;
  }
  return out;
}

/** Toggle an overlay, enforcing category-based mutual exclusivity for "fill". */
export function applyOverlayToggle(
  prev: Record<string, boolean>,
  id: string
): Record<string, boolean> {
  const def = OVERLAY_REGISTRY[id];
  const next: Record<string, boolean> = { ...prev, [id]: !prev[id] };
  if (next[id] && def?.category === "fill") {
    for (const o of OVERLAY_LIST) {
      if (o.id !== id && o.category === "fill") next[o.id] = false;
    }
  }
  return next;
}

/** Overlays grouped by category, preserving registry order. */
export function overlaysByCategory(): Record<string, OverlayPluginDefinition[]> {
  const groups: Record<string, OverlayPluginDefinition[]> = {
    feature: [],
    fill: [],
    analytics: [],
  };
  for (const def of OVERLAY_LIST) {
    (groups[def.category] ??= []).push(def);
  }
  return groups;
}
