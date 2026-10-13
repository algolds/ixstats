import { paramsForPreset } from "~/lib/worldgen/studio-fields";
import { presetParamsOf } from "~/lib/worldgen/studio-preset-params";
import { worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";

describe("worldgen/studio-preset-params", () => {
  it("keeps every parameter and leaves out a seed that got in", () => {
    const params = { ...paramsForPreset({ oceanPercentage: 0.7 }), seed: 123 };
    const preset = presetParamsOf(params);
    expect("seed" in preset).toBe(false);
    expect(preset.oceanPercentage).toBe(0.7);
    expect(Object.keys(preset).sort()).toEqual(
      Object.keys(paramsForPreset({}))
        .filter((key) => key !== "seed")
        .sort()
    );
  });

  it("is accepted by the server's preset schema, which rejects a seed", () => {
    const params = paramsForPreset({});
    expect(worldPresetParamsSchema.safeParse(presetParamsOf(params)).success).toBe(true);
    expect(worldPresetParamsSchema.safeParse({ ...params, seed: 1 }).success).toBe(false);
  });

  it("copies, so a later edit of the rail does not change what was saved", () => {
    const params = paramsForPreset({});
    const preset = presetParamsOf(params);
    params.hypsometry[0] = 99;
    expect(preset.hypsometry?.[0]).not.toBe(99);
  });
});
