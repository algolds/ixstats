/**
 * Owner ruling 2026-10-28 (stress finding C-31): executive bandwidth scales logarithmically with nation size. Each
 * tenfold rise in population adds a fixed step, so mid-size nations keep about what they had (10M at 60
 * effectiveness: 160) while Varshan (752M) gets ~283 instead of 7,212, a number its directives, policies and
 * components can actually bind. Hiring (civil service expansion) adds on top.
 */
import {
  calculateCivilServiceCapacity,
  CAPACITY_STEP_PER_TENFOLD,
} from "~/lib/government/atomic-utils";

it("keeps mid-size nations where they were and stops large ones running away", () => {
  expect(calculateCivilServiceCapacity(10_000_000, 60)).toBe(160);
  expect(calculateCivilServiceCapacity(752_416_969, 94.5)).toBe(283);
  expect(calculateCivilServiceCapacity(2_485, 50)).toBe(100);
});

it("adds the same step for every tenfold rise, scaled by effectiveness", () => {
  const at = (pop: number) => calculateCivilServiceCapacity(pop, 100);
  expect(at(10_000_000) - at(1_000_000)).toBe(CAPACITY_STEP_PER_TENFOLD);
  expect(at(1_000_000_000) - at(100_000_000)).toBe(CAPACITY_STEP_PER_TENFOLD);
  expect(calculateCivilServiceCapacity(1e9, 0)).toBe(100);
});

it("adds civil service hiring on top", () => {
  expect(calculateCivilServiceCapacity(10_000_000, 60, 250)).toBe(410);
});
