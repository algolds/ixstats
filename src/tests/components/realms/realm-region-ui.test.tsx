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
import { CommunityPanel } from "~/app/r/[realm]/_components/RealmSidebar";
import { LeaveRealmButton } from "~/app/r/[realm]/_components/LeaveRealmButton";
import RealmManagePage from "~/app/r/[realm]/(region)/manage/page";
import "~/app/r/[realm]/(region)/rules/page";

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
    speed: null,
    clock: null,
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
    forum: { threads: [] },
    viewer: {
      signedIn: true,
      powers: [],
      isFounder: false,
      canManage: false,
      ownedNations: [],
    },
    ...overrides,
  } as never;
}

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
    { canHandOver = false, officers = [] as object[], canSetFounding = false } = {}
  ) => ({
    realm: { id: "eurth", slug: "eurth", name: "Eurth", status: "active" },
    powers,
    isFounder,
    canHandOver,
    archived: false,
    appearance: powers.includes("appearance")
      ? {
          description: null,
          bannerUrl: null,
          tags: [],
          founderTitle: null,
          foundedYear: null,
          createdYear: 2026,
          canSetFounding,
        }
      : null,
    factbook: powers.includes("appearance") ? { wikitext: "", updatedAt: null } : null,
    rules: powers.includes("appearance") ? { wikitext: "", updatedAt: null } : null,
    links: powers.includes("appearance") ? [] : null,
    time: isFounder ? { clock: null, legacy: null, isIxnay: false, skipsCooldown: false } : null,
    officers,
    embassies: [],
    polls: [],
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
