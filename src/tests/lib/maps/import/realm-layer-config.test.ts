/** @jest-environment node */
import { realmLayerConfigSchema } from "~/lib/maps/import/realm-layer-config";
describe("realm layer config", () => {
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
});
