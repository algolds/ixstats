/**
 * The Standing card shows "—" for a population or GDP the record does not have, never 0 or "$0".
 */
jest.mock("~/trpc/react", () => ({ api: {} }));

import { deriveFigures } from "~/components/mycountry/shell/StandingBands";

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
