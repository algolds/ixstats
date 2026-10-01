/**
 * The Command profile's restored Sovereign Command OS pieces derive only from real readings:
 * a missing input drops the item instead of defaulting it (the retired sample concepts used
 * fixed scores like "85/100").
 */
import { describe, it, expect } from "@jest/globals";
import {
  conditionPillars,
  diplomaticMatrix,
  dnaSummary,
  pulseStatus,
  stateBranches,
  toDnaAxes,
} from "~/components/country-profile/derive";
import type {
  ProfileState,
  ProfileVitals,
  ProfileWorld,
} from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";

const vitals = (overrides: Partial<ProfileVitals> = {}): ProfileVitals => ({
  population: null,
  populationGrowth: null,
  gdpTotal: null,
  gdpPerCapita: null,
  gdpGrowth: null,
  economicTier: null,
  populationTier: null,
  landArea: null,
  density: null,
  unemployment: null,
  inflation: null,
  lifeExpectancy: null,
  literacy: null,
  urbanShare: null,
  gini: null,
  povertyRate: null,
  debtToGdp: null,
  taxRevenueShare: null,
  publicApproval: null,
  stabilityScore: null,
  history: [],
  ...overrides,
});

describe("pulseStatus", () => {
  it("needs a GDP growth reading", () => {
    expect(pulseStatus(vitals({ stabilityScore: 90 }))).toBeNull();
  });

  it("reads fractions and percents alike and names the readings", () => {
    const fast = pulseStatus(vitals({ gdpGrowth: 0.045, populationGrowth: 0.01 }));
    expect(fast).toMatchObject({ label: "Rapid expansion", tone: "success" });
    expect(fast?.summary).toBe("Real GDP growth of +4.5% and population growth of +1.0%.");
    expect(pulseStatus(vitals({ gdpGrowth: 4.5 }))?.label).toBe("Rapid expansion");
  });

  it("calls a growing, stable nation prosperous only with a stability reading", () => {
    expect(pulseStatus(vitals({ gdpGrowth: 0.02, stabilityScore: 80 }))?.label).toBe(
      "Stable and prosperous"
    );
    expect(pulseStatus(vitals({ gdpGrowth: 0.02 }))?.label).toBe("Consolidating");
    expect(pulseStatus(vitals({ gdpGrowth: -0.01 }))).toMatchObject({
      label: "Economic headwinds",
      tone: "warning",
    });
  });
});

describe("country DNA", () => {
  const rankings: ProfileWorld["rankings"] = [
    { category: "GDP per Capita", rank: 1, total: 40, value: "$80K", percentile: 100 },
    { category: "Population", rank: 40, total: 40, value: "2M", percentile: null },
    { category: "Stability", rank: 21, total: 40, value: "70", percentile: null },
    { category: "Debt to GDP", rank: 1, total: 1, value: "10%", percentile: 100 },
  ];

  it("uses the census percentile, derives it from the rank otherwise, and drops lone ranks", () => {
    const axes = toDnaAxes(rankings);
    expect(axes.map((a) => [a.key, a.percentile])).toEqual([
      ["GDP per Capita", 100],
      ["Population", 3],
      ["Stability", 50],
    ]);
  });

  it("summarises the strongest and weakest category", () => {
    expect(dnaSummary(toDnaAxes(rankings))).toBe(
      "Strongest in gdp per capita, weakest in population."
    );
    expect(dnaSummary(toDnaAxes(rankings.slice(0, 1)))).toBeNull();
  });
});

describe("conditionPillars", () => {
  it("lists only the 0–100 readings the nation has", () => {
    expect(conditionPillars(vitals())).toEqual([]);
    const pillars = conditionPillars(vitals({ unemployment: 6, publicApproval: 58.4 }));
    expect(pillars.map((p) => [p.key, p.value, p.display])).toEqual([
      ["employment", 94, "94.0%"],
      ["approval", 58.4, "58%"],
    ]);
    expect(pillars[0]?.detail).toBe("Unemployment 6.0%");
  });
});

describe("stateBranches", () => {
  const state = (government: ProfileState["government"], totalSeats = 0) => ({
    government,
    election: totalSeats
      ? {
          lastName: null,
          lastIxTime: null,
          turnout: null,
          results: [],
          upcomingName: null,
          upcomingIxTime: null,
          totalSeats,
        }
      : null,
  });

  it("builds branches from the government record, leaving empty ones out", () => {
    const branches = stateBranches(
      state(
        {
          name: "Government of Testland",
          type: "Republic",
          headOfState: "President Ana Vel",
          headOfGovernment: null,
          legislature: "National Assembly",
          executive: null,
          judiciary: null,
          departments: [],
        },
        300
      ),
      { leaders: [{ title: "King", name: "Ignored" }] }
    );
    expect(branches.map((b) => b.key)).toEqual(["executive", "legislative"]);
    expect(branches[0]?.rows).toEqual([{ role: "Head of state", name: "President Ana Vel" }]);
    expect(branches[1]?.rows).toContainEqual({ role: "Seats", name: "300" });
  });

  it("falls back to the wiki infobox's leaders for the executive", () => {
    expect(stateBranches(state(null), { leaders: [{ title: "Doge", name: "Tomas" }] })).toEqual([
      { key: "executive", title: "Executive", rows: [{ role: "Doge", name: "Tomas" }] },
    ]);
    expect(stateBranches(state(null), { leaders: [] })).toEqual([]);
  });
});

describe("diplomaticMatrix", () => {
  const relation = (
    id: string,
    relationship: string,
    strength: number,
    treaties: string[] = []
  ) => ({
    id,
    countryId: id,
    name: id,
    flagUrl: null,
    relationship,
    strength,
    treaties,
  });

  it("splits partners from tensions, strongest first, and counts the record", () => {
    const m = diplomaticMatrix({
      relations: [
        relation("a", "friendly", 40, ["t1"]),
        relation("b", "ALLIED", 90, ["t2", "t3"]),
        relation("c", "hostile", 70),
        relation("d", "neutral", 50),
      ],
      embassies: [
        {
          id: "e1",
          countryName: "X",
          countrySlug: null,
          flagUrl: null,
          role: "host",
          status: "active",
          level: 1,
        },
      ],
    });
    expect(m.partners.map((r) => r.id)).toEqual(["b", "a"]);
    expect(m.tensions.map((r) => r.id)).toEqual(["c"]);
    expect(m).toMatchObject({
      relationCount: 4,
      treatyCount: 3,
      embassiesHosted: 1,
      embassiesAbroad: 0,
    });
  });
});
