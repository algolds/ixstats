/** @jest-environment node */
import {
  ECONOMIC_TIERS,
  growthFromPercent,
  growthPercent,
  IXSTATS_NATION_GROWTH_DEFAULTS,
  nationGrowthFor,
  nationGrowthTableSchema,
  planNationDefaultsApply,
  readNationGrowthTable,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import { ECONOMIC_TIER_INFO } from "~/lib/tier-utils";

const custom: NationGrowthTable = {
  ...IXSTATS_NATION_GROWTH_DEFAULTS,
  Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
};

describe("IXSTATS_NATION_GROWTH_DEFAULTS", () => {
  it("covers every economic tier in order, and is a valid table", () => {
    expect(ECONOMIC_TIERS).toEqual([
      "Impoverished",
      "Developing",
      "Developed",
      "Healthy",
      "Strong",
      "Very Strong",
      "Extravagant",
    ]);
    expect(Object.keys(IXSTATS_NATION_GROWTH_DEFAULTS)).toEqual(ECONOMIC_TIERS);
    expect(nationGrowthTableSchema.parse(IXSTATS_NATION_GROWTH_DEFAULTS)).toEqual(
      IXSTATS_NATION_GROWTH_DEFAULTS
    );
  });

  it("gives poorer tiers faster population growth, as IxWorld's nations have", () => {
    const pop = ECONOMIC_TIERS.map((t) => IXSTATS_NATION_GROWTH_DEFAULTS[t].populationGrowthRate);
    expect(pop[0]).toBe(0.031);
    expect(pop[1]).toBe(0.026);
    expect(Math.max(...pop.slice(2))).toBeLessThan(0.01);
  });
});

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
  it("is the system defaults when nothing is stored", () => {
    expect(readNationGrowthTable(null)).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS);
    expect(readNationGrowthTable(undefined)).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS);
    expect(readNationGrowthTable("nonsense")).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS);
    expect(readNationGrowthTable([1, 2])).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS);
  });

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

describe("nationGrowthFor", () => {
  it("picks the tier of the GDP per capita, its table row, and the IxStats tier cap", () => {
    expect(nationGrowthFor(15_000, custom)).toEqual({
      tier: "Developing",
      populationGrowthRate: 0.02,
      adjustedGdpGrowth: 0.004,
      maxGdpGrowthRate: ECONOMIC_TIER_INFO.Developing.maxGrowth,
    });
    expect(nationGrowthFor(70_000, custom)).toMatchObject({
      tier: "Extravagant",
      maxGdpGrowthRate: 0.005,
    });
    expect(nationGrowthFor(5_000, custom).maxGdpGrowthRate).toBe(0.1);
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

describe("growthPercent / growthFromPercent", () => {
  it("shows a decimal rate as a percent without float noise, and reads it back", () => {
    expect(growthPercent(0.0024075)).toBe("0.24075");
    expect(growthPercent(0.031)).toBe("3.1");
    expect(growthPercent(0)).toBe("0");
    expect(growthFromPercent("0.24075")).toBe(0.0024075);
    expect(growthFromPercent(" 3.1 ")).toBe(0.031);
    expect(growthFromPercent("-1")).toBe(-0.01);
  });

  it("reads an empty or non-numeric percent as NaN, for the schema to refuse", () => {
    expect(growthFromPercent("")).toBeNaN();
    expect(growthFromPercent("abc")).toBeNaN();
  });
});
