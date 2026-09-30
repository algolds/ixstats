/**
 * Render smoke tests for the two country-profile prototypes: both render the same layer, show
 * only the public record to visitors, and reveal the owner strip only to the owner.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { api } from "~/trpc/react";
import { ChronicleProfileView } from "~/app/countries/[slug]/_components/prototypes/ChronicleProfileView";
import { CommandProfileView } from "~/app/countries/[slug]/_components/prototypes/CommandProfileView";
import type { PrototypeViewProps } from "~/app/countries/[slug]/_components/prototypes/shared";

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
  historical: [],
} as unknown as PrototypeViewProps["country"];

const base: PrototypeViewProps = {
  country,
  flagUrl: null,
  isOwner: false,
  isSignedIn: false,
  currentIxTime: Date.parse("2042-01-01T00:00:00Z"),
  onOpenFactbook: () => {},
};

const intents = {
  roots: [],
  allIntents: [
    {
      id: "a",
      goal: "Open the northern ports",
      tier: "measured",
      category: "economy",
      status: "active",
      progress: 30,
      createdIxTime: Date.parse("2041-02-01T00:00:00Z"),
    },
    {
      id: "b",
      goal: "Secret draft plan",
      tier: "extreme",
      category: "defense",
      status: "proposed",
      progress: 0,
      createdIxTime: Date.parse("2041-03-01T00:00:00Z"),
    },
  ],
};

beforeEach(() => {
  const anyApi = api as any;
  anyApi.intent.getTree.useQuery.mockReturnValue(mockQuery(intents));
  anyApi.nationalIssues.getPendingCount.useQuery.mockReturnValue(
    mockQuery({ total: 4, urgent: 1 })
  );
});

describe.each([
  ["Chronicle", ChronicleProfileView],
  ["Command", CommandProfileView],
])("Prototype %s", (_name, View) => {
  it("renders the country from real data and only enacted directives", () => {
    render(<View {...base} />);
    expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeTruthy();
    expect(screen.getAllByText("Open the northern ports").length).toBeGreaterThan(0);
    expect(screen.queryByText("Secret draft plan")).toBeNull();
    expect(screen.queryByText("Only you can see this")).toBeNull();
    // Missing sources fall back to empty states, not sample figures.
    expect(screen.getAllByText("No wiki article yet").length).toBeGreaterThan(0);
  });

  it("shows the owner strip to the owner", () => {
    render(<View {...base} isOwner isSignedIn />);
    expect(screen.getByText("Only you can see this")).toBeTruthy();
    expect(screen.getByText("draft directive")).toBeTruthy();
  });
});
