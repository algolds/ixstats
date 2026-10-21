/**
 * The World tab's controls and what they ask of the generator: every slider, switch and segment lands on the
 * `WorldGenParams` it names, a preset's controls reproduce that preset, and the bounds are ones the world bundle
 * accepts.
 */

import {
  CONTROL_LIMITS,
  clampControls,
  controlAvailability,
  controlsForPreset,
  newWorldSeed,
  paramsFromControls,
  type WorldControls,
} from "~/lib/worldgen/world-controls";
import type { WorldPresetOption } from "~/lib/worldgen/world-presets";
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { FACTORY_PRESETS } from "~/lib/worldgen/world-presets";
import { worldGenParamsSchema } from "~/lib/maps/import/world-bundle";

const earthlike = (): WorldControls => controlsForPreset("earthlike");

describe("controlsForPreset", () => {
  it("keeps every preset value inside the slider limits", () => {
    for (const id of ["earthlike", "ixnay", "eurth"] as const) {
      const controls = controlsForPreset(id);
      expect(clampControls(controls)).toEqual(controls);
    }
  });
});

describe("paramsFromControls", () => {
  it.each(["earthlike", "ixnay", "eurth"] as const)(
    "reproduces the %s preset from its own controls",
    (id) => {
      const params = paramsFromControls(controlsForPreset(id));
      const preset: Record<string, unknown> = { ...WORLD_PRESETS[id] };
      for (const [key, value] of Object.entries(preset)) {
        expect({ key, value: (params as Record<string, unknown>)[key] }).toEqual({ key, value });
      }
    }
  );
  describe("with the published presets", () => {
    const tuned: WorldPresetOption = {
      slug: "badlands",
      name: "Badlands",
      params: {
        continentCount: 4,
        temperatureOffset: 6,
        terrainRoughness: 0.9,
        hasIcecaps: false,
        plateCount: 14,
        hypsometry: [10, 10, 10, 10, 10, 10, 10, 10, 20],
      },
    };
    const presets = [...FACTORY_PRESETS, tuned];
    it("keeps the controls above the preset: a moved slider wins over the preset's value", () => {
      const params = paramsFromControls(
        { ...controlsForPreset("badlands", presets), continents: 7, temperature: -2 },
        presets
      );
      expect(params).toMatchObject({
        continentCount: 7,
        temperatureOffset: -2,
        terrainRoughness: 0.9,
      });
    });
    it("leaves the preset's other values out of a world fitted to the realm's own map", () => {
      const params = paramsFromControls(
        { ...controlsForPreset("badlands", presets), source: "realm-map" },
        presets
      );
      expect(params).not.toHaveProperty("terrainRoughness");
      expect(params).not.toHaveProperty("plateCount");
    });
  });

  it("copies the elevation profile, so a later edit cannot change the shared preset", () => {
    const params = paramsFromControls(controlsForPreset("ixnay"));
    expect(params.hypsometry).not.toBe(WORLD_PRESETS.ixnay.hypsometry);
  });

  it("stays inside the bounds a world bundle accepts, at both ends of every slider", () => {
    const { continents, landShare, nations, temperature, rainfall } = CONTROL_LIMITS;
    const { sizeSpread, islands, rivers, lakes, coastComplexity, latitude } = CONTROL_LIMITS;
    for (const end of ["min", "max"] as const) {
      const params = paramsFromControls({
        ...earthlike(),
        continents: continents[end],
        landShare: landShare[end],
        nations: nations[end],
        temperature: temperature[end],
        rainfall: rainfall[end],
        sizeSpread: sizeSpread[end],
        islands: islands[end],
        rivers: rivers[end],
        lakes: lakes[end],
        coastComplexity: coastComplexity[end],
        latitudeBand: [latitude[end], latitude[end]],
      });
      const whole = { ...DEFAULT_PARAMS, ...params, seed: 1 };
      expect(worldGenParamsSchema.safeParse(whole).success).toBe(true);
    }
  });
});

describe("clampControls", () => {
  it("replaces a number that is not finite with the Earth-like value", () => {
    const clamped = clampControls({ ...earthlike(), temperature: Number.NaN, nations: Infinity });
    expect(clamped.temperature).toBe(0);
    expect(clamped.nations).toBe(130);
  });
});

describe("controlAvailability", () => {
  it("turns off what the realm's own map already decides", () => {
    const available = controlAvailability("realm-map");
    expect(available).toMatchObject({
      continents: false,
      landShare: false,
      nations: false,
      latitudeBand: false,
      sizeSpread: false,
      islands: false,
      polar: false,
      coastComplexity: false,
    });
    expect(available).toMatchObject({
      temperature: true,
      rainfall: true,
      developmentLevel: true,
      hypsometry: true,
      rivers: true,
      lakes: true,
    });
  });
});

describe("newWorldSeed", () => {
  it("is a positive whole number below 2^31 for any draw", () => {
    expect(newWorldSeed(() => 0)).toBe(1);
    expect(newWorldSeed(() => 0.999999999)).toBeLessThan(2 ** 31);
    expect(Number.isInteger(newWorldSeed(() => 0.123456789))).toBe(true);
  });
});
