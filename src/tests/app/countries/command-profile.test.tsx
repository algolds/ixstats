/**
 * The country profile (`CommandProfileView`) shows a visitor the server-filtered public record,
 * never the owner's intent tree, drafts or owner strip.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
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
});
