/**
 * The Studio rail's table: every generator parameter sits in exactly one group, each numeric range is the bound of
 * the zod schema the bundle and the presets are checked with, and the small helpers the rail leans on.
 */
import { worldGenParamsSchema } from "~/lib/maps/import/world-bundle";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { PARAM_RANGES, STUDIO_GROUPS } from "~/lib/worldgen/studio-fields";

const { seed: _seed, ...DEFAULTS } = DEFAULT_PARAMS;
const accepts = (patch: object) =>
  worldGenParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...patch }).success;

describe("rail groups", () => {
  it("holds every parameter but the seed exactly once, in the stage that reads it", () => {
    const listed = STUDIO_GROUPS.flatMap((group) => group.fields);
    expect([...listed].sort()).toEqual(Object.keys(DEFAULTS).sort());
    expect(new Set(listed).size).toBe(listed.length);
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
});
