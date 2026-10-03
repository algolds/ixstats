import { MAP_SYMBOL_FONTS } from "~/lib/maps/map-config";
import type { SourcelessLayer } from "./map-helpers";

type LayerOf<T extends SourcelessLayer["type"]> = Extract<SourcelessLayer, { type: T }>;
type Filter = LayerOf<"circle">["filter"];
type SymbolPaint = NonNullable<LayerOf<"symbol">["paint"]>;
type CirclePaint = NonNullable<LayerOf<"circle">["paint"]>;

const WHITE = "#ffffff";
const regularFont = () => [...MAP_SYMBOL_FONTS.regular];
const isTouchDevice = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;

export const circle = (
  id: string,
  paint: LayerOf<"circle">["paint"],
  filter?: Filter
): SourcelessLayer => ({ id, type: "circle", paint, ...(filter && { filter }) });

export const line = (
  id: string,
  paint: LayerOf<"line">["paint"],
  extra: { filter?: Filter; layout?: LayerOf<"line">["layout"] } = {}
): SourcelessLayer => ({ id, type: "line", paint, ...extra });

export const fill = (id: string, paint: LayerOf<"fill">["paint"]): SourcelessLayer => ({
  id,
  type: "fill",
  paint,
});

export const symbol = (
  id: string,
  layout: LayerOf<"symbol">["layout"],
  paint: LayerOf<"symbol">["paint"],
  filter?: Filter
): SourcelessLayer => ({ id, type: "symbol", layout, paint, ...(filter && { filter }) });

/** White-haloed label paint shared by most editor text layers. */
const labelPaint = (
  color: SymbolPaint["text-color"],
  haloWidth = 1.5,
  extra: SymbolPaint = {}
): SymbolPaint => ({
  "text-color": color,
  "text-halo-color": WHITE,
  "text-halo-width": haloWidth,
  ...extra,
});

const NO_FEATURE: Filter = ["==", ["get", "id"], ""];
const featureTypeIs = (type: string): Filter => ["==", ["get", "featureType"], type];

/** Translucent fill plus dashed outline, used by the gap / empty-region / lasso overlays. */
function fillAndDashedStroke(
  prefix: string,
  fillColor: string,
  fillOpacity: number,
  strokeColor: string,
  dash: [number, number]
): SourcelessLayer[] {
  return [
    fill(`${prefix}-fill`, { "fill-color": fillColor, "fill-opacity": fillOpacity }),
    line(`${prefix}-stroke`, {
      "line-color": strokeColor,
      "line-width": 1.5,
      "line-dasharray": dash,
    }),
  ];
}

export const COUNTRY_BOUNDARY_LAYERS: SourcelessLayer[] = [
  fill("editor-country-fill", { "fill-color": WHITE, "fill-opacity": 0.12 }),
  line("editor-country-stroke", {
    "line-color": "#10b981",
    "line-width": 2,
    "line-dasharray": [2, 2],
  }),
];

export const COUNTRY_MASK_LAYERS: SourcelessLayer[] = [
  fill("editor-nonplayer-mask-fill", { "fill-color": "#0f172a", "fill-opacity": 0.4 }),
];

export const GRID_LAYER_ID = "editor-grid-lines";
export const GRID_LABEL_ID = "editor-grid-labels";

export const GRID_LAYERS: SourcelessLayer[] = [
  line(GRID_LAYER_ID, {
    "line-color": "#64748b",
    "line-width": 0.8,
    "line-opacity": 0.4,
    "line-dasharray": [4, 4],
  }),
  symbol(
    GRID_LABEL_ID,
    {
      "symbol-placement": "line",
      "text-field": ["get", "label"],
      "text-size": 9,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-max-angle": 90,
      "text-offset": [0, -0.6],
      "text-font": regularFont(),
    },
    {
      "text-color": "#64748b",
      "text-opacity": 0.5,
      "text-halo-color": "#0f172a",
      "text-halo-width": 1,
    }
  ),
];

export const POINT_GHOST_LAYERS: SourcelessLayer[] = [
  circle("editor-points-ghost-layer", {
    "circle-radius": 6,
    "circle-color": "#a1a1aa",
    "circle-opacity": 0.4,
    "circle-stroke-color": "#52525b",
    "circle-stroke-width": 1.5,
    "circle-stroke-opacity": 0.5,
  }),
];

const pointCircle = (
  id: string,
  filter: Filter,
  radius: number,
  color: string,
  strokeWidth: number,
  extra: CirclePaint = {}
) =>
  circle(
    id,
    {
      "circle-radius": radius,
      "circle-color": color,
      "circle-stroke-color": WHITE,
      "circle-stroke-width": strokeWidth,
      ...extra,
    },
    filter
  );

export const POINT_LAYERS: SourcelessLayer[] = [
  pointCircle("editor-points-capital", ["==", ["get", "isCapital"], true], 7, "#f59e0b", 2),
  pointCircle(
    "editor-points-city",
    ["all", featureTypeIs("city"), ["!=", ["get", "isCapital"], true]],
    5,
    "#3b82f6",
    1.5
  ),
  pointCircle("editor-points-poi", featureTypeIs("poi"), 4, "#f59e0b", 1),
  pointCircle("editor-points-story-pin", featureTypeIs("storyPin"), 5, "#a855f7", 1.5),
  pointCircle("editor-points-peak", featureTypeIs("peak"), 5, "#78716c", 1.5),
  pointCircle("editor-points-map-label", featureTypeIs("mapLabel"), 4, "#94a3b8", 1, {
    "circle-opacity": 0.6,
  }),
  symbol(
    "editor-points-labels",
    {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-font": regularFont(),
    },
    labelPaint("#374151"),
    ["!=", ["get", "featureType"], "mapLabel"]
  ),
  symbol(
    "editor-map-labels",
    {
      "text-field": ["get", "name"],
      "text-size": ["get", "fontSize"],
      "text-rotate": ["get", "rotation"],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-font": [
        "match",
        ["get", "fontWeight"],
        "bold",
        ["literal", MAP_SYMBOL_FONTS.bold],
        ["literal", MAP_SYMBOL_FONTS.regular],
      ],
    },
    labelPaint(["get", "color"], 1.5, { "text-opacity": ["get", "opacity"] }),
    featureTypeIs("mapLabel")
  ),
  circle(
    "editor-points-selected",
    {
      "circle-radius": ["case", ["==", ["get", "isCapital"], true], 10, 8],
      "circle-color": "#f59e0b",
      "circle-opacity": 0.35,
      "circle-stroke-color": WHITE,
      "circle-stroke-width": 2,
    },
    NO_FEATURE
  ),
];

export const RIVER_LINE_LAYERS: SourcelessLayer[] = [
  line(
    "editor-lines",
    {
      "line-color": "#0284c7",
      "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 3.5],
      "line-opacity": 0.9,
    },
    { layout: { "line-cap": "round", "line-join": "round" } }
  ),
];

export function subdivisionLayers(regionsOpacity: number): SourcelessLayer[] {
  return [
    fill("editor-subdivisions-fill", {
      "fill-color": ["coalesce", ["get", "color"], "#7c3aed"],
      "fill-opacity": 0.05 * regionsOpacity,
    }),
    line("editor-subdivisions-stroke", {
      "line-color": "#7c3aed",
      "line-width": 1.5,
      "line-dasharray": [3, 2],
      "line-opacity": regionsOpacity,
    }),
    symbol(
      "editor-subdivisions-labels",
      {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "symbol-sort-key": 1,
        "text-font": regularFont(),
      },
      labelPaint("#6d28d9", 1.5, { "text-opacity": regionsOpacity })
    ),
    line(
      "editor-subdivisions-hover",
      { "line-color": "#2563eb", "line-width": 3 },
      { filter: NO_FEATURE }
    ),
    line(
      "editor-subdivisions-selected",
      { "line-color": "#f59e0b", "line-width": 3 },
      { filter: NO_FEATURE }
    ),
  ];
}

export const PENDING_POINT_LAYERS: SourcelessLayer[] = [
  circle("editor-pending-point-layer", {
    "circle-radius": 8,
    "circle-color": "#10b981",
    "circle-stroke-color": WHITE,
    "circle-stroke-width": 2,
    "circle-opacity": 0.8,
  }),
];

export const ROUTE_LINE_LAYERS: SourcelessLayer[] = [
  line("editor-route-line-layer", {
    "line-color": "#6366f1",
    "line-width": 3,
    "line-opacity": 0.9,
  }),
];

export const ROUTE_POINT_LAYERS: SourcelessLayer[] = [
  circle("editor-route-points-layer", {
    "circle-radius": 5,
    "circle-color": WHITE,
    "circle-stroke-color": "#6366f1",
    "circle-stroke-width": 2,
  }),
];

export const ROUTE_MIDPOINT_LAYERS: SourcelessLayer[] = [
  symbol(
    "editor-route-midpoint-labels-layer",
    {
      "text-field": ["get", "label"],
      "text-size": 9,
      "text-font": regularFont(),
      "text-allow-overlap": true,
    },
    labelPaint("#4f46e5")
  ),
];

export const GAP_LAYERS = fillAndDashedStroke("editor-gaps", "#f59e0b", 0.15, "#d97706", [2, 2]);
export const EMPTY_REGION_LAYERS = fillAndDashedStroke(
  "editor-empty-subdivisions",
  "#06b6d4",
  0.15,
  "#0891b2",
  [3, 3]
);
export const LASSO_LAYERS = fillAndDashedStroke("editor-lasso", "#3b82f6", 0.1, "#2563eb", [2, 2]);

export const RULER_LAYERS: SourcelessLayer[] = [
  line(
    "editor-ruler-line",
    { "line-color": "#f59e0b", "line-width": 2 },
    { filter: ["==", ["get", "type"], "line"] }
  ),
  circle(
    "editor-ruler-points",
    {
      "circle-color": "#d97706",
      "circle-radius": 4.5,
      "circle-stroke-color": WHITE,
      "circle-stroke-width": 1.5,
    },
    ["==", ["get", "type"], "point"]
  ),
  symbol(
    "editor-ruler-labels",
    {
      "text-field": ["get", "distance"],
      "text-size": 10,
      "text-anchor": "center",
      "text-offset": [0, -1],
      "text-font": ["Noto Sans Bold", "Arial Unicode MS Bold"],
    },
    labelPaint("#d97706", 2),
    ["==", ["get", "type"], "label"]
  ),
];

const vertexCircle = (id: string, strokeColor: string) => {
  const touch = isTouchDevice();
  return circle(id, {
    "circle-radius": touch ? 10 : 6,
    "circle-color": WHITE,
    "circle-stroke-color": strokeColor,
    "circle-stroke-width": touch ? 3 : 2.5,
  });
};

const midpointCircle = (id: string, color: string) =>
  circle(id, {
    "circle-radius": 4,
    "circle-color": color,
    "circle-opacity": 0.5,
    "circle-stroke-color": WHITE,
    "circle-stroke-width": 1,
  });

/**
 * Empty sources (and their layers) for polygon drawing, vertex editing and route editing,
 * filled in later by the drawing/edit hooks. Order is z-order.
 */
export function interactionSources(): [sourceId: string, layers: SourcelessLayer[]][] {
  return [
    [
      "editor-draw-polygon",
      [
        fill("editor-draw-polygon-fill", { "fill-color": "#10b981", "fill-opacity": 0.2 }),
        line("editor-draw-polygon-stroke", { "line-color": "#10b981", "line-width": 2 }),
      ],
    ],
    [
      "editor-draw-vertices",
      [
        circle("editor-draw-vertices-layer", {
          "circle-radius": 5,
          "circle-color": "#10b981",
          "circle-stroke-color": WHITE,
          "circle-stroke-width": 2,
        }),
      ],
    ],
    [
      "editor-overlap-highlight",
      [
        fill("editor-overlap-highlight-fill", { "fill-color": "#ef4444", "fill-opacity": 0.4 }),
        line("editor-overlap-highlight-stroke", { "line-color": "#ef4444", "line-width": 2.5 }),
      ],
    ],
    [
      "editor-vedit-polygon",
      [
        fill("editor-vedit-polygon-fill", { "fill-color": "#10b981", "fill-opacity": 0.15 }),
        line("editor-vedit-polygon-stroke", { "line-color": "#10b981", "line-width": 2.5 }),
      ],
    ],
    ["editor-vedit-midpoints", [midpointCircle("editor-vedit-midpoints-layer", "#10b981")]],
    ["editor-vedit-vertices", [vertexCircle("editor-vedit-vertices-layer", "#10b981")]],
    [
      "editor-route-edit-line",
      [
        line("editor-route-edit-line-layer", {
          "line-color": "#6366f1",
          "line-width": 3,
          "line-opacity": 0.8,
        }),
      ],
    ],
    ["editor-route-edit-vertices", [vertexCircle("editor-route-edit-vertices-layer", "#6366f1")]],
    [
      "editor-route-edit-midpoints",
      [midpointCircle("editor-route-edit-midpoints-layer", "#6366f1")],
    ],
    [
      "editor-route-snap-preview",
      [
        circle("editor-route-snap-preview-ring", {
          "circle-radius": 12,
          "circle-color": "transparent",
          "circle-stroke-color": "#06b6d4",
          "circle-stroke-width": 2,
          "circle-opacity": 0.8,
        }),
        symbol(
          "editor-route-snap-preview-label",
          {
            "text-field": ["concat", "Snap to: ", ["get", "name"]],
            "text-size": 10,
            "text-offset": [0, -1.8],
            "text-anchor": "bottom",
            "text-font": regularFont(),
          },
          labelPaint("#06b6d4")
        ),
      ],
    ],
    [
      "editor-route-preview-segment",
      [
        line("editor-route-preview-segment-layer", {
          "line-color": "#6366f1",
          "line-width": 2,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        }),
      ],
    ],
  ];
}
