import { realmLabelsEditorHref, wantsRealmLabelsEditor } from "~/lib/maps/realm-labels";
import type { FeatureCollection } from "geojson";
import { WATER_BODY_LABELS } from "~/lib/maps/map-config";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { getStyleForTheme } from "~/lib/map-styles/registry";
import { oceanLabelFeatures } from "~/lib/maps/ocean-labels";
import { realmLabelRank } from "~/lib/maps/realm-labels";

const point = (
  coordinates: [number, number],
  properties: Record<string, string | boolean | null>
) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates },
  properties,
});

const mapLabels: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    point([-33.3, 82.8], {
      text: "Argic Ocean",
      labelType: "ocean",
      rank: "major",
      realmLabel: true,
    }),
    point([6.75, 38.4], { text: "Auraid Bay", labelType: "sea", rank: "minor", realmLabel: true }),
    point([10, 10], {
      text: "Yetis Mts.",
      labelType: "mountain_range",
      rank: null,
      realmLabel: false,
    }),
  ],
};

describe("ocean labels", () => {
  it("IxWorld's built-in water names, unchanged", () => {
    const features = oceanLabelFeatures(true, undefined);
    expect(features).toHaveLength(WATER_BODY_LABELS.length);
    expect(features[0]).toMatchObject({
      id: 1,
      geometry: { type: "Point", coordinates: WATER_BODY_LABELS[0]!.coordinates },
      properties: {
        name: WATER_BODY_LABELS[0]!.name,
        wbType: WATER_BODY_LABELS[0]!.type,
        rank: WATER_BODY_LABELS[0]!.rank,
      },
    });
  });

  it("a realm's own labels in the same shape, a nation's labels left out", () => {
    const features = oceanLabelFeatures(false, mapLabels);
    expect(features.map((f) => f.properties)).toEqual([
      { name: "Argic Ocean", wbType: "ocean", rank: "major" },
      { name: "Auraid Bay", wbType: "sea", rank: "minor" },
    ]);
    expect(features.map((f) => f.id)).toEqual([1, 2]);
    expect(features[0]!.geometry.coordinates).toEqual([-33.3, 82.8]);
  });

  it("both lists on IxWorld, with unique ids", () => {
    const features = oceanLabelFeatures(true, mapLabels);
    expect(features).toHaveLength(WATER_BODY_LABELS.length + 2);
    expect(new Set(features.map((f) => f.id)).size).toBe(features.length);
  });

  it("nothing outside IxWorld without realm labels", () => {
    expect(oceanLabelFeatures(false, undefined)).toEqual([]);
  });

  it("a realm label without a stored rank takes its kind's", () => {
    const features = oceanLabelFeatures(false, {
      type: "FeatureCollection",
      features: [point([0, 0], { text: "Antargis", labelType: "continent", realmLabel: true })],
    });
    expect(features[0]!.properties.rank).toBe("major");
    expect(realmLabelRank("sea")).toBe("medium");
    expect(realmLabelRank("sea", "minor")).toBe("minor");
    expect(realmLabelRank("sea", "huge")).toBe("medium");
    expect(realmLabelRank("unknown")).toBe("medium");
  });
});

type Expr = string | number | Expr[];

interface StyleLayer {
  id: string;
  layout: Record<string, Expr>;
  paint: Record<string, Expr>;
}

describe("the theme styles' ocean-label layer", () => {
  const FONTS = { regular: ["Regular"], bold: ["Bold"], sans: ["Sans"] };
  const oceanLayer = (style: Record<string, object | string | number>) =>
    (style.layers as StyleLayer[]).find((l) => l.id === "ocean-labels")!;

  it.each(["standard", "dark", "paper"] as const)(
    "%s: valid, IxWorld's water look kept, land names in capitals and a colour of their own",
    (theme) => {
      const style = getStyleForTheme(theme, "https://example.com/{fontstack}/{range}.pbf", FONTS);
      expect(validateStyleMin(style as Parameters<typeof validateStyleMin>[0])).toEqual([]);
      const layer = oceanLayer(style as Record<string, object | string | number>);
      expect(layer.layout["text-transform"]).toEqual([
        "match",
        ["get", "wbType"],
        ["region", "continent"],
        "uppercase",
        "none",
      ]);
      const [op, input, land, landColor, water] = layer.paint["text-color"] as Expr[];
      expect([op, input, land]).toEqual(["match", ["get", "wbType"], ["region", "continent"]]);
      expect(landColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(water).toEqual([
        "match",
        ["get", "rank"],
        "major",
        expect.any(String),
        "medium",
        expect.any(String),
        expect.any(String),
      ]);
      expect(layer.paint["text-opacity"]).toEqual([
        "step",
        ["zoom"],
        ["match", ["get", "rank"], "major", 0.8, 0],
        1.5,
        ["match", ["get", "rank"], "major", 0.9, "medium", 0.7, 0],
        3,
        0.9,
      ]);
    }
  );

  it("standard: IxWorld's blues by rank, unchanged", () => {
    const style = getStyleForTheme("standard", "g", FONTS);
    const layer = oceanLayer(style as Record<string, object | string | number>);
    expect((layer.paint["text-color"] as Expr[])[4]).toEqual([
      "match",
      ["get", "rank"],
      "major",
      "#1a5276",
      "medium",
      "#2874a6",
      "#3498db",
    ]);
    expect((layer.paint["text-halo-color"] as Expr[])[4]).toBe("rgba(179, 205, 224, 0.6)");
  });
});

describe("the realm labels editor link", () => {
  it("opens /maps on the realm with the labels editor, and only that param value asks for it", () => {
    expect(realmLabelsEditorHref("eurth")).toBe("/maps?realm=eurth&editor=labels");
    expect(realmLabelsEditorHref("new world")).toBe("/maps?realm=new%20world&editor=labels");
    expect(wantsRealmLabelsEditor(new URLSearchParams("realm=eurth&editor=labels"))).toBe(true);
    expect(wantsRealmLabelsEditor(new URLSearchParams("realm=eurth&editor=other"))).toBe(false);
    expect(wantsRealmLabelsEditor(null)).toBe(false);
  });
});
