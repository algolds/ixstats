/**
 * Engine fuzz (stress test B): random nations, from a 1,000-person micro-state to a billion-person giant, a zero to a
 * crushing defense budget, every preset, manpower model, doctrine and alert level, advanced up to 20 years. Every
 * figure stays finite and in range: no NaN, no negative headcount or capital, readiness and sub-scores in [0, 1].
 */
import {
  ALERT_LEVELS,
  DOCTRINES,
  MONTH_MS,
  SERVICE_MONTHS_MAX,
  SERVICE_MONTHS_MIN,
  SHARE_PRESETS,
  advanceNation,
  deriveNation,
  starterNation,
  type EconomyInputs,
  type NationState,
  type NationView,
} from "~/lib/military/model";
import { T0 } from "./fixtures";

/** Mulberry32: a seeded generator, so a failure reproduces. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, items: readonly T[]) => items[Math.floor(r() * items.length)]!;
const logUniform = (r: () => number, lo: number, hi: number) =>
  Math.exp(Math.log(lo) + r() * (Math.log(hi) - Math.log(lo)));

function randomEconomy(r: () => number): EconomyInputs {
  const population = logUniform(r, 1e3, 1.5e9);
  const gdpPerCapita = logUniform(r, 400, 160_000);
  const gdp = population * gdpPerCapita;
  const burden = pick(r, [0, 0.0001, 0.01, 0.02, 0.05, 0.2, 0.6]);
  return {
    population,
    gdpPerCapita,
    gdp,
    defenseBudget: gdp * burden,
    realmMedianGdpPerCapita: logUniform(r, 2_000, 60_000),
    frontierYear: 1990 + r() * 60,
  };
}

function randomNation(r: () => number, econ: EconomyInputs): NationState {
  const state = starterNation({ econ, clockMs: T0, policy: {} });
  const presets = Object.values(SHARE_PRESETS);
  return {
    ...state,
    policy: {
      ...state.policy,
      shares: pick(r, presets),
      volunteerShare: pick(r, [0, 0.3, 1]),
      serviceMonths: pick(r, [SERVICE_MONTHS_MIN, 12, SERVICE_MONTHS_MAX]),
      reserveYears: pick(r, [0, 5, 30]),
      doctrine: pick(r, DOCTRINES),
      alertLevel: pick(r, ALERT_LEVELS),
    },
  };
}

function badFigures(view: NationView, state: NationState): string[] {
  const bad: string[] = [];
  const check = (label: string, value: number, lo = 0, hi = Infinity) => {
    if (!Number.isFinite(value) || value < lo - 1e-9 || value > hi + 1e-9) bad.push(`${label}=${value}`);
  };
  check("combatPower", view.combatPower);
  check("readiness", view.readiness, 0, 1);
  check("burden", view.burden);
  view.branches.forEach((b, i) => {
    check(`b${i}.active`, b.active);
    check(`b${i}.reserves`, b.reserves);
    check(`b${i}.mobilised`, b.mobilised);
    check(`b${i}.capital`, b.capital);
    check(`b${i}.readiness`, b.readiness, 0, 1);
    check(`b${i}.combatPower`, b.combatPower);
    for (const [k, v] of Object.entries(b.subScores)) check(`b${i}.${k}`, v, 0, 1);
  });
  state.branches.forEach((b, i) => {
    check(`s${i}.condition`, b.condition, 0, 1);
    check(`s${i}.training`, b.training, 0, 1);
  });
  check("rdStock", state.policy.rdStock);
  check("infrastructureStock", state.policy.infrastructureStock);
  return bad;
}

describe("defense model fuzz: every figure stays finite and in range", () => {
  const cases = Array.from({ length: 120 }, (_, seed) => seed + 1);
  it.each(cases)("nation seed %i over 1, 13, 60 and 240 months", (seed) => {
    const r = rng(seed);
    const econ = randomEconomy(r);
    let state = randomNation(r, econ);
    for (const months of [1, 12, 47, 180]) {
      state = advanceNation(state, econ, state.lastTickClockMs + months * MONTH_MS).state;
      const view = deriveNation(state, econ, [], state.lastTickClockMs);
      expect({ seed, months, bad: badFigures(view, state) }).toEqual({ seed, months, bad: [] });
    }
  });
});
