/**
 * Render tests for the country profile (`CommandProfileView`): it renders the layer from real
 * data only, reads directives and outcomes from the server-filtered public record (signed out
 * too), restores the Sovereign Command OS pieces only where there is data, and reveals the
 * owner strip only to the owner.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import { api } from "~/trpc/react";
import {
  CommandProfileView,
  type CommandProfileViewProps,
} from "~/app/countries/[slug]/_components/CommandProfileView";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/countries/testland",
}));

const mockQuery = (data: unknown) => ({ data, isLoading: false, isError: false, error: null });

const country = {
  id: "c1",
  name: "Testland",
  slug: "testland",
  continent: "Argis",
  currentPopulation: 12_500_000,
  currentTotalGdp: 480_000_000_000,
  currentGdpPerCapita: 38_400,
  adjustedGdpGrowth: 0.024,
  populationGrowthRate: 0.008,
  economicTier: "Developed",
  populationTier: "3",
  landArea: 250_000,
  unemploymentRate: 5.5,
  publicApproval: 61,
  historical: [],
  nationalIdentity: { motto: "Onward together", capitalCity: "Port Lune" },
} as unknown as CommandProfileViewProps["country"];

const base: CommandProfileViewProps = {
  slug: "testland",
  country,
  flagUrl: null,
  isOwner: false,
  currentIxTime: Date.parse("2042-01-01T00:00:00Z"),
};

const publicRecord = {
  directives: [
    {
      id: "a",
      goal: "Open the northern ports",
      summary: null,
      tier: "measured",
      category: "economy",
      status: "active",
      progress: 30,
      createdIxTime: Date.parse("2041-02-01T00:00:00Z"),
    },
  ],
  issueOutcomes: [
    {
      id: "n1",
      title: "Harbour strike",
      domain: "economy",
      decision: "Meet the unions",
      outcome: "Wages rose.",
      resolvedBy: "government",
      ixTime: Date.parse("2041-05-01T00:00:00Z"),
    },
  ],
};

const ownerTree = {
  roots: [],
  allIntents: [
    { id: "a", status: "active" },
    { id: "b", goal: "Secret draft plan", status: "proposed" },
  ],
};

const rankings = [
  { category: "GDP per Capita", global: { position: 3, total: 41 }, value: 38_400 },
  { category: "Population", global: { position: 20, total: 41 }, value: 12_500_000 },
  { category: "Public Approval", global: { position: 10, total: 41 }, value: 61 },
];

let anyApi: any;

beforeEach(() => {
  anyApi = api as any;
  anyApi.countries.getPublicRecord.useQuery.mockReturnValue(mockQuery(publicRecord));
  anyApi.intent.getTree.useQuery.mockReturnValue(mockQuery(ownerTree));
  anyApi.mycountry.getRankings.useQuery.mockReturnValue(mockQuery(rankings));
  anyApi.nationalIssues.getPendingCount.useQuery.mockReturnValue(
    mockQuery({ total: 4, urgent: 1 })
  );
});

describe("CommandProfileView", () => {
  it("renders the hero and the public record from real data", () => {
    render(<CommandProfileView {...base} />);
    expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeTruthy();
    expect(screen.getByText(/Onward together/)).toBeTruthy();
    expect(screen.getByText("Port Lune")).toBeTruthy();
    expect(screen.getAllByText("Open the northern ports").length).toBeGreaterThan(0);
    // Signed-out visitors read resolved outcomes too (no sign-in note).
    expect(screen.getAllByText("Harbour strike").length).toBeGreaterThan(0);
    expect(screen.queryByText(/sign in/i)).toBeNull();
    // Missing sources fall back to empty states, not sample figures.
    expect(screen.getAllByText("No wiki article yet").length).toBeGreaterThan(0);
  });

  it("reads directives and outcomes from the public record, never the owner tree", () => {
    render(<CommandProfileView {...base} />);
    expect(anyApi.countries.getPublicRecord.useQuery).toHaveBeenCalledWith(
      { countryId: "c1" },
      expect.objectContaining({ enabled: true })
    );
    const treeCall = anyApi.intent.getTree.useQuery.mock.calls.at(-1);
    expect(treeCall?.[1]).toMatchObject({ enabled: false });
    expect(anyApi.nationalIssues.getHistory.useQuery).not.toHaveBeenCalled();
    expect(screen.queryByText("Secret draft plan")).toBeNull();
    expect(screen.queryByText("Only you can see this")).toBeNull();
  });

  it("restores the national pulse, country DNA and condition matrix from real readings", () => {
    render(<CommandProfileView {...base} />);
    const pulse = screen.getByRole("region", { name: /National pulse/ });
    expect(within(pulse).getByText("Consolidating")).toBeTruthy();
    const dna = document.getElementById("command-dna")!;
    expect(within(dna).getByText("GDP per Capita")).toBeTruthy();
    expect(within(dna).getByText("#3 of 41 in IxWorld")).toBeTruthy();
    expect(within(dna).getByText("Employment")).toBeTruthy();
    expect(within(dna).getByText("94.5%")).toBeTruthy();
    // No invented stability or military figures.
    expect(within(dna).queryByText("Stability")).toBeNull();
    expect(screen.queryByText(/Readiness/)).toBeNull();
  });

  it("is the Factbook tab's overview, with tiles linking to the Factbook sections", () => {
    render(<CommandProfileView {...base} />);
    const tabs = screen.getByRole("navigation", { name: "Country sections" });
    const factbook = within(tabs).getByRole("link", { name: /Factbook/ });
    expect(factbook.getAttribute("href")).toMatch(/\/countries\/testland$/);
    expect(factbook.getAttribute("aria-current")).toBe("page");
    expect(within(tabs).queryByRole("link", { name: /Profile/ })).toBeNull();
    // No section pills on the overview: the dock navigates the page, the tiles lead to the sections.
    expect(screen.queryByRole("button", { name: /Labor/ })).toBeNull();
    const sectionLinks: [string, string][] = [
      ["Full geography", "geography"],
      ["Full economy", "economy"],
      ["Labor", "labor"],
      ["Full government", "government"],
    ];
    for (const [name, section] of sectionLinks) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(
        `/countries/testland/factbook/${section}`
      );
    }
    expect(
      screen.getAllByRole("link", { name: /Economic modeling/ })[0]!.getAttribute("href")
    ).toMatch(/\/countries\/testland\/modeling$/);
  });

  it("shows the owner strip and cover control to the owner", () => {
    render(
      <CommandProfileView
        {...base}
        isOwner
        cover={{ mode: "gradient", url: null, onChange: () => {} }}
      />
    );
    expect(screen.getByText("Only you can see this")).toBeTruthy();
    expect(screen.getByText("draft directive")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Change cover/ })).toBeTruthy();
  });
});
