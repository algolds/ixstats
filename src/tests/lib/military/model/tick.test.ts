/** @jest-environment node */
/**
 * The monthly update on the realm clock: closed forms agree with month-by-month over 60 months, whole months only,
 * idempotent, a paused realm does not move and a date jump catches up (realm time design §4.2).
 */
import { realmClockReader } from "~/lib/realms/realm-clock";
import {
  MONTH_MS,
  advanceNation,
  deriveNation,
  monthsDue,
  type NationState,
  type OrderState,
} from "~/lib/military/model";
import { T0, economy, starter, totalActive } from "./fixtures";

/** A state well away from equilibrium: undermanned, under-maintained, half-trained, with one order. */
function disturbed(): NationState {
  const s = starter();
  const order: OrderState = {
    id: "o1",
    branchId: s.branches[2]!.id,
    catalogKey: "F35",
    quantity: 12,
    unitCost: 80e6,
    unitRealValue: 80e6,
    source: "domestic",
    leadMonths: 36,
    orderedClockMs: T0,
    expectedClockMs: T0 + 36 * MONTH_MS,
    paidSoFar: 0,
    status: "ordered",
    designYear: 2024,
  };
  return {
    ...s,
    policy: { ...s.policy, shares: { personnel: 0.3, om: 0.38, procurement: 0.24, rd: 0.06, infrastructure: 0.02 } },
    branches: s.branches.map((b) => ({ ...b, active: b.active * 0.4, condition: 0.3, training: 0.5, capital: b.capital * 0.6 })),
    orders: [order],
  };
}

const relative = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);

describe("closed form vs month by month", () => {
  it("agrees within 1% on combat power and 0.01 on readiness over 60 months", () => {
    const econ = economy();
    const to = T0 + 60 * MONTH_MS + 1;
    const stepwise = advanceNation(disturbed(), econ, to, "stepwise");
    const closed = advanceNation(disturbed(), econ, to, "closed");
    expect(stepwise.months).toBe(60);
    expect(closed.months).toBe(60);
    const a = deriveNation(stepwise.state, econ, [], to);
    const b = deriveNation(closed.state, econ, [], to);
    expect(relative(b.combatPower, a.combatPower)).toBeLessThan(0.01);
    expect(Math.abs(b.readiness - a.readiness)).toBeLessThan(0.01);
    expect(relative(totalActive(closed.state), totalActive(stepwise.state))).toBeLessThan(0.01);
    stepwise.state.branches.forEach((branch, i) => {
      expect(relative(closed.state.branches[i]!.capital, branch.capital)).toBeLessThan(0.01);
      expect(relative(closed.state.branches[i]!.reserves, branch.reserves)).toBeLessThan(0.01);
    });
    // The F-35 order delivers in both paths at its lead time.
    expect(stepwise.deliveries).toHaveLength(1);
    expect(closed.deliveries).toHaveLength(1);
    expect(closed.deliveries[0]!.deliveredClockMs).toBe(stepwise.deliveries[0]!.deliveredClockMs);
  });

  it("uses the closed forms on its own past 24 months", () => {
    const econ = economy();
    const to = T0 + 30 * MONTH_MS;
    const auto = advanceNation(disturbed(), econ, to);
    const closed = advanceNation(disturbed(), econ, to, "closed");
    expect(auto.state).toEqual(closed.state);
  });
});

describe("lazy ticks", () => {
  it("applies whole months only; the remainder waits", () => {
    expect(monthsDue(T0, T0 + MONTH_MS * 2.9)).toBe(2);
    const result = advanceNation(starter(), economy(), T0 + MONTH_MS * 2.9);
    expect(result.state.lastTickClockMs).toBe(T0 + 2 * MONTH_MS);
  });

  it("is idempotent: advancing to the same time twice changes nothing", () => {
    const econ = economy();
    const once = advanceNation(disturbed(), econ, T0 + 7 * MONTH_MS);
    const twice = advanceNation(once.state, econ, T0 + 7 * MONTH_MS);
    expect(twice.months).toBe(0);
    expect(twice.state).toBe(once.state);
  });

  it("is deterministic", () => {
    const econ = economy();
    expect(advanceNation(disturbed(), econ, T0 + 40 * MONTH_MS).state).toEqual(
      advanceNation(disturbed(), econ, T0 + 40 * MONTH_MS).state
    );
  });

  it("does not move on a paused realm's clock", () => {
    const clock = {
      anchorRealMs: 0,
      anchorClockMs: T0 + 3 * MONTH_MS,
      multiplier: 0,
      changedAt: 0,
      calendarOffsetMs: 0,
      era: "",
    };
    let real = 1_000;
    const reader = realmClockReader("r1", clock, () => real);
    const first = advanceNation(disturbed(), economy(), reader.now());
    real += 365 * 24 * 3600 * 1000; // a real year later, still paused
    const later = advanceNation(first.state, economy(), reader.now());
    expect(reader.paused).toBe(true);
    expect(first.months).toBe(3);
    expect(later.months).toBe(0);
    expect(later.state).toBe(first.state);
  });

  it("catches up a five-year date jump on the next read", () => {
    const econ = economy();
    const before = advanceNation(disturbed(), econ, T0 + MONTH_MS);
    const jumpedTo = T0 + MONTH_MS + 5 * 12 * MONTH_MS;
    const after = advanceNation(before.state, econ, jumpedTo);
    expect(after.months).toBe(60);
    expect(after.state.lastTickClockMs).toBe(jumpedTo);
    const monthly = advanceNation(before.state, econ, jumpedTo, "stepwise");
    const a = deriveNation(after.state, econ, [], jumpedTo);
    const b = deriveNation(monthly.state, econ, [], jumpedTo);
    expect(relative(a.combatPower, b.combatPower)).toBeLessThan(0.01);
    // Readiness recovered under the professional split.
    expect(a.readiness).toBeGreaterThan(deriveNation(before.state, econ, [], T0 + MONTH_MS).readiness);
  });
});
