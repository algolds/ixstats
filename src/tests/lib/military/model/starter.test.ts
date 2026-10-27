/** @jest-environment node */
/**
 * Starter forces: the equilibrium of a nation's budget, inside the research's peacetime sanity band (0.2–1.1% of
 * population active), stable under the monthly update and the same for NPCs (from their economy).
 */
import {
  MONTH_MS,
  advanceNation,
  deriveNation,
  formDefenseShare,
  npcDefenseShare,
  npcPolicy,
  starterNation,
} from "~/lib/military/model";
import { T0, economy, starter, totalActive } from "./fixtures";

const NATIONS = [
  { name: "large rich", population: 626.8e6, gdpPerCapita: 64_270 },
  { name: "median", population: 27e6, gdpPerCapita: 21_000 },
  { name: "small", population: 5e6, gdpPerCapita: 30_000 },
  { name: "poor", population: 40e6, gdpPerCapita: 2_500 },
  { name: "micro", population: 50_000, gdpPerCapita: 40_000 },
];

describe("starter force sanity band", () => {
  it.each(NATIONS)("$name: 0.2–1.1% of population active, at C-2 or better", (n) => {
    const econ = economy(n);
    const s = starter(econ);
    const share = totalActive(s) / n.population;
    expect(share).toBeGreaterThanOrEqual(0.002);
    expect(share).toBeLessThanOrEqual(0.011);
    const view = deriveNation(s, econ, [], T0);
    expect(["C-1", "C-2"]).toContain(view.cLevel);
  });

  it("stays in the band for conscript NPC forms", () => {
    const econ = economy();
    const s = starter(econ, npcPolicy("Military junta"));
    const share = totalActive(s) / econ.population;
    expect(share).toBeGreaterThanOrEqual(0.002);
    expect(share).toBeLessThanOrEqual(0.011);
  });
});

describe("starter equilibrium", () => {
  it("barely moves over a year of monthly updates (only real cost escalation erodes it)", () => {
    const econ = economy();
    const s = starter(econ);
    const later = advanceNation(s, econ, T0 + 12 * MONTH_MS);
    const a = deriveNation(s, econ, [], T0);
    const b = deriveNation(later.state, econ, [], T0 + 12 * MONTH_MS);
    expect(Math.abs(b.combatPower / a.combatPower - 1)).toBeLessThan(0.02);
    expect(Math.abs(b.readiness - a.readiness)).toBeLessThan(0.01);
    expect(Math.abs(totalActive(later.state) / totalActive(s) - 1)).toBeLessThan(0.01);
  });

  it("is deterministic and scales with the budget", () => {
    const econ = economy();
    expect(starterNation({ econ, clockMs: T0 })).toEqual(starterNation({ econ, clockMs: T0 }));
    const rich = deriveNation(starter(economy({ defenseBudget: econ.gdp * 0.04 })), econ, [], T0);
    expect(rich.combatPower).toBeGreaterThan(deriveNation(starter(econ), econ, [], T0).combatPower);
  });
});

describe("NPC defense share", () => {
  it("reads the government form's default Defense share", () => {
    expect(formDefenseShare("military-government")).toBeGreaterThan(formDefenseShare("technocracy"));
    expect(npcDefenseShare({ governmentType: "Military junta", region: null })).toBeCloseTo(
      formDefenseShare("military-government")
    );
    expect(npcDefenseShare({ governmentType: null, region: "Daria" })).toBeCloseTo(
      formDefenseShare("parliamentary-republic")
    );
  });
});
