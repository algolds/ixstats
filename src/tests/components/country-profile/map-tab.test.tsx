/**
 * The Map tab: the big map, land facts, regions, cities and story pins that focus the map. Native lore (plan Task 5):
 * owner and co-authors choose a region, city or pin and "Write about this place" opens the tab's one lore writer on a
 * Place seeded with its title and location; nobody else is offered it.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { MapTab } from "~/components/country-profile/map/MapTab";
import { geometryBounds } from "~/components/maps/widgets/embed-map-layers";

const focusSpy = jest.fn();
const mockWriter = jest.fn();
let mockAccess: { enabled: boolean; isOwner: boolean; canWrite: boolean } | undefined;
jest.mock("~/trpc/react", () => ({
  api: { countryLore: { access: { useQuery: () => ({ data: mockAccess }) } } },
}));
jest.mock("~/components/country-profile/lore/LoreWriter", () => ({
  LoreWriter: (props: { open: boolean }) => {
    mockWriter(props);
    return props.open ? <div role="dialog" aria-label="Lore writer" /> : null;
  },
}));
jest.mock("~/components/country-profile/TerritoryMap", () => ({
  TerritoryMap: ({ focus }: { focus?: unknown }) => {
    focusSpy(focus);
    return <div data-testid="map" />;
  },
}));

const layer = {
  countryId: "c1",
  slug: "caphiria",
  identity: { name: "Caphiria" },
  vitals: { landArea: 7_500_000, density: 83 },
  land: {
    hasGeometry: true,
    isLoading: false,
    areaSqKm: 7_500_000,
    capital: { name: "Venceia", population: 186_000_000 },
    cities: [
      {
        id: "k1",
        name: "Venceia",
        population: 186_000_000,
        isCapital: true,
        isPort: true,
        coordinates: [12.5, 41.9],
        subdivisionId: "s2",
      },
      {
        id: "k2",
        name: "Nowhere",
        population: null,
        isCapital: false,
        isPort: true,
        coordinates: null,
        subdivisionId: null,
      },
    ],
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

const realMatchMedia = window.matchMedia;
/** The viewport as media queries see it: narrow (below lg) or not. */
function viewport(narrow: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: narrow && query === "(max-width: 1023px)",
      media: query,
    }) as MediaQueryList) as typeof window.matchMedia;
}
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const lastWriter = () => mockWriter.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  focusSpy.mockClear();
  mockWriter.mockClear();
  mockAccess = { enabled: true, isOwner: false, canWrite: false };
});

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

  it("lists the cities, focusing the map on one with a point", () => {
    render(<MapTab layer={layer} />);
    fireEvent.click(screen.getByRole("button", { name: /^Venceia/ }));
    expect(focusSpy).toHaveBeenLastCalledWith({ kind: "point", lng: 12.5, lat: 41.9 });
    expect(screen.getByText("Nowhere")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nowhere/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Venceia/ })).toHaveTextContent("Capital");
    expect(screen.getByText("Port")).toBeInTheDocument();
  });

  it("lists regions and cities under their own headings, leaving out an empty one", () => {
    const { unmount } = render(<MapTab layer={layer} />);
    expect(screen.getByRole("heading", { name: "Regions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cities" })).toBeInTheDocument();
    unmount();
    render(<MapTab layer={{ ...layer, land: { ...layer.land, cities: [] } }} />);
    expect(screen.getByRole("heading", { name: "Regions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cities" })).toBeNull();
  });

  it("lists the cities alone when the map has no regions", () => {
    render(<MapTab layer={{ ...layer, land: { ...layer.land, subdivisions: [] } }} />);
    expect(screen.queryByRole("heading", { name: "Regions" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Cities" })).toBeInTheDocument();
    expect(screen.queryByText(/No regions or cities/)).toBeNull();
  });

  it("says when the map has no regions or cities", () => {
    render(<MapTab layer={{ ...layer, land: { ...layer.land, cities: [], subdivisions: [] } }} />);
    expect(screen.getByText("No regions or cities on the map yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Regions" })).toBeNull();
  });

  describe("writing about a place", () => {
    const WRITER = { enabled: true, isOwner: false, canWrite: true };

    it("is not offered to a visitor, nor while access is unknown", () => {
      for (const access of [undefined, { enabled: true, isOwner: false, canWrite: false }]) {
        mockAccess = access;
        const { unmount } = render(<MapTab layer={layer} />);
        fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
        expect(screen.queryByRole("button", { name: "Write about this place" })).toBeNull();
        expect(screen.queryByText(/to write about it/)).toBeNull();
        expect(lastWriter()).toEqual(expect.objectContaining({ open: false }));
        unmount();
      }
    });

    it("asks a writer to choose a place first", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      expect(screen.getByText("Choose a region, city or story to write about it.")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Write about this place" })).toBeNull();
    });

    it("seeds a region as a Place with its title", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
      const bar = screen.getByRole("group", { name: "Write lore about a place" });
      expect(within(bar).getByText("Inosia")).toBeInTheDocument();
      fireEvent.click(within(bar).getByRole("button", { name: "Write about this place" }));
      expect(screen.getByRole("dialog", { name: "Lore writer" })).toBeInTheDocument();
      expect(lastWriter()).toEqual(
        expect.objectContaining({
          open: true,
          countryId: "c1",
          countryName: "Caphiria",
          seed: { type: "place", title: "Inosia" },
        })
      );
      act(() => (lastWriter().onClose as () => void)());
      expect(lastWriter()).toEqual(expect.objectContaining({ open: false }));
    });

    it("seeds a city with its point and its region", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /^Venceia/ }));
      fireEvent.click(screen.getByRole("button", { name: "Write about this place" }));
      expect(lastWriter().seed).toEqual({
        type: "place",
        title: "Venceia",
        place: { lng: 12.5, lat: 41.9, subdivision: "Carina" },
      });
    });

    it("seeds a story pin with its point", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /The founding/ }));
      fireEvent.click(screen.getByRole("button", { name: "Write about this place" }));
      expect(lastWriter().seed).toEqual({
        type: "place",
        title: "The founding",
        place: { lng: 12, lat: 41 },
      });
    });

    it("lets a writer choose a pin or city the map cannot show, without moving the map", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Lost pin/ }));
      fireEvent.click(screen.getByRole("button", { name: /Nowhere/ }));
      expect(focusSpy).toHaveBeenLastCalledWith(null);
      fireEvent.click(screen.getByRole("button", { name: "Write about this place" }));
      expect(lastWriter().seed).toEqual({ type: "place", title: "Nowhere" });
    });

    it("keeps the map where it is when the chosen place has no point", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
      fireEvent.click(screen.getByRole("button", { name: /Lost pin/ }));
      expect(focusSpy).toHaveBeenLastCalledWith({ kind: "subdivision", id: "s1" });
      expect(screen.getByRole("group", { name: "Write lore about a place" })).toHaveTextContent(
        "Lost pin"
      );
    });

    it("announces the chosen place politely", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      expect(screen.getByRole("group", { name: "Write lore about a place" })).toHaveAttribute(
        "aria-live",
        "polite"
      );
    });

    it("brings the bar into view on a narrow screen when a place is chosen", () => {
      mockAccess = WRITER;
      const scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      viewport(true);
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "nearest" }));
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole("group", { name: "Write lore about a place" })
      );
    });

    it("leaves the page where it is on a wide screen, and for a visitor", () => {
      const scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      viewport(false);
      mockAccess = WRITER;
      const { unmount } = render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
      unmount();
      viewport(true);
      mockAccess = { enabled: true, isOwner: false, canWrite: false };
      render(<MapTab layer={layer} />);
      fireEvent.click(screen.getByRole("button", { name: /Inosia/ }));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("marks the chosen place", () => {
      mockAccess = WRITER;
      render(<MapTab layer={layer} />);
      const inosia = screen.getByRole("button", { name: /Inosia/ });
      fireEvent.click(inosia);
      expect(inosia).toHaveAttribute("aria-current", "true");
      expect(screen.getByRole("button", { name: /Carina/ })).not.toHaveAttribute("aria-current");
    });
  });
});
