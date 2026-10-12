import React from "react";
import { render, screen, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  isError?: boolean;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const query = (name: string) => ({
    useQuery: () => ({ isLoading: false, isError: false, refetch: jest.fn(), ...results[name] }),
  });
  return {
    results,
    api: {
      frontPage: { get: query("frontPage") },
      realms: { region: { happenings: query("happenings") } },
      wikios: { getMainPage: query("wiki") },
      thinkpagesForum: { latestActivity: query("forum") },
    },
  };
});

jest.mock("~/context/auth-context", () => ({
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// MapLibre does not run in jsdom; the map's own behaviour is the embed's concern.
jest.mock("~/components/maps/widgets/CoordinatesMapEmbed", () => ({
  CoordinatesMapEmbed: () => <div data-testid="map" />,
}));

jest.mock("~/app/r/[realm]/_components/RealmSidebar", () => ({
  HappeningLine: ({ item }: { item: { text: string } }) => <li>{item.text}</li>,
}));

import { FrontPage } from "~/app/_components/front-page/FrontPage";

const { results } = jest.requireMock<{ results: Record<string, QueryResult> }>("~/trpc/react");

const nation = (i: number) => ({
  id: `n${i}`,
  slug: `nation-${i}`,
  name: `Nation ${i}`,
  flagUrl: null,
  currentPopulation: 1_000_000,
  currentTotalGdp: 1e12,
  currentGdpPerCapita: 30_000,
  economicTier: "Developed",
  governmentType: null,
});

beforeEach(() => {
  results.frontPage = {
    data: {
      featured: { slug: "eurth", name: "Eurth", thumbnail: null, nationCount: 40 },
      facts: { realms: 6, nations: 82, players: 1204 },
      nations: [nation(1), nation(2)],
      openRealms: [{ slug: "caphiria", name: "Caphiria", thumbnail: null, openNationCount: 3 }],
    },
  };
  results.happenings = { data: { items: [{ id: "h1", text: "Nation 1 was founded" }] } };
  results.wiki = {
    data: {
      featured: { title: "Caphiria", slug: "Caphiria", excerpt: "An empire.", image: null },
      recentChanges: [{ title: "Urcea", user: "Ed", timestamp: "2026-10-01T00:00:00Z" }],
    },
  };
  results.forum = { data: [] };
});

const pane = (title: string) =>
  screen.getByRole("heading", { name: title }).closest<HTMLElement>("[data-slot='card']")!;

describe("FrontPage", () => {
  it("presents IxStates, today's realm, the apps and one way to join", () => {
    render(<FrontPage />);
    expect(screen.getByRole("heading", { level: 1, name: "IxStates" })).toBeInTheDocument();
    expect(screen.getByText("6 realms · 82 nations · 1,204 players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse realms" })).toHaveAttribute("href", "/realms");

    expect(within(pane("Eurth")).getByRole("link", { name: /Open map/ })).toHaveAttribute(
      "href",
      "/maps?realm=eurth"
    );
    expect(within(pane("Happenings")).getByText("Nation 1 was founded")).toBeInTheDocument();
    expect(within(pane("Wiki")).getByRole("link", { name: /Caphiria/ })).toHaveAttribute(
      "href",
      "/wiki/Caphiria"
    );
    expect(within(pane("ThinkPages")).getByText("No forum posts yet.")).toBeInTheDocument();
    expect(
      within(pane("Realms with open nations")).getByText("3 open nations")
    ).toBeInTheDocument();
    expect(within(pane("Nations in Eurth")).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Create an account" })).toBeInTheDocument();
  });

  it("keeps a failing source inside its own pane", () => {
    results.wiki = { isError: true };
    render(<FrontPage />);
    expect(within(pane("Wiki")).getByText("Couldn't load the wiki.")).toBeInTheDocument();
    expect(within(pane("Wiki")).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(within(pane("Nations in Eurth")).getAllByRole("row")).toHaveLength(3);
  });

  it("shows the header without facts, and realm panes in error, when the front page data fails", () => {
    results.frontPage = { isError: true };
    render(<FrontPage />);
    expect(screen.getByRole("heading", { level: 1, name: "IxStates" })).toBeInTheDocument();
    expect(screen.queryByText(/realms ·/)).not.toBeInTheDocument();
    expect(
      within(pane("Featured realm")).getByText("Couldn't load today's realm.")
    ).toBeInTheDocument();
    expect(within(pane("Happenings")).getByText("Couldn't load happenings.")).toBeInTheDocument();
    expect(within(pane("Wiki")).getByText("Caphiria")).toBeInTheDocument();
  });
});
