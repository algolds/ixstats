/** The Factbook tab: three snapshot blocks, each opening its sheet with its own URL. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { FactbookTab } from "~/components/country-profile/factbook/FactbookTab";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock("~/components/country-profile/factbook/FactbookSheets", () => ({
  FactbookSheets: ({ open }: { open: { sheet: string; segment: string } | null }) =>
    open ? (
      <div role="dialog" aria-label={`${open.sheet} sheet`} data-segment={open.segment} />
    ) : null,
}));

function layer(
  overrides: { relations?: number; election?: CountryProfileLayer["state"]["election"] } = {}
): CountryProfileLayer {
  const relations = Array.from({ length: overrides.relations ?? 1 }, (_, i) => ({
    id: `r${i}`,
    countryId: `c${i}`,
    name: `Partner ${i}`,
    flagUrl: null,
    relationship: "FRIENDLY",
    strength: 50,
    treaties: [],
  }));
  return {
    countryId: "c1",
    slug: "caphiria",
    identity: {
      name: "Caphiria",
      demonym: "Caphirian",
      languages: "Caphiric Latin",
      currency: "Aureus",
      governmentType: null,
      leaders: [],
      realm: null,
    },
    vitals: {
      population: 627_200_000,
      populationGrowth: 0.005,
      gdpTotal: 40.31e12,
      gdpGrowth: 0,
      unemployment: 5,
      inflation: 2,
      history: [],
    },
    land: { subdivisions: [], cities: [], neighbors: [], profile: null },
    state: {
      government: {
        name: "Imperial Government",
        type: "Federal Republic",
        headOfState: "Imperator",
        headOfGovernment: "Prime Minister",
        legislature: "Corcillum",
        executive: null,
        judiciary: null,
        departments: [],
      },
      election: overrides.election ?? null,
      isLoading: false,
    },
    world: { rankings: [], relations, embassies: [], isLoading: false },
    chronicle: [],
    clock: ixnayReader(),
  } as unknown as CountryProfileLayer;
}

beforeEach(() => window.history.replaceState(null, "", "/countries/caphiria"));

describe("FactbookTab", () => {
  it("shows the three snapshot blocks, each with its details button", () => {
    render(<FactbookTab layer={layer()} />);
    for (const title of ["Economy & people", "State", "Foreign affairs"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `More about ${title}` })).toBeInTheDocument();
    }
    expect(screen.getByText("$40.31T")).toBeInTheDocument();
    expect(screen.getByText("Federal Republic")).toBeInTheDocument();
  });

  it("opens a block's sheet and gives it a URL", () => {
    const push = jest.spyOn(window.history, "pushState");
    render(<FactbookTab layer={layer()} />);
    fireEvent.click(screen.getByRole("button", { name: "More about State" }));
    expect(screen.getByRole("dialog", { name: "state sheet" })).toBeInTheDocument();
    expect(push).toHaveBeenLastCalledWith(null, "", "/countries/caphiria?sheet=state");
    push.mockRestore();
  });

  it("opens straight onto a sheet named in the address", () => {
    window.history.replaceState(null, "", "/countries/caphiria?sheet=economy&segment=labor");
    render(<FactbookTab layer={layer()} />);
    expect(screen.getByRole("dialog", { name: "economy sheet" })).toHaveAttribute(
      "data-segment",
      "labor"
    );
  });

  it("closes the sheet on back", () => {
    render(<FactbookTab layer={layer()} />);
    fireEvent.click(screen.getByRole("button", { name: "More about Foreign affairs" }));
    act(() => {
      window.history.replaceState(null, "", "/countries/caphiria");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("follows the address when it changes under the mounted tab (a link, or a restored Back)", () => {
    const { rerender } = render(<FactbookTab layer={layer()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    window.history.replaceState(null, "", "/countries/caphiria?sheet=foreign");
    rerender(<FactbookTab layer={layer()} />);
    expect(screen.getByRole("dialog", { name: "foreign sheet" })).toBeInTheDocument();
    window.history.replaceState(null, "", "/countries/caphiria");
    rerender(<FactbookTab layer={layer()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists the people's demonym and languages in the Economy & people block", () => {
    render(<FactbookTab layer={layer()} />);
    expect(screen.getByText("Caphirian")).toBeInTheDocument();
    expect(screen.getByText("Caphiric Latin")).toBeInTheDocument();
  });

  it("dates the next election in the country's realm calendar", () => {
    const election = {
      lastName: null,
      lastIxTime: null,
      turnout: null,
      results: [],
      upcomingName: "General election",
      upcomingIxTime: CLOCK_NOW + 20 * DAY,
      totalSeats: 0,
    };
    render(<FactbookTab layer={{ ...layer({ election }), clock: sixTimesReader() }} />);
    expect(screen.getByText("General election · 4 Frostfall 812 AE")).toBeInTheDocument();
  });

  it("says so when there are no foreign relations", () => {
    render(<FactbookTab layer={layer({ relations: 0 })} />);
    expect(screen.getByText("No foreign relations yet")).toBeInTheDocument();
  });
});
