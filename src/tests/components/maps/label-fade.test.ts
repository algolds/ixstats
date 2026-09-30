import { describe, it, expect } from "@jest/globals";
import type { FeatureCollection } from "geojson";
import { computeCountryLabelFade } from "~/components/maps/core/utils/label-fade";
import {
  sameFeatureList,
  setFilteredSourceData,
} from "~/components/maps/core/utils/map-core-helpers";

function labels(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { _displayName: "Centerland" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [40, 0] },
        properties: { _displayName: "Farland" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [10, 10] },
        properties: { _displayName: "Toplandia" },
      },
    ],
  };
}

describe("computeCountryLabelFade", () => {
  const view = { center: { lng: 0, lat: 0 }, zoom: 5, viewRadius: 20 };

  it("fades labels by distance from the view centre and keeps top countries opaque", () => {
    const out = computeCountryLabelFade(labels(), {
      ...view,
      topCountryNames: new Set(["Toplandia"]),
    });
    expect(out).not.toBeNull();
    const byName = Object.fromEntries(
      out!.features.map((f) => [f.properties?._displayName, f.properties?._distFade])
    );
    expect(byName.Centerland).toBe(1);
    expect(byName.Farland).toBe(0);
    expect(byName.Toplandia).toBe(1);
  });

  it("returns null when nothing changed, so the caller can skip setData", () => {
    const first = computeCountryLabelFade(labels(), view)!;
    expect(computeCountryLabelFade(first, view)).toBeNull();
  });

  it("hides every non-top label at globe zoom", () => {
    const out = computeCountryLabelFade(labels(), { ...view, zoom: 1.8 })!;
    expect(out.features.every((f) => f.properties?._distFade === 0)).toBe(true);
  });
});

describe("setFilteredSourceData", () => {
  it("only pushes to the source when the filtered list changes", () => {
    const fc = labels();
    const setData = jest.fn();
    const lastRef = { current: null as FeatureCollection["features"] | null };

    setFilteredSourceData({ setData }, fc.features.slice(0, 2), lastRef);
    setFilteredSourceData({ setData }, fc.features.slice(0, 2), lastRef);
    expect(setData).toHaveBeenCalledTimes(1);

    setFilteredSourceData({ setData }, fc.features.slice(0, 1), lastRef);
    expect(setData).toHaveBeenCalledTimes(2);
    expect(sameFeatureList(lastRef.current, fc.features.slice(0, 1))).toBe(true);
  });
});
