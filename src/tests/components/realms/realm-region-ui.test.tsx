/**
 * Realm region pages: the header's stats, in-world date and tabs (Manage only for staff, Rules once there are
 * rules), the officers and community panels, the realm poll, the Rules tab, the typed "Leave realm"
 * confirmation, and the Manage tab's sections following the caller's powers (Claims for the founder and
 * officers holding it, Hand over for the founder).
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/r/eurth",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Radix checkboxes measure themselves; jsdom has no ResizeObserver.
global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const queries: Record<string, unknown> = {};
const mutate = jest.fn();

/** `api.a.b.useQuery()` answers from `queries["a.b"]`; every mutation is `mutate`. */
function apiProxy(path: string[] = []): unknown {
  return new Proxy(() => undefined, {
    get: (_t, prop: string) => {
      if (prop === "useQuery") return () => ({ data: queries[path.join(".")], isLoading: false });
      if (prop === "useMutation") return () => ({ mutate, mutateAsync: mutate, isPending: false });
      if (prop === "useUtils") return () => apiProxy(["utils"]);
      if (prop === "invalidate") return jest.fn();
      return apiProxy([...path, prop]);
    },
  });
}
jest.mock("~/trpc/react", () => ({ api: apiProxy() }));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "clerk_officer" } }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => undefined }));
jest.mock("~/app/admin/realms/_components/ClaimsTab", () => ({
  ClaimsTab: () => <p>claims list</p>,
}));
// The WikiOS canvas editor is far too heavy for jsdom; the sections around it are what is tested here.
jest.mock("~/app/r/[realm]/_components/manage/RealmWikitextEditor", () => ({
  RealmWikitextEditor: ({ saveLabel }: { saveLabel: string }) => <button>{saveLabel}</button>,
}));

import { RealmRegionHeader } from "~/app/r/[realm]/_components/RealmRegionHeader";
import { CommunityPanel, OfficersPanel, PollPanel } from "~/app/r/[realm]/_components/RealmSidebar";
import { LeaveRealmButton } from "~/app/r/[realm]/_components/LeaveRealmButton";
import { LinksSection } from "~/app/r/[realm]/_components/manage/LinksSection";
import RealmManagePage from "~/app/r/[realm]/(region)/manage/page";
import RealmRulesPage from "~/app/r/[realm]/(region)/rules/page";

function overview(overrides: Record<string, unknown> = {}) {
  return {
    realm: {
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      description: "A world of many nations",
      thumbnail: null,
      bannerUrl: null,
      tags: ["Fantasy", "Roleplay"],
      status: "active",
      foundedAt: new Date("2025-06-01"),
      claimsOpen: true,
    },
    founder: null,
    stats: { nations: 42, claimedNations: 30, population: 1_200_000_000 },
    factbook: null,
    rules: null,
    links: [],
    inWorldDate: null,
    officers: [
      {
        title: "Foreign Minister",
        powers: ["diplomacy"],
        name: "Aurelia",
        nation: { id: "c1", name: "Aurelia", slug: "aurelia", flag: null },
      },
    ],
    embassies: [],
    poll: null,
    board: { groupId: null, posts: [] },
    viewer: {
      signedIn: true,
      powers: [],
      isFounder: false,
      canManage: false,
      ownedNations: [],
      boardRestriction: null,
    },
    ...overrides,
  } as never;
}

describe("realm header", () => {
  it("shows the stats strip and tags, and no Manage tab for players", () => {
    render(<RealmRegionHeader openToClaim={0} overview={overview()} />);
    expect(screen.getByRole("heading", { name: "Eurth" })).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("1.20B")).toBeTruthy();
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.getByText("Administered by IxStats staff")).toBeTruthy();
    expect(screen.queryByText("Open to claim")).toBeNull();
    expect(screen.getByText("Fantasy")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Realm sections" });
    expect(within(nav).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(within(nav).queryByRole("link", { name: "Manage" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Rules" })).toBeNull();
    expect(screen.queryByText("In-world date")).toBeNull();
  });

  it("counts the nations still open to claim", () => {
    render(<RealmRegionHeader openToClaim={100} overview={overview()} />);
    expect(screen.getByText("Open to claim")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("shows the realm's in-world date in the stats strip", () => {
    render(
      <RealmRegionHeader
        openToClaim={0}
        overview={overview({
          inWorldDate: { label: "14 Harvest 1203 AE", asOf: "2026-10-01" },
        })}
      />
    );
    expect(screen.getByText("In-world date")).toBeTruthy();
    expect(screen.getByText("14 Harvest 1203 AE")).toBeTruthy();
    expect(screen.getByText(/^as of /)).toBeTruthy();
  });

  it("adds the Rules tab once the realm has rules, and for those who write them", () => {
    const rules = { html: "<p>Be civil.</p>", summary: "Be civil.", updatedAt: null };
    const { unmount } = render(
      <RealmRegionHeader openToClaim={0} overview={overview({ rules })} />
    );
    expect(screen.getByRole("link", { name: "Rules" }).getAttribute("href")).toContain(
      "/r/eurth/rules"
    );
    unmount();
    render(
      <RealmRegionHeader
        openToClaim={0}
        overview={overview({
          viewer: {
            signedIn: true,
            powers: ["appearance"],
            isFounder: false,
            canManage: true,
            ownedNations: [],
            boardRestriction: null,
          },
        })}
      />
    );
    expect(screen.getByRole("link", { name: "Rules" })).toBeTruthy();
  });

  it("adds the Manage tab for the founder and officers", () => {
    render(
      <RealmRegionHeader
        openToClaim={0}
        overview={overview({
          viewer: {
            signedIn: true,
            powers: ["board"],
            isFounder: false,
            canManage: true,
            ownedNations: [],
            boardRestriction: null,
          },
        })}
      />
    );
    expect(screen.getByRole("link", { name: "Manage" }).getAttribute("href")).toContain(
      "/r/eurth/manage"
    );
  });
});

describe("sidebar", () => {
  it("says a realm without a founder is administered by staff, and lists officers", () => {
    render(<OfficersPanel overview={overview()} />);
    expect(screen.getByText("Administered by IxStats staff")).toBeTruthy();
    expect(screen.getByText("Foreign Minister")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Aurelia" }).getAttribute("href")).toContain(
      "/countries/aurelia"
    );
  });

  it("lets a nation owner vote in the realm poll", () => {
    mutate.mockClear();
    const poll = {
      id: "p1",
      question: "Where should the capital be?",
      description: null,
      multiple: false,
      endDate: null,
      expired: false,
      options: [
        { id: "o1", label: "North", votes: 0 },
        { id: "o2", label: "South", votes: 0 },
      ],
      totalVotes: 0,
      userVotedOptionIds: [],
      canVote: true,
    };
    render(<PollPanel slug="eurth" overview={overview({ poll })} />);
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(mutate).toHaveBeenCalledWith({ pollId: "p1", optionIds: ["o2"] });
  });
});

describe("community panel", () => {
  it("opens each link in a new tab without passing on the realm page", () => {
    render(
      <CommunityPanel
        overview={overview({
          links: [
            { label: "Eurth forum", url: "https://forum.eurth.example/", kind: "forum" },
            { label: "Discord", url: "https://discord.gg/eurth", kind: "discord" },
          ],
        })}
      />
    );
    expect(screen.getByRole("heading", { name: "Community" })).toBeTruthy();
    const forum = screen.getByRole("link", { name: "Eurth forum" });
    expect(forum.getAttribute("href")).toBe("https://forum.eurth.example/");
    expect(forum.getAttribute("target")).toBe("_blank");
    expect(forum.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "Discord" }).querySelector("svg")).toBeTruthy();
  });

  it("is left out when the realm has no links", () => {
    const { container } = render(<CommunityPanel overview={overview()} />);
    expect(container.innerHTML).toBe("");
  });
});

/** Like the Manage page, the Rules page reads its params with `use()`. */
async function renderRules() {
  const params = Promise.resolve({ realm: "eurth" });
  await act(async () => {
    render(
      <React.Suspense fallback={null}>
        <RealmRulesPage params={params} />
      </React.Suspense>
    );
    await params;
  });
}

describe("Rules tab", () => {
  afterEach(() => delete queries["realms.region.overview"]);

  it("shows the rules the founder wrote", async () => {
    queries["realms.region.overview"] = overview({
      rules: {
        html: "<h2>Conduct</h2><p>No godmodding.</p>",
        summary: "Conduct No godmodding.",
        updatedAt: new Date("2026-10-01"),
      },
    });
    await renderRules();
    expect(await screen.findByText("No godmodding.")).toBeTruthy();
    expect(screen.getByText(/Last updated/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("asks those who can write rules to write them when there are none", async () => {
    queries["realms.region.overview"] = overview({
      viewer: {
        signedIn: true,
        powers: ["appearance"],
        isFounder: true,
        canManage: true,
        ownedNations: [],
        boardRestriction: null,
      },
    });
    await renderRules();
    expect(await screen.findByText("No rules yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Write the rules" }).getAttribute("href")).toContain(
      "/r/eurth/manage#rules"
    );
  });
});

describe("leaving a realm", () => {
  it("needs the nation's name typed before it releases the nation", () => {
    mutate.mockClear();
    render(
      <LeaveRealmButton slug="eurth" realmName="Eurth" countryId="c1" countryName="Aurelia" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Leave realm" }));
    const confirm = screen.getByRole("button", { name: "Leave and release" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nation name"), { target: { value: "aurelia" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(mutate).toHaveBeenCalledWith({ countryId: "c1", confirmName: "aurelia" });
  });
});

/** The page reads its params with `use()`, so it suspends until the promise settles. */
async function renderManage() {
  const params = Promise.resolve({ realm: "eurth" });
  await act(async () => {
    render(
      <React.Suspense fallback={null}>
        <RealmManagePage params={params} />
      </React.Suspense>
    );
    await params;
  });
}

describe("Manage tab", () => {
  const manage = (
    powers: string[],
    isFounder: boolean,
    { canHandOver = false, officers = [] as object[] } = {}
  ) => ({
    realm: { id: "eurth", slug: "eurth", name: "Eurth", status: "active" },
    powers,
    isFounder,
    canHandOver,
    archived: false,
    appearance: powers.includes("appearance")
      ? { description: null, bannerUrl: null, tags: [] }
      : null,
    factbook: powers.includes("appearance") ? { wikitext: "", updatedAt: null } : null,
    rules: powers.includes("appearance") ? { wikitext: "", updatedAt: null } : null,
    links: powers.includes("appearance") ? [] : null,
    inWorldDate: powers.includes("appearance") ? { value: null } : null,
    officers,
    embassies: [],
    boardRestrictions: [],
    polls: [],
  });

  it("shows an officer only the sections their powers allow", async () => {
    queries["realms.region.manage"] = manage(["board"], false);
    queries["realms.getBySlug"] = { countries: [] };
    await renderManage();
    const nav = await screen.findByRole("navigation", { name: "Manage sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Officers", "Board moderation"]);
    expect(screen.queryByText("claims list")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Appearance" })).toBeNull();
  });

  it("gives an officer with the claims power the Claims section", async () => {
    queries["realms.region.manage"] = manage(["claims"], false);
    await renderManage();
    const nav = await screen.findByRole("navigation", { name: "Manage sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Officers", "Claims"]);
    expect(screen.getByText("claims list")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Hand over" })).toBeNull();
  });

  it("gives the founder claims review, every section and the hand-over", async () => {
    queries["realms.region.manage"] = manage(["appearance", "board", "diplomacy", "claims"], true, {
      canHandOver: true,
    });
    queries["realms.directory"] = [];
    await renderManage();
    const nav = await screen.findByRole("navigation", { name: "Manage sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual([
      "Appearance",
      "Links",
      "In-world date",
      "Factbook",
      "Rules",
      "Officers",
      "Claims",
      "Embassies",
      "Poll",
      "Board moderation",
      "Source sync",
      "Wiki",
      "Hand over",
    ]);
    expect(screen.getByText("claims list")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Source sync" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Wiki" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Community links" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rules" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save rules" })).toBeTruthy();
  });

  it("gives an appearance officer the links, in-world date, factbook and rules", async () => {
    queries["realms.region.manage"] = manage(["appearance"], false);
    await renderManage();
    const nav = await screen.findByRole("navigation", { name: "Manage sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Appearance", "Links", "In-world date", "Factbook", "Rules", "Officers"]);
  });

  it("leaves the hand-over out for site admins acting as founder", async () => {
    queries["realms.region.manage"] = manage(["appearance", "board", "diplomacy", "claims"], true);
    queries["realms.directory"] = [];
    await renderManage();
    const nav = await screen.findByRole("navigation", { name: "Manage sections" });
    expect(within(nav).queryByRole("link", { name: "Hand over" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "Claims" })).toBeTruthy();
  });

  it("hands the realm to an officer once the realm slug is typed", async () => {
    mutate.mockClear();
    queries["realms.region.manage"] = manage(["appearance", "board", "diplomacy", "claims"], true, {
      canHandOver: true,
      officers: [
        {
          userId: "clerk_minister",
          title: "Foreign Minister",
          powers: ["diplomacy"],
          appointedAt: new Date(),
          name: "Borea",
          nation: null,
        },
      ],
    });
    queries["realms.directory"] = [];
    await renderManage();
    const section = await screen.findByRole("region", { name: "Hand over" });
    fireEvent.click(within(section).getByRole("button", { name: "Borea (Foreign Minister)" }));
    const confirm = within(section).getByRole("button", {
      name: "Hand over realm",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(section).getByLabelText(/Type the realm slug/), {
      target: { value: "eurth" },
    });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(mutate).toHaveBeenCalledWith({
      slug: "eurth",
      newOwnerId: "clerk_minister",
      confirmSlug: "eurth",
      keepPreviousAsOfficer: true,
    });
  });
});

describe("community links editor", () => {
  it("won't save an address that isn't https, and saves the trimmed links", () => {
    mutate.mockClear();
    render(
      <LinksSection
        slug="eurth"
        links={[{ label: "Forum", url: "https://forum.eurth.example/", kind: "forum" }]}
      />
    );
    const save = screen.getByRole("button", { name: "Save links" }) as HTMLButtonElement;
    const address = screen.getByLabelText("Link 1 address");
    fireEvent.change(address, { target: { value: "javascript:alert(1)" } });
    expect(screen.getByText("Use a full https:// address.")).toBeTruthy();
    expect(save.disabled).toBe(true);
    fireEvent.change(address, { target: { value: " https://forum.eurth.example/new " } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(mutate).toHaveBeenCalledWith({
      slug: "eurth",
      links: [{ label: "Forum", url: "https://forum.eurth.example/new", kind: "forum" }],
    });
  });
});
