/** The Lore tab: the prologue as a lead, then every wiki chapter in order, with an index. */
import { render, screen, within } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { LoreReader } from "~/components/country-profile/lore/LoreReader";

const dossier = {
  wikiData: {
    sections: [] as { id: string; title: string; content: string; classification: string }[],
    error: undefined as string | undefined,
    wikiSource: "ixwiki",
  },
  isLoading: false,
  hasAccess: () => true,
};
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/hooks/useDossier", () => ({ useDossier: () => dossier }));
jest.mock("~/app/countries/[slug]/_components/ProfileShellContext", () => ({
  useProfileShell: () => ({
    country: { name: "Caphiria", wikiSource: "ixwiki", wikiPageTitle: "Caphiria" },
  }),
}));

function layer(prologue: string[]): CountryProfileLayer {
  return {
    identity: { name: "Caphiria" },
    lore: { prologue, articleTitle: "Caphiria", wikiHref: "/wiki/Caphiria", isLoading: false },
  } as unknown as CountryProfileLayer;
}

beforeEach(() => {
  dossier.wikiData.error = undefined;
  dossier.wikiData.sections = [
    { id: "overview", title: "Overview", content: "skip me", classification: "PUBLIC" },
    { id: "history", title: "History", content: "Founded in 480 BC.", classification: "PUBLIC" },
    { id: "geography", title: "Geography", content: "Spans Sarpedon.", classification: "PUBLIC" },
  ];
});

describe("LoreReader", () => {
  it("leads with the prologue, then the chapters in article order", () => {
    render(<LoreReader layer={layer(["Caphiria is a republic.", "More."])} />);
    const lead = screen.getByText("Caphiria is a republic.");
    expect(lead.className).toMatch(/font-medium/);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["History", "Geography"]);
    expect(screen.getByText("Founded in 480 BC.")).toBeInTheDocument();
  });

  it("indexes every chapter", () => {
    render(<LoreReader layer={layer(["Caphiria is a republic."])} />);
    const index = screen.getByRole("navigation", { name: "Chapters" });
    expect(
      within(index)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Prologue", "History", "Geography"]);
  });

  it("says the wiki could not be loaded instead of offering to write a page that may exist", () => {
    dossier.wikiData.sections = [];
    dossier.wikiData.error = "Failed to load wiki data";
    render(<LoreReader layer={layer([])} />);
    expect(screen.getByText("The wiki could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create page on WikiOS" })).toBeNull();
  });

  it("offers to write the article when there is none", () => {
    dossier.wikiData.sections = [];
    render(<LoreReader layer={layer([])} />);
    expect(screen.getByText("No wiki article yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create page on WikiOS" })).toBeInTheDocument();
  });
});
