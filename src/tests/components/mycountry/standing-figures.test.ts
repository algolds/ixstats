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
