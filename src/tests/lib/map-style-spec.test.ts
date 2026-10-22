/** @jest-environment node */
/**
 * The map's styles as MapLibre reads them, checked with MapLibre's own style validator: every theme's style is valid
 * with its font placeholders resolved and its clustered sources undone before the viewer's max zoom (else the last
 * markers stay stuck in a cluster), and the `match` expressions the map builds from data stay valid when the data has
 * no pairs or repeats a label (MapLibre rejects a case-less match and duplicate labels, and drops the layer).
 * Folds: src/tests/lib/maps/match-expression.test.ts, src/tests/lib/maps/style-clusters.test.ts
 */
import {
  validateStyleMin,
  type ExpressionSpecification,
  type GeoJSONSourceSpecification,
  type SourceSpecification,
  type StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { getStyleForTheme, type MapTheme } from "~/lib/map-styles/registry";
import { MAP_DEFAULTS } from "~/lib/maps/map-config";
import { matchExpression } from "~/lib/maps/match-expression";

const FONTS = {
  regular: ["DejaVu Sans Regular"],
  bold: ["DejaVu Sans Bold"],
  sans: ["DejaVu Sans"],
};
const GLYPHS = "https://example.com/glyphs/{fontstack}/{range}.pbf";

/** The validator's complaints about a style, as messages (none for a valid style). */
const problems = (style: StyleSpecification) => validateStyleMin(style).map((e) => e.message);

const clustered = (source: SourceSpecification): source is GeoJSONSourceSpecification =>
  source.type === "geojson" && source.cluster === true;

describe("every theme's style", () => {
  it.each<MapTheme>(["standard", "dark", "paper"])(
    "%s is valid MapLibre, its fonts resolved and its clusters undone before the viewer's max zoom",
    (theme) => {
      const style = getStyleForTheme(theme, GLYPHS, FONTS) as unknown as StyleSpecification;
      expect(problems(style)).toEqual([]);
      expect(style.glyphs).toBe(GLYPHS);
      expect(JSON.stringify(style.layers)).not.toMatch(/__FONT_/);
      const clusters = Object.values(style.sources).filter(clustered);
      expect(clusters.length).toBeGreaterThan(0);
      for (const source of clusters)
        expect(source.clusterMaxZoom).toBeLessThan(MAP_DEFAULTS.maxZoom);
    }
  );
});

describe("a match expression built from data", () => {
  /** A style whose one layer is coloured by `colour`. */
  const styleColouredBy = (colour: ExpressionSpecification): StyleSpecification => ({
    version: 8,
    sources: { s: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
    layers: [{ id: "l", type: "fill", source: "s", paint: { "fill-color": colour } }],
  });
  const KEY: ExpressionSpecification = ["get", "k"];

  it.each<[string, [string, string][], ExpressionSpecification, ExpressionSpecification]>([
    [
      "no pairs, as a plain literal",
      [],
      ["literal", "#e8e5da"],
      ["match", KEY, "#e8e5da"] as unknown as ExpressionSpecification,
    ],
    [
      "a repeated label, keeping its first output",
      [
        ["a", "#111111"],
        ["a", "#222222"],
        ["b", "#333333"],
      ],
      ["match", KEY, "a", "#111111", "b", "#333333", "#e8e5da"],
      ["match", KEY, "a", "#111111", "a", "#222222", "b", "#333333", "#e8e5da"],
    ],
  ])("is valid MapLibre for %s", (_name, pairs, expected, naive) => {
    const expression = matchExpression(KEY, pairs, "#e8e5da");
    expect(expression).toEqual(expected);
    expect(problems(styleColouredBy(expression))).toEqual([]);
    // the expression written naively is one MapLibre refuses
    expect(problems(styleColouredBy(naive))).not.toEqual([]);
  });
});
