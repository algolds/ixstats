/**
 * The Lore tab: the country's wiki article as WikiOS renders it, without its infobox, beside WikiOS's contents. A
 * nation of another wiki (an Eurth nation on IIWiki) reads its own wiki's page.
 */
import { render, screen, within } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { LoreReader } from "~/components/country-profile/lore/LoreReader";

interface Answer {
  data?: {
    title: string;
    contentHtml: string;
    infoboxHtml: string | null;
    toc: { id: string; text: string; level: number }[];
  };
  isLoading: boolean;
  error: { data: { code: string } } | null;
}

let answer: Answer;
const useQuery = jest.fn((_input: object, _options: object) => ({ ...answer, refetch: jest.fn() }));
let country: { name: string; wikiSource: string | null; wikiPageTitle: string | null };

jest.mock("~/styles/wiki-os.css", () => ({}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getArticleHtml: {
        useQuery: (input: object, options: object) => useQuery(input, options),
      },
    },
  },
}));
jest.mock("~/app/countries/[slug]/_components/ProfileShellContext", () => ({
  useProfileShell: () => ({ country }),
}));

// WikiOS's scroll spy remeasures on resize; jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
  unobserve() {}
};

const layer = { identity: { name: "Caphiria" } } as unknown as CountryProfileLayer;

const ARTICLE = {
  title: "Caphiria",
  contentHtml:
    '<p>Caphiria is a republic.</p><h2 id="History">History</h2><p>Founded in 480 BC.</p><h2 id="Geography">Geography</h2><p>Spans Sarpedon.</p>',
  infoboxHtml: '<table class="infobox"><tr><td>Capital: Venceia</td></tr></table>',
  toc: [
    { id: "History", text: "History", level: 2 },
    { id: "Geography", text: "Geography", level: 2 },
  ],
};

beforeEach(() => {
  useQuery.mockClear();
  answer = { data: ARTICLE, isLoading: false, error: null };
  country = { name: "Caphiria", wikiSource: "ixwiki", wikiPageTitle: "Caphiria" };
});

describe("LoreReader", () => {
  it("shows the article as WikiOS renders it, in WikiOS's article styles, without its infobox", () => {
    const { container } = render(<LoreReader layer={layer} />);
    expect(screen.getByText("Founded in 480 BC.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "History" })).toBeInTheDocument();
    expect(container.querySelector(".wikios-article-content .mw-parser-output")).not.toBeNull();
    expect(screen.queryByText("Capital: Venceia")).toBeNull();
  });

  it("lists the article's sections in WikiOS's contents", () => {
    render(<LoreReader layer={layer} />);
    const contents = screen.getByRole("complementary", { name: "Contents" });
    expect(
      within(contents)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["History", "Geography"]);
  });

  it("opens and edits the article on WikiOS", () => {
    render(<LoreReader layer={layer} />);
    expect(screen.getByRole("link", { name: "Open in WikiOS" })).toHaveAttribute(
      "href",
      "/wiki/Caphiria"
    );
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("reads an Eurth nation's page from IIWiki, which WikiOS does not edit", () => {
    country = { name: "Afropa", wikiSource: "iiwiki", wikiPageTitle: "Afropan Republic" };
    answer = { ...answer, data: { ...ARTICLE, title: "Afropan Republic" } };
    render(<LoreReader layer={layer} />);
    expect(useQuery.mock.calls[0]?.[0]).toEqual({
      title: "Afropan Republic",
      wikiSource: "iiwiki",
    });
    expect(screen.getByRole("link", { name: "Open in WikiOS" })).toHaveAttribute(
      "href",
      "/wiki/Afropan_Republic?source=iiwiki"
    );
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("offers to write the article when there is none", () => {
    answer = { isLoading: false, error: { data: { code: "NOT_FOUND" } } };
    render(<LoreReader layer={layer} />);
    expect(screen.getByText("No wiki article yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create page on WikiOS" })).toBeInTheDocument();
  });

  it("says the wiki could not be loaded instead of offering to write a page that may exist", () => {
    answer = { isLoading: false, error: { data: { code: "BAD_GATEWAY" } } };
    render(<LoreReader layer={layer} />);
    expect(screen.getByText("The wiki could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create page on WikiOS" })).toBeNull();
  });
});
