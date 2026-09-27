/**
 * Plan 188: the Overview and Work passport tabs render from the focused procedures' payloads.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { PassportOverviewTab } from "~/components/passport/tabs/PassportOverviewTab";
import { PassportWorkTab } from "~/components/passport/tabs/PassportWorkTab";
import type { PassportPayload, WorkPayload } from "~/components/passport/types";

jest.mock("~/components/ui/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

const passport: PassportPayload = {
  handle: "alex",
  account: {
    userId: "u1",
    roleName: "Sovereign",
    isOwner: false,
    createdAt: "2024-05-01T00:00:00.000Z",
    clerkUsername: "alex",
    clerkDisplayName: "Alex Pav",
    clerkImageUrl: null,
  },
  featuredRealm: {
    id: "default",
    name: "IxEarth",
    slug: "ixearth",
    role: "Sovereign",
    isFeatured: true,
    country: {
      id: "c1",
      name: "Caphiria",
      slug: "caphiria",
      flagUrl: null,
      coatOfArmsUrl: null,
      currentPopulation: 1,
      currentTotalGdp: 1,
      currentGdpPerCapita: 1,
      continent: null,
      region: null,
      governmentType: null,
      currentPublicApproval: 50,
    },
  },
  realmCount: 1,
  wiki: {
    linked: true,
    username: "Alex",
    editCount: 42,
    groups: [],
    lorewards: null,
    awardHistory: [],
  },
  forum: {
    linked: false,
    username: null,
    userTitle: null,
    isStaff: false,
    messageCount: 0,
    reactionScore: 0,
    trophyPoints: 0,
    joinedDate: null,
  },
  vault: {
    totalCards: 0,
    deckValue: 0,
    collectorLevel: 3,
    collectorXp: 120,
    credits: 0,
    topCards: [],
  },
  thinkpages: { linked: false, username: null, bio: null, postCount: 0, followerCount: 0 },
  discord: { linked: true, username: "alexpav" },
};

const work: WorkPayload = {
  authoredArticles: [
    {
      id: "a1",
      slug: "imperial_senate",
      title: "Imperial Senate",
      summary: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ],
  conlangs: [
    { id: "l1", name: "Latinic", description: null, culturalFamily: null, slug: "latinic" },
  ],
  sportTeams: [],
  directives: [],
  wikiActivityFeed: [],
};

describe("PassportOverviewTab", () => {
  it("shows the featured realm claim with a contextual realm passport link", () => {
    render(<PassportOverviewTab data={passport} cleanUsername="alex" />);

    expect(screen.getByText("Sovereign of Caphiria")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /In IxEarth/ })).toHaveAttribute(
      "href",
      "/r/ixearth/alex"
    );
    expect(screen.getByText("@alexpav")).toBeInTheDocument();
    expect(screen.getByText("Lv 3")).toBeInTheDocument();
  });
});

describe("PassportWorkTab", () => {
  it("lists creations and narrows them with the category pills", () => {
    render(<PassportWorkTab work={work} wiki={passport.wiki} cleanUsername="alex" />);

    expect(screen.getByText("All Work (2)")).toBeInTheDocument();
    expect(screen.getByText("Imperial Senate")).toBeInTheDocument();
    expect(screen.getByText("Latinic")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Languages (1)"));
    expect(screen.queryByText("Imperial Senate")).not.toBeInTheDocument();
    expect(screen.getByText("Latinic")).toBeInTheDocument();
  });

  it("shows the empty state when there is no work and no linked wiki", () => {
    const empty: WorkPayload = { ...work, authoredArticles: [], conlangs: [] };
    render(
      <PassportWorkTab
        work={empty}
        wiki={{ ...passport.wiki, linked: false }}
        cleanUsername="alex"
      />
    );
    expect(screen.getByText("No Published Work Found")).toBeInTheDocument();
  });
});
