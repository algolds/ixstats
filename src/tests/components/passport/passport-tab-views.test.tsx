/**
 * Plan 188: the Overview and Work passport tabs render from the focused procedures' payloads.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { PassportOverviewTab } from "~/components/passport/tabs/PassportOverviewTab";
import { PassportRealmsTab } from "~/components/passport/tabs/PassportRealmsTab";
import { PassportWorkTab } from "~/components/passport/tabs/PassportWorkTab";
import type { PassportPayload, RealmItem, WorkPayload } from "~/components/passport/types";

jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
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
  },
  primaryNation: {
    id: "default",
    name: "IxWorld",
    slug: "ixworld",
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
    isStaff: false,
    joinedDate: null,
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
  it("shows the primary nation claim with a contextual realm passport link", () => {
    render(<PassportOverviewTab data={passport} cleanUsername="alex" />);

    expect(screen.getByText("Founder of Caphiria")).toBeInTheDocument();
    expect(screen.getByText("Primary nation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /In IxWorld/ })).toHaveAttribute(
      "href",
      "/r/ixworld/alex"
    );
    expect(screen.getByText("@alexpav")).toBeInTheDocument();
    expect(screen.getByText("Lv 3")).toBeInTheDocument();
  });
});

describe("PassportRealmsTab", () => {
  it("names founders and officers, labels the primary nation, and leaves members unlabelled", () => {
    const base = passport.primaryNation!;
    const row = (id: string, role: RealmItem["role"], isPrimary: boolean): RealmItem => ({
      ...base,
      id,
      role,
      isPrimary,
      country: { ...base.country, id: `c_${id}`, name: `Nation ${id}` },
    });
    render(
      <PassportRealmsTab
        realms={[row("a", "founder", true), row("b", "officer", false), row("c", "member", false)]}
        cleanUsername="alex"
      />
    );

    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Officer")).toBeInTheDocument();
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Leader")).not.toBeInTheDocument();
    expect(screen.getAllByText("Primary nation")).toHaveLength(1);
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
    expect(screen.getByText("No published work")).toBeInTheDocument();
  });
});
