import { layerConfigArt, realmLayerConfigSchema } from "~/lib/maps/import/realm-layer-config";
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
});
