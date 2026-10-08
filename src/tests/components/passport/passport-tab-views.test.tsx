/**
 * The Realms and Work passport tabs render from the focused procedures' payloads.
 */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
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
    linkPreview: true,
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

describe("PassportRealmsTab", () => {
  const base = passport.primaryNation!;
  const row = (
    realm: string,
    nation: string,
    role: RealmItem["role"],
    isPrimary = false
  ): RealmItem => ({
    ...base,
    id: `realm_${realm}`,
    name: `Realm ${realm}`,
    slug: `realm-${realm}`,
    role,
    isPrimary,
    country: { ...base.country, id: `c_${nation}`, name: `Nation_${nation}`, slug: nation },
  });

  it("names founders and officers, labels the primary nation, and leaves members unlabelled", () => {
    render(
      <PassportRealmsTab
        realms={[row("a", "a", "founder", true), row("b", "b", "officer"), row("c", "c", "member")]}
        cleanUsername="alex"
      />
    );

    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Officer")).toBeInTheDocument();
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Leader")).not.toBeInTheDocument();
    expect(screen.getAllByText("Primary nation")).toHaveLength(1);
  });

  it("groups nations under a realm heading that links to the realm", () => {
    render(
      <PassportRealmsTab
        realms={[
          row("a", "one", "founder", true),
          row("b", "two", "member"),
          row("a", "three", "founder"),
        ]}
        cleanUsername="alex"
      />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["Realm a", "Realm b"]);
    expect(screen.getByRole("link", { name: "Realm a" })).toHaveAttribute("href", "/r/realm-a");
    expect(screen.getByRole("link", { name: "Realm b" })).toHaveAttribute("href", "/r/realm-b");
    // One badge per realm, not per nation.
    expect(screen.getAllByText("Founder")).toHaveLength(1);

    const realmA = headings[0]!.closest("section")!;
    expect(realmA).toHaveTextContent("Nation one");
    expect(realmA).toHaveTextContent("Nation three");
    expect(realmA).not.toHaveTextContent("Nation two");
    expect(screen.getByRole("link", { name: "Nation one" })).toHaveAttribute(
      "href",
      "/countries/one"
    );
  });

  it("shows population, GDP and approval, with middle-dot separators", () => {
    const nation = row("a", "one", "member");
    nation.country = {
      ...nation.country,
      currentPopulation: 1_250_000_000,
      currentTotalGdp: 3_400_000_000_000,
      currentPublicApproval: 61.6,
      continent: "Levantia",
      governmentType: "Empire",
    };
    render(<PassportRealmsTab realms={[nation]} cleanUsername="alex" />);

    expect(screen.getByText("1.25 billion")).toBeInTheDocument();
    expect(screen.getByText("$3.40 trillion")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("Levantia · Empire")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("•");
  });

  it("shows the recruited count only when someone was recruited", () => {
    const { rerender } = render(
      <PassportRealmsTab realms={[row("a", "one", "member")]} cleanUsername="alex" />
    );
    expect(screen.queryByText(/Recruited/)).not.toBeInTheDocument();

    rerender(
      <PassportRealmsTab
        realms={[row("a", "one", "member")]}
        cleanUsername="alex"
        recruitedCount={0}
      />
    );
    expect(screen.queryByText(/Recruited/)).not.toBeInTheDocument();

    rerender(
      <PassportRealmsTab
        realms={[row("a", "one", "member")]}
        cleanUsername="alex"
        recruitedCount={4}
      />
    );
    expect(screen.getByText("Recruited 4")).toBeInTheDocument();
  });

  it("says when no nation is held", () => {
    render(<PassportRealmsTab realms={[]} cleanUsername="alex" />);
    expect(screen.getByText("No nations yet")).toBeInTheDocument();
  });
});

describe("PassportWorkTab", () => {
  it("lists creations and narrows them with the category pills", () => {
    render(
      <PassportWorkTab
        work={work}
        wiki={passport.wiki}
        forum={passport.forum}
        cleanUsername="alex"
      />
    );

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
        forum={passport.forum}
        cleanUsername="alex"
      />
    );
    expect(screen.getByText("No published work")).toBeInTheDocument();
  });

  it("leads with the forum counters when the forum stats are shown", () => {
    const forum = {
      ...passport.forum,
      linked: true,
      stats: { userTitle: "Senator", messageCount: 1204, reactionScore: 310, trophyPoints: 85 },
    };
    render(<PassportWorkTab work={work} wiki={passport.wiki} forum={forum} cleanUsername="alex" />);

    const counters = screen.getByLabelText("Forum");
    expect(counters).toHaveTextContent("Senator");
    expect(counters).toHaveTextContent("1,204 messages");
    expect(counters).toHaveTextContent("310 reactions");
    expect(counters).toHaveTextContent("85 trophy points");
  });

  it("keeps the forum counters above the empty state", () => {
    const forum = {
      ...passport.forum,
      linked: true,
      stats: { userTitle: null, messageCount: 1, reactionScore: 0, trophyPoints: 0 },
    };
    render(
      <PassportWorkTab
        work={{ ...work, authoredArticles: [], conlangs: [] }}
        wiki={{ ...passport.wiki, linked: false }}
        forum={forum}
        cleanUsername="alex"
      />
    );
    expect(screen.getByLabelText("Forum")).toHaveTextContent("1 message");
    expect(screen.getByText("No published work")).toBeInTheDocument();
  });

  it("shows no forum counters when they are hidden or unavailable", () => {
    render(
      <PassportWorkTab
        work={work}
        wiki={passport.wiki}
        forum={passport.forum}
        cleanUsername="alex"
      />
    );
    expect(screen.queryByLabelText("Forum")).not.toBeInTheDocument();
  });
});
