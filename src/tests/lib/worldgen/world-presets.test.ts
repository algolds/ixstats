/** The factory presets in code, and the schema a preset's recipe must pass (no seed, bounded values). */
import { worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { FACTORY_PRESETS, resolvePreset } from "~/lib/worldgen/world-presets";

describe("factory presets", () => {
  it("are the presets in code, in order, each with a name and a description", () => {
    expect(FACTORY_PRESETS.map((p) => p.slug)).toEqual(Object.keys(WORLD_PRESETS));
    for (const preset of FACTORY_PRESETS) {
      expect(preset.name).not.toBe("");
      expect(preset.description).not.toBe("");
      expect(preset.params).toBe(WORLD_PRESETS[preset.slug as keyof typeof WORLD_PRESETS]);
    }
  });

  it("resolve by slug, else to Earth-like, else to the factory Earth-like", () => {
    expect(resolvePreset(FACTORY_PRESETS, "eurth").slug).toBe("eurth");
    expect(resolvePreset(FACTORY_PRESETS, "gone").slug).toBe("earthlike");
    expect(resolvePreset([], "eurth")).toMatchObject({ slug: "earthlike", name: "Earth-like" });
  });
});

describe("worldPresetParamsSchema", () => {
  it("accepts any of the parameters but the seed, each inside its bounds", () => {
    expect(worldPresetParamsSchema.safeParse({}).success).toBe(true);
    expect(
      worldPresetParamsSchema.safeParse({
        oceanPercentage: 0.5,
        polarLand: { north: true, south: false },
      }).success
    ).toBe(true);
    for (const params of FACTORY_PRESETS.map((p) => p.params)) {
      expect(worldPresetParamsSchema.safeParse(params).success).toBe(true);
    }
  });

  it("rejects a seed, a key it does not know and a value out of bounds", () => {
    expect(worldPresetParamsSchema.safeParse({ seed: 5 }).success).toBe(false);
    expect(worldPresetParamsSchema.safeParse({ nonsense: 1 }).success).toBe(false);
    expect(worldPresetParamsSchema.safeParse({ cellCount: 999_999 }).success).toBe(false);
    expect(worldPresetParamsSchema.safeParse({ hypsometry: [1, 2] }).success).toBe(false);
  });
});
