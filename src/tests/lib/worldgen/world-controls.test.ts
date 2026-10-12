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
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { worldGenParamsSchema } from "~/lib/maps/import/world-bundle";

const earthlike = (): WorldControls => controlsForPreset("earthlike");

describe("controlsForPreset", () => {
  it("starts from the generator's defaults for Earth-like", () => {
    expect(earthlike()).toMatchObject({
      source: "preset",
      preset: "earthlike",
      continents: DEFAULT_PARAMS.continentCount,
      nations: 130,
      temperature: 0,
      rainfall: 1,
      developmentLevel: "industrial",
      latitudeBand: [-50, 60],
      polarNorth: false,
      polarSouth: true,
      hypsometry: "earthlike",
    });
    expect(earthlike().landShare).toBeCloseTo(0.3, 10);
  });

  it.each(["ixnay", "eurth"] as const)("reads the %s preset's values", (id) => {
    const preset = WORLD_PRESETS[id];
    const controls = controlsForPreset(id);
    expect(controls.preset).toBe(id);
    expect(controls.hypsometry).toBe(id);
    expect(controls.continents).toBe(preset.continentCount);
    expect(controls.landShare).toBeCloseTo(1 - preset.oceanPercentage, 10);
    expect(controls.temperature).toBe(preset.temperatureOffset);
    expect(controls.rainfall).toBe(preset.precipitationScale);
    expect(controls.rivers).toBe(preset.riverDensity);
    expect(controls.lakes).toBe(preset.lakeCoverage);
    expect(controls.latitudeBand).toEqual(preset.continentLatitudeRange);
    expect(controls.polarSouth).toBe(preset.polarLand.south);
  });

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

  it("maps the basic sliders to the parameters they name", () => {
    const params = paramsFromControls({
      ...earthlike(),
      continents: 9,
      landShare: 0.4,
      nations: 80,
      temperature: -4.5,
      rainfall: 1.75,
      developmentLevel: "modern",
    });
    expect(params).toMatchObject({
      continentCount: 9,
      oceanPercentage: 0.6,
      countryCountRange: [80, 80],
      temperatureOffset: -4.5,
      precipitationScale: 1.75,
      developmentLevel: "modern",
    });
  });

  it("maps the advanced controls to the parameters they name", () => {
    const params = paramsFromControls({
      ...earthlike(),
      latitudeBand: [30, -20],
      sizeSpread: 1.2,
      islands: 0.15,
      polarNorth: true,
      polarSouth: false,
      hypsometry: "eurth",
      rivers: 2,
      lakes: 0.03,
      coastComplexity: 0.9,
    });
    expect(params).toMatchObject({
      // A band dragged past itself still reads south to north
      continentLatitudeRange: [-20, 30],
      continentSizeVariance: 1.2,
      islandShare: 0.15,
      polarLand: { north: true, south: false },
      hypsometry: WORLD_PRESETS.eurth.hypsometry,
      riverDensity: 2,
      hasRivers: true,
      lakeCoverage: 0.03,
      hasLakes: true,
      coastlineComplexity: 0.9,
    });
  });

  it("switches rivers and lakes off at zero", () => {
    const params = paramsFromControls({ ...earthlike(), rivers: 0, lakes: 0 });
    expect(params).toMatchObject({
      riverDensity: 0,
      hasRivers: false,
      lakeCoverage: 0,
      hasLakes: false,
    });
  });

  it("rounds the ocean share, so 0.771 stays 0.771", () => {
    expect(paramsFromControls({ ...earthlike(), landShare: 0.229 }).oceanPercentage).toBe(0.771);
  });

  it("does not touch the parameters no control names", () => {
    const params = paramsFromControls(earthlike());
    for (const key of ["cellCount", "plateCount", "terrainRoughness", "hasIcecaps", "seed"]) {
      expect(params).not.toHaveProperty(key);
    }
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
  it("pulls numbers back inside their limits and rounds whole-number controls", () => {
    const clamped = clampControls({
      ...earthlike(),
      continents: 40.4,
      landShare: 0.9,
      nations: 2,
      temperature: -99,
      rainfall: 9,
      sizeSpread: -1,
      islands: 5,
      rivers: 99,
      lakes: -1,
      coastComplexity: 3,
      latitudeBand: [-200, 200],
    });
    expect(clamped).toMatchObject({
      continents: 12,
      landShare: CONTROL_LIMITS.landShare.max,
      nations: CONTROL_LIMITS.nations.min,
      temperature: CONTROL_LIMITS.temperature.min,
      rainfall: CONTROL_LIMITS.rainfall.max,
      sizeSpread: 0,
      islands: CONTROL_LIMITS.islands.max,
      rivers: CONTROL_LIMITS.rivers.max,
      lakes: 0,
      coastComplexity: 1,
      latitudeBand: [-80, 80],
    });
  });

  it("replaces a number that is not finite with the Earth-like value", () => {
    const clamped = clampControls({ ...earthlike(), temperature: Number.NaN, nations: Infinity });
    expect(clamped.temperature).toBe(0);
    expect(clamped.nations).toBe(130);
  });
});

describe("controlAvailability", () => {
  it("offers every control when the world is built from a preset", () => {
    const off = Object.values(controlAvailability("preset")).filter((on) => !on);
    expect(off).toEqual([]);
  });

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

  it("changes with the draw", () => {
    expect(newWorldSeed(() => 0.2)).not.toBe(newWorldSeed(() => 0.7));
  });
});
