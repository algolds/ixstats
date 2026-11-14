/**
 * The command face shows a dash for a population or GDP the record does not have, never 0 or "$0".
 */
jest.mock("~/trpc/react", () => ({ api: {} }));

import {
  deriveFigures,
  describeExecBandwidth,
  slotPips,
} from "~/components/mycountry/shell/face/command-figures";

type Country = Parameters<typeof deriveFigures>[0];

it("reports missing population and GDP as null", () => {
  const figures = deriveFigures({ name: "Eldoria" } as Country);
  expect(figures.population).toBeNull();
  expect(figures.totalGdp).toBeNull();
});

it("derives GDP from population and GDP per capita when the total is missing", () => {
  const figures = deriveFigures({
    currentPopulation: 1_000_000,
    currentGdpPerCapita: 20_000,
  } as Country);
  expect(figures).toMatchObject({ population: 1_000_000, totalGdp: 20_000_000_000 });
});

// P2-10: the Overview Stability tile shows the figure Defense computes, not a dash for a nation with no stored row.
it("reads the computed internal stability, with the stored row as the fallback", () => {
  expect(deriveFigures({ name: "Eldoria" } as Country, 62.04).stabilityPct).toBe(62);
  const stored = { stabilityMetrics: { stabilityScore: 48 } } as Country;
  expect(deriveFigures(stored, 62.04).stabilityPct).toBe(62);
  expect(deriveFigures(stored, undefined).stabilityPct).toBe(48);
  expect(deriveFigures({ name: "Eldoria" } as Country, null).stabilityPct).toBeNull();
});

it("draws this week's directive slots as one pip each, used first", () => {
  expect(slotPips({ used: 1, cap: 3 })).toEqual([true, false, false]);
  expect(slotPips({ used: 5, cap: 3 })).toEqual([true, true, true]);
  expect(slotPips(null)).toBeNull();
  expect(slotPips({ used: 0, cap: 0 })).toBeNull();
  // Too many to count at a glance: the band falls back to a plain meter.
  expect(slotPips({ used: 2, cap: 12 })).toBeNull();
});

it("reads executive bandwidth as a count of its capacity", () => {
  const reading = describeExecBandwidth(
    { capacity: 158, used: 40.4, available: 118, overCapacity: false },
    null
  );
  expect([reading.value, reading.detail]).toEqual(["40", "of 158"]);
  expect(describeExecBandwidth(null, null).value).toBe("–");
  expect(describeExecBandwidth(null, null).detail).toBeUndefined();
});
