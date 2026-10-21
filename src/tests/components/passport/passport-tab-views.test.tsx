/**
 * The Realms and Work passport tabs render from the focused procedures' payloads.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { PassportWorkTab } from "~/components/passport/tabs/PassportWorkTab";
import type { PassportPayload, WorkPayload } from "~/components/passport/types";

jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

const passport: PassportPayload = {
  handle: "alex",
  account: {
    userId: "u1",
    isOwner: false,
    createdAt: "2024-05-01T00:00:00.000Z",
    clerkUsername: "alex",
    clerkDisplayName: "Alex Pav",
    clerkImageUrl: null,
    signature: null,
  },
  online: false,
  privacy: {
    accolades: true,
    impact: true,
    forumStats: true,
    vaultCards: true,
    historyStream: true,
    achievements: true,
    linkPreview: true,
  },
  primaryNation: {
    id: "default",
    name: "Ixnay",
    slug: "ixnay",
    role: "founder",
    isPrimary: true,
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
  nationCount: 1,
  recruitedCount: 0,
  wiki: {
    linked: true,
    username: "Alex",
    lorewards: null,
  },
  forum: {
    linked: false,
    username: null,
    stats: null,
  },
  vault: {
    totalCards: 0,
    deckValue: 0,
    collectorLevel: 3,
    collectorXp: 120,
    xpPerLevel: 1000,
    credits: 0,
    focus: { categoryCount: 0, categoryTotal: 12, topCategory: null },
    topCards: [],
  },
  showcase: {
    achievements: { unlockedCount: 0, totalCount: 76, points: 0, ribbons: [] },
  },
  thinkpages: { bio: null },
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
describe("PassportWorkTab", () => {
  it("lists creations and narrows them with the category pills", () => {
    render(
      <PassportWorkTab work={work} wiki={passport.wiki} forum={passport.forum} handle="alex" />
    );

    expect(screen.getByText("All work (2)")).toBeInTheDocument();
    expect(screen.getByText("Imperial Senate")).toBeInTheDocument();
    expect(screen.getByText("Latinic")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Languages (1)"));
    expect(screen.queryByText("Imperial Senate")).not.toBeInTheDocument();
    expect(screen.getByText("Latinic")).toBeInTheDocument();
  });
  it("shows no forum counters when they are hidden or unavailable", () => {
    render(
      <PassportWorkTab work={work} wiki={passport.wiki} forum={passport.forum} handle="alex" />
    );
    expect(screen.queryByLabelText("Forum")).not.toBeInTheDocument();
  });
});
