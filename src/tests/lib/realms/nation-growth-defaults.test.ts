/** @jest-environment node */
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  nationGrowthTableSchema,
  planNationDefaultsApply,
  readNationGrowthTable,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
const custom: NationGrowthTable = {
  ...IXSTATS_NATION_GROWTH_DEFAULTS,
  Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
};
describe("nationGrowthTableSchema", () => {
  it("refuses a missing tier and rates outside the allowed range", () => {
    const { Developing: _dropped, ...missing } = custom;
    expect(nationGrowthTableSchema.safeParse(missing).success).toBe(false);
    const tooFast = {
      ...custom,
      Strong: { populationGrowthRate: 0.2, adjustedGdpGrowth: 0.001 },
    };
    expect(nationGrowthTableSchema.safeParse(tooFast).success).toBe(false);
    const nan = { ...custom, Strong: { populationGrowthRate: 0.01, adjustedGdpGrowth: NaN } };
    expect(nationGrowthTableSchema.safeParse(nan).success).toBe(false);
  });
});

describe("readNationGrowthTable", () => {
  it("takes each valid stored tier, and the system default for a bad or missing one", () => {
    const table = readNationGrowthTable({
      Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
      Strong: { populationGrowthRate: "fast", adjustedGdpGrowth: 0.001 },
    });
    expect(table.Developing).toEqual({ populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 });
    expect(table.Strong).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS.Strong);
    expect(table.Impoverished).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS.Impoverished);
  });
});
describe("planNationDefaultsApply", () => {
  const nation = (id: string, gdp: number, pop: number, adj: number, max: number) => ({
    id,
    name: `Nation ${id}`,
    baselineGdpPerCapita: gdp,
    populationGrowthRate: pop,
    adjustedGdpGrowth: adj,
    maxGdpGrowthRate: max,
  });

  it("lists only the nations whose growth would change, with from and to", () => {
    const changes = planNationDefaultsApply(
      [nation("a", 15_000, 0.01, 0.03, 0.05), nation("b", 15_000, 0.02, 0.004, 0.075)],
      custom
    );
    expect(changes).toEqual([
      {
        id: "a",
        name: "Nation a",
        tier: "Developing",
        from: { populationGrowthRate: 0.01, adjustedGdpGrowth: 0.03, maxGdpGrowthRate: 0.05 },
        to: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004, maxGdpGrowthRate: 0.075 },
      },
    ]);
  });

  it("treats float noise as no change", () => {
    const same = nation("c", 15_000, 0.02 + 1e-12, 0.004, 0.075);
    expect(planNationDefaultsApply([same], custom)).toEqual([]);
  });
});
