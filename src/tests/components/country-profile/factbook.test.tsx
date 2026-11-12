/** The Factbook tab: three snapshot blocks, each opening its sheet with its own URL. */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { buildProfileMedia } from "~/app/countries/[slug]/_utils/profileLayer";
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

/** A card face as the public record sends it (`toCardFace`). */
const face = (cardId: string, title: string, rarity: "EPIC" | "RARE") => ({
  cardId,
  title,
  rarity,
  cardType: "LORE" as const,
  realm: { id: "r1", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: `/images/${cardId}.jpg`,
  uncollected: false,
  number: 42,
  season: null,
  isRetired: false,
  copy: null,
});

/** A cover candidate article (`countries.getCoverArticles`). */
const cover = (title: string, imageUrl: string | null) => ({
  title,
  slug: title.replace(/ /g, "_"),
  summary: null,
  imageUrl,
  readingTime: 4,
});

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

  it("leaves unemployment, literacy and population to the hero, keeping the rest of the economy", () => {
    render(<FactbookTab layer={layer()} />);
    const economy = screen
      .getByText("Economy & people")
      .closest('[data-slot="card"]') as HTMLElement;
    for (const label of [/^Unemployment/, /^Literacy$/, /^Population$/]) {
      expect(within(economy).queryByText(label)).toBeNull();
    }
    expect(within(economy).getByText("Real growth")).toBeInTheDocument();
  });

  it("leaves the demonym and languages to the hero's facts strip", () => {
    render(<FactbookTab layer={layer()} />);
    expect(screen.queryByText("Caphirian")).toBeNull();
    expect(screen.queryByText("Caphiric Latin")).toBeNull();
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

  it("renders the snapshot blocks on the Facet Lens over the national backdrop, with inner cards as wells", () => {
    const base = layer();
    const rich: CountryProfileLayer = {
      ...base,
      identity: {
        ...base.identity,
        motto: "Per aspera ad astra",
        capital: "Aurelia",
        coatOfArmsUrl: "/images/caphiria-coa.svg",
      },
      vitals: {
        ...base.vitals,
        gdpPerCapita: 64_270,
        history: [
          { year: 2038, gdp: 36.1e12, population: 615_000_000 },
          { year: 2039, gdp: 38.4e12, population: 621_000_000 },
          { year: 2040, gdp: 40.31e12, population: 627_200_000 },
        ],
      },
      land: {
        ...base.land,
        areaSqKm: 1_240_000,
        profile: {
          dominantClimate: "Mediterranean",
          dominantElevation: "Highland plateau",
          arableLandPercent: 28.4,
          coastlineKm: 1_850,
          isLandlocked: false,
          isIsland: false,
        },
        subdivisions: [
          {
            id: "sub-1",
            name: "Province of Aurelia",
            type: "province",
            capital: "Aurelia",
            population: 210_000_000,
          },
          {
            id: "sub-2",
            name: "Duchy of Velia",
            type: "duchy",
            capital: "Velia",
            population: 140_000_000,
          },
        ],
      },
      state: {
        ...base.state,
        government: {
          ...base.state.government!,
          departments: ["Treasury", "Chancery"],
        },
        election: {
          lastName: "810 Imperial Diet",
          lastIxTime: CLOCK_NOW - 100 * DAY,
          turnout: 78.4,
          totalSeats: 400,
          upcomingName: "General election",
          upcomingIxTime: CLOCK_NOW + 20 * DAY,
          results: [
            { partyName: "Civic Union", seatsWon: 220, votePercentage: 55, color: "" },
            { partyName: "Reform Front", seatsWon: 180, votePercentage: 45, color: "" },
          ],
        },
      },
      world: {
        ...base.world,
        embassies: [
          {
            id: "emb-1",
            countryName: "Urcea",
            countrySlug: "urcea",
            flagUrl: null,
            role: "host",
            status: "ACTIVE",
            level: 3,
          },
        ],
      },
    };

    const { container } = render(<FactbookTab layer={rich} />);

    // Top-level Factbook blocks are Facet Lenses; nested sub-blocks inside them are Wells.
    const lenses = container.querySelectorAll('[data-slot="card"][data-variant="lens"]');
    expect(lenses.length).toBeGreaterThanOrEqual(3);
    const wells = container.querySelectorAll('[data-slot="card"][data-variant="well"]');
    expect(wells.length).toBeGreaterThan(0);

    // Geography and symbols moved to the hero's Country DNA row; the Factbook no longer repeats them.
    expect(screen.queryByText(/Per aspera ad astra/)).toBeNull();

    // Economy block renders the historical GDP sparkline and interactive region segments.
    expect(screen.getByRole("img", { name: /GDP trend/i })).toBeInTheDocument();
    const regionBtn = screen.getByRole("button", { name: /Province of Aurelia/i });
    fireEvent.mouseEnter(regionBtn);
    fireEvent.focus(regionBtn);
    fireEvent.click(regionBtn);
    fireEvent.mouseLeave(regionBtn.parentElement!);
    expect(screen.getByText(/Province of Aurelia · 210\.0M/i)).toBeInTheDocument();

    // State block renders the legislature seat composition and cabinet ministries.
    expect(screen.getByText("400 seats")).toBeInTheDocument();
    expect(screen.getByText("Civic Union")).toBeInTheDocument();
    expect(screen.getByText("Treasury")).toBeInTheDocument();

    // Foreign block links embassies directly to partner country profiles.
    expect(screen.getByRole("link", { name: /Urcea/i })).toHaveAttribute(
      "href",
      "/countries/urcea"
    );

    // No MyCountry monogram backdrop: the public factbook wears the realm tint, not MyCountry's gold.
    expect(container.querySelector('[data-slot="monogram-plane-deep"]')).toBeNull();
    const stage = container.querySelector('[data-slot="factbook-stage"]')!;
    expect(stage.closest('[data-app="mycountry"]')).toBeNull();
  });

  it("renders domain cover photos, the illustrated lore spotlight and IxVault collectible cards", () => {
    const base = layer();
    const media = buildProfileMedia(
      {
        cardImages: {},
        articles: [
          {
            id: "art-econ",
            title: "Economy of Caphiria",
            slug: "Economy_of_Caphiria",
            summary: "The imperial banking and rail network of Caphiria.",
            imageUrl: "/images/caphiria-econ.jpg",
            readingTime: 6,
          },
          {
            id: "art-state",
            title: "Colleges (Caphiria)",
            slug: "Colleges_(Caphiria)",
            summary: "The deliberative colleges of the Imperial Republic.",
            imageUrl: "/images/caphiria-colleges.jpg",
            readingTime: 4,
          },
          {
            id: "art-leader",
            title: "List of Imperators of Caphiria",
            slug: "List_of_Imperators_of_Caphiria",
            summary: "Heads of state of the Caphirian realm.",
            imageUrl: "/images/caphiria-imperator.jpg",
            readingTime: 8,
          },
        ],
        cards: [
          face("card-1", "Economy of Caphiria", "EPIC"),
          face("card-2", "Caphirian Imperial League", "RARE"),
        ],
      },
      "Caphiria",
      {
        economy: [cover("Economy of Caphiria", "/images/caphiria-econ.jpg")],
        state: [
          cover("Government of Caphiria", null),
          cover("Colleges (Caphiria)", "/images/caphiria-colleges.jpg"),
        ],
        foreign: [cover("Foreign relations of Caphiria", "/images/caphiria-treaty.jpg")],
      }
    );

    const rich: CountryProfileLayer = {
      ...base,
      identity: {
        ...base.identity,
        officialName: "Imperial Republic of Caphiria",
        motto: "Per aspera ad astra",
        flagUrl: "/images/caphiria-flag.png",
        coatOfArmsUrl: "/images/caphiria-coa.svg",
      },
      land: {
        ...base.land,
        cities: [
          {
            id: "city-1",
            name: "Aurelia",
            population: 14_200_000,
            isCapital: true,
            isPort: true,
            coordinates: null,
            subdivisionId: null,
          },
        ],
      },
      media,
    };

    const { container } = render(<FactbookTab layer={rich} />);

    // Editorial cover headers on the three SnapshotBlocks (Economy, State, Foreign) link directly to their Wiki pages.
    const covers = container.querySelectorAll('[data-slot="block-cover"]');
    expect(covers.length).toBe(3);
    expect(covers[0]).toHaveAttribute("href", "/wiki/Economy_of_Caphiria");
    // Captioned by the block's top article even when a later one supplies the image.
    expect(covers[1]).toHaveAttribute("href", "/wiki/Government_of_Caphiria");
    // A league card is never Foreign affairs' cover.
    expect(covers[2]).toHaveAttribute("href", "/wiki/Foreign_relations_of_Caphiria");

    // Illustrated Encyclopedia & Lore Spotlight cards link to /wiki/[slug].
    expect(screen.getByRole("heading", { name: "Country Lore" })).toBeInTheDocument();
    const loreCards = container.querySelectorAll('[data-slot="factbook-lore-card"]');
    expect(loreCards.length).toBe(3);
    expect(loreCards[0]).toHaveAttribute("href", "/wiki/Economy_of_Caphiria");

    // National collectibles are the Vault's own card faces at shelf size, opening the card's sheet.
    expect(screen.getByRole("heading", { name: "National collectibles" })).toBeInTheDocument();
    const faces = container.querySelectorAll(
      '[data-slot="factbook-collectible-card"] [data-card-face]'
    );
    expect(faces.length).toBe(2);
    expect(faces[0]).toHaveAttribute("data-card-rarity", "EPIC");
    expect(faces[0]).toHaveClass("aspect-[5/7]", "w-32");
    expect(faces[0]).toHaveAttribute("href", "/vault/cards/explore?card=card-1");
  });

  it("links unillustrated canonical domain articles via a Wiki dossier well and never assigns unrelated images", () => {
    const base = layer();
    const media = buildProfileMedia(
      {
        cardImages: {},
        articles: [
          {
            id: "art-gov",
            title: "Government of Caphiria",
            slug: "Government_of_Caphiria",
            summary: "The Imperial Government of Caphiria.",
            imageUrl: null,
            readingTime: 18,
          },
          {
            id: "art-cuisine",
            title: "Cuisine of Caphiria",
            slug: "Cuisine_of_Caphiria",
            summary: "Culinary traditions of Caphiria.",
            imageUrl: "/images/caphiria-food.jpg",
            readingTime: 5,
          },
        ],
        cards: [],
      },
      "Caphiria",
      {
        economy: [],
        state: [
          {
            title: "Government of Caphiria",
            slug: "Government_of_Caphiria",
            summary: "The Imperial Government of Caphiria.",
            imageUrl: null,
            readingTime: 18,
          },
        ],
        foreign: [],
      }
    );

    expect(media.sectionCovers.economy).toBeNull();
    expect(media.sectionCovers.foreign).toBeNull();
    expect(media.sectionCovers.state).toEqual({
      url: null,
      caption: "Government of Caphiria",
      href: "/wiki/Government_of_Caphiria",
      summary: "The Imperial Government of Caphiria.",
      readingTime: 18,
    });

    const { container } = render(<FactbookTab layer={{ ...base, media }} />);
    expect(container.querySelectorAll('[data-slot="block-cover"]').length).toBe(0);
    const wikiLinks = container.querySelectorAll('[data-slot="block-wiki-link"]');
    expect(wikiLinks.length).toBe(1);
    expect(wikiLinks[0]).toHaveAttribute("href", "/wiki/Government_of_Caphiria");
  });
});
