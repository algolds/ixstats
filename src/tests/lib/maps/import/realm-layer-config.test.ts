/** @jest-environment node */
import { altitudeStyles } from "~/lib/maps/import/png/elevation";
import { layerEngineOptionsSchema } from "~/lib/maps/import/png/layer-engine-options";
import { layerConfigArt, realmLayerConfigSchema } from "~/lib/maps/import/realm-layer-config";
import { sourcePreset } from "~/lib/realms/sources/presets";

describe("realm layer config", () => {
  it("needs only the land art; every other layer is optional", () => {
    expect(realmLayerConfigSchema.parse({ land: "blank" })).toEqual({ land: "blank" });
    expect(() => realmLayerConfigSchema.parse({})).toThrow();
  });

  it("names art by key, never by file path", () => {
    expect(() => realmLayerConfigSchema.parse({ land: "Maps/blank.png" })).toThrow(/Art names/);
  });

  it("refuses a colour that is not #rrggbb and lower-cases the rest", () => {
    const base = { land: "blank", rivers: { art: "geo", colours: ["#5184C8"] } };
    expect(realmLayerConfigSchema.parse(base).rivers!.colours).toEqual(["#5184c8"]);
    expect(() =>
      realmLayerConfigSchema.parse({ ...base, rivers: { art: "geo", colours: ["blue"] } })
    ).toThrow(/rrggbb/);
  });

  it("takes a climate key typed in or read from a data file of the art", () => {
    const inline = realmLayerConfigSchema.parse({
      land: "blank",
      climate: {
        art: "climate",
        key: { system: "Köppen", zones: [{ code: "Af", name: "Rainforest", color: "#0037ff" }] },
      },
    });
    expect(inline.climate!.key).toEqual({
      system: "Köppen",
      zones: [{ code: "Af", name: "Rainforest", color: "#0037ff" }],
    });
    expect(layerConfigArt(inline)).toEqual(["blank", "climate"]);
    const file = realmLayerConfigSchema.parse({
      land: "blank",
      climate: { art: "climate", key: { art: "key", system: "Köppen", zonesBinding: "ZONES" } },
    });
    expect(layerConfigArt(file)).toEqual(["blank", "climate", "key"]);
  });

  it("reads the Eurth preset's physical config: every layer, its legend on IxWorld's bands, engine overrides", () => {
    const config = sourcePreset("eurth-map")!.mapPipeline!.physical!;
    expect(config.climate && "zonesBinding" in config.climate.key).toBe(true);
    expect(config.ice?.art).toBe(config.elevation?.art);
    expect(altitudeStyles(config.elevation!.bands).map((s) => s.subgroup)).toEqual([
      "coastlines",
      "Altitude-1",
      "Altitude-3",
      "Altitude-5",
      "Altitude-7",
      "Altitude-8",
    ]);
    expect(layerEngineOptionsSchema.parse(config.engine).elevationTolerance).toBeLessThan(2);
  });
});
