/**
 * The Studio rail's table: every generator parameter sits in exactly one group, each numeric range is the bound of
 * the zod schema the bundle and the presets are checked with, and the small helpers the rail leans on.
 */
import { worldGenParamsSchema } from "~/lib/maps/import/world-bundle";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import {
  PARAM_RANGES,
  STUDIO_FIELDS,
  STUDIO_GROUPS,
  cloneParams,
  hypsometrySum,
  isNoChange,
  paramsForPreset,
  patchOf,
  pickParams,
  sameValue,
  type StudioKey,
} from "~/lib/worldgen/studio-fields";

const { seed: _seed, ...DEFAULTS } = DEFAULT_PARAMS;
const accepts = (patch: object) =>
  worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...patch }).success;

describe("rail groups", () => {
  it("holds every parameter but the seed exactly once, in the stage that reads it", () => {
    const listed = STUDIO_GROUPS.flatMap((group) => group.fields);
    expect([...listed].sort()).toEqual(Object.keys(DEFAULTS).sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("is the spec's table", () => {
    const fields = (id: string) => STUDIO_GROUPS.find((group) => group.id === id)!.fields;
    expect(STUDIO_GROUPS.map((group) => group.label)).toEqual([
      "Mesh",
      "Land",
      "Climate",
      "Nations",
      "Output",
    ]);
    expect(fields("mesh")).toEqual(["cellCount", "lloydIterations"]);
    expect(fields("land")).toHaveLength(10);
    expect(fields("climate")).toContain("hasLakes");
    expect(fields("nations")).toEqual(["countryCountRange", "useMarkovNaming", "developmentLevel"]);
    expect(fields("output")).toEqual(["hasIcecaps"]);
  });

  it("has a control spec for every parameter, keyed by its own name", () => {
    for (const key of Object.keys(DEFAULTS) as StudioKey[]) {
      expect(STUDIO_FIELDS[key].key).toBe(key);
    }
  });
});

describe("ranges", () => {
  const scalar = Object.keys(PARAM_RANGES).filter(
    (key) => key !== "continentLatitudeRange" && key !== "countryCountRange"
  ) as Array<keyof typeof PARAM_RANGES>;

  it.each(scalar)("%s: its ends are accepted and a step past either is not", (key) => {
    const { min, max, step } = PARAM_RANGES[key];
    expect(accepts({ [key]: min })).toBe(true);
    expect(accepts({ [key]: max })).toBe(true);
    expect(accepts({ [key]: min - step })).toBe(false);
    expect(accepts({ [key]: max + step })).toBe(false);
  });

  it.each(["continentLatitudeRange", "countryCountRange"] as const)(
    "%s: both ends are bounded by the range",
    (key) => {
      const { min, max, step } = PARAM_RANGES[key];
      expect(accepts({ [key]: [min, max] })).toBe(true);
      expect(accepts({ [key]: [min - step, max] })).toBe(false);
      expect(accepts({ [key]: [min, max + step] })).toBe(false);
    }
  );

  it("starts every default inside its range", () => {
    for (const key of Object.keys(PARAM_RANGES) as Array<keyof typeof PARAM_RANGES>) {
      const { min, max } = PARAM_RANGES[key];
      const value = DEFAULTS[key];
      for (const part of Array.isArray(value) ? value : [value]) {
        expect(part).toBeGreaterThanOrEqual(min);
        expect(part).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe("helpers", () => {
  it("makes a preset's parameters over the defaults, sharing nothing with them", () => {
    const params = paramsForPreset({
      oceanPercentage: 0.5,
      polarLand: { north: true, south: true },
    });
    expect(params.oceanPercentage).toBe(0.5);
    expect(params.cellCount).toBe(DEFAULTS.cellCount);
    expect(params).not.toHaveProperty("seed");
    params.hypsometry[0] = 99;
    expect(DEFAULTS.hypsometry[0]).not.toBe(99);
  });

  it("compares arrays and the polar pair by content", () => {
    expect(sameValue([1, 2], [1, 2])).toBe(true);
    expect(sameValue({ north: true, south: false }, { north: true, south: false })).toBe(true);
    expect(sameValue(0.5, 0.6)).toBe(false);
  });

  it("knows a patch that changes nothing", () => {
    expect(isNoChange(DEFAULTS, { cellCount: DEFAULTS.cellCount })).toBe(true);
    expect(isNoChange(DEFAULTS, { hypsometry: [...DEFAULTS.hypsometry] })).toBe(true);
    expect(isNoChange(DEFAULTS, { cellCount: 5000 })).toBe(false);
  });

  it("picks copies of the named parameters", () => {
    const patch = pickParams(DEFAULTS, ["plateCount", "hypsometry"]);
    expect(Object.keys(patch).sort()).toEqual(["hypsometry", "plateCount"]);
    expect(patch.hypsometry).toEqual(DEFAULTS.hypsometry);
    expect(patch.hypsometry).not.toBe(DEFAULTS.hypsometry);
    expect(patchOf("plateCount", 4)).toEqual({ plateCount: 4 });
    expect(cloneParams(DEFAULTS).polarLand).not.toBe(DEFAULTS.polarLand);
  });

  it("adds up the hypsometry", () => {
    expect(hypsometrySum(DEFAULTS.hypsometry)).toBeCloseTo(100, 6);
    expect(hypsometrySum([])).toBe(0);
  });

  it("reads the values the way the rail shows them", () => {
    const format = (key: StudioKey, value: number) => {
      const spec = STUDIO_FIELDS[key];
      return spec.kind === "slider" || spec.kind === "range" ? spec.format(value) : "";
    };
    expect(format("cellCount", 100000)).toBe("100,000");
    expect(format("oceanPercentage", 0.771)).toBe("77%");
    expect(format("temperatureOffset", 3)).toBe("+3.0 °C");
    expect(format("temperatureOffset", -2.5)).toBe("-2.5 °C");
    expect(format("continentLatitudeRange", -40)).toBe("40°S");
    expect(format("riverDensity", 0)).toBe("None");
    expect(format("lakeCoverage", 0.011)).toBe("1.1%");
  });
});
