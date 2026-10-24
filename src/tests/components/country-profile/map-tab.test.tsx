/** The Map tab: the big map, land facts, regions and story pins that focus the map. */
import { fireEvent, render, screen } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { MapTab } from "~/components/country-profile/map/MapTab";
import { geometryBounds } from "~/components/maps/widgets/embed-map-layers";

const focusSpy = jest.fn();
jest.mock("~/components/country-profile/TerritoryMap", () => ({
  TerritoryMap: ({ focus }: { focus?: unknown }) => {
    focusSpy(focus);
    return <div data-testid="map" />;
  },
}));

const layer = {
  countryId: "c1",
  slug: "caphiria",
  vitals: { landArea: 7_500_000, density: 83 },
  land: {
    hasGeometry: true,
    isLoading: false,
    areaSqKm: 7_500_000,
    capital: { name: "Venceia", population: 186_000_000 },
    cities: [],
    neighbors: [],
    profile: null,
    subdivisions: [
      { id: "s2", name: "Carina", type: "province", population: 62_400_000, capital: null },
      { id: "s1", name: "Inosia", type: "province", population: 68_200_000, capital: null },
    ],
    storyPins: [
      {
        id: "p1",
        title: "The founding",
        category: "story",
        year: -480,
        eraLabel: null,
        excerpt: null,
        coordinates: [12, 41],
      },
      {
        id: "p2",
        title: "Lost pin",
        category: "story",
        year: 900,
        eraLabel: "Second Imperium",
        excerpt: null,
        coordinates: null,
      },
    ],
  },
} as unknown as CountryProfileLayer;

beforeEach(() => focusSpy.mockClear());

describe("geometryBounds", () => {
  it("covers every ring of a polygon and a multipolygon", () => {
    expect(
      geometryBounds({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 1],
            [2, 5],
            [0, 0],
          ],
        ],
      })
    ).toEqual([
      [0, 0],
      [4, 5],
    ]);
    expect(
      geometryBounds({
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [1, 1],
              [0, 0],
            ],
          ],
          [
            [
              [-3, 2],
              [6, -1],
              [-3, 2],
            ],
          ],
        ],
      })
    ).toEqual([
      [-3, -1],
      [6, 2],
    ]);
    expect(geometryBounds({ type: "Point", coordinates: [1, 1] })).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});

describe("MapTab", () => {
  it("lists regions by population and focuses the map on the one chosen", () => {
    render(<MapTab layer={layer} />);
    const regions = screen.getAllByRole("button", { name: /Inosia|Carina/ });
    expect(regions.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Inosia"),
      expect.stringContaining("Carina"),
    ]);
    fireEvent.click(regions[1]!);
    expect(focusSpy).toHaveBeenLastCalledWith({ kind: "subdivision", id: "s2" });
  });

  it("focuses a story pin's point, and lists a pin without coordinates as plain text", () => {
    render(<MapTab layer={layer} />);
    fireEvent.click(screen.getByRole("button", { name: /The founding/ }));
    expect(focusSpy).toHaveBeenLastCalledWith({ kind: "point", lng: 12, lat: 41 });
    expect(screen.getByText("Lost pin")).toBeInTheDocument();
    expect(screen.getByText("480 BC")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lost pin/ })).toBeNull();
  });

  it("leads the land facts with the area", () => {
    render(<MapTab layer={layer} />);
    expect(screen.getByText("7.5M km²")).toBeInTheDocument();
    expect(screen.getByText("Venceia · 186.0M")).toBeInTheDocument();
  });
});
