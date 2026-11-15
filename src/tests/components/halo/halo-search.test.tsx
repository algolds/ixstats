/**
 * Characterizes Halo search: zero-query launcher, debounced query matching, filter ordering,
 * viewer scoping, active plugin commands, and server-synced system actions.
 */
import { act, renderHook } from "@testing-library/react";
import { useDynamicIslandState } from "~/components/halo/hooks";
import type { DIPlugin, SearchFilter } from "~/components/halo/types";

interface MockCountry {
  id: string;
  name: string;
  slug: string;
  economicTier: string;
  flagUrl: string;
}
interface MockWikiResult {
  title: string;
  snippet?: string;
}
interface MockRealm {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  tags: string[];
  nationCount: number;
}

const mockSignedOut = { user: null, isLoaded: true, isSignedIn: false };
const mockSignedIn = { user: { id: "user-1" }, isLoaded: true, isSignedIn: true };
const mockAuth = { signOut: jest.fn() };
const mockTheme = { toggleTheme: jest.fn(), toggleCompactMode: jest.fn() };
const mockPush = jest.fn();
const mockMarkAllNotifsMutate = jest.fn();
const mockMarkAllMessagesMutate = jest.fn();
const mockInvalidateFolderCounts = jest.fn();
let mockUser: typeof mockSignedOut | typeof mockSignedIn = mockSignedOut;
let mockIsAdmin = false;
let mockPathname = "/";
let mockPlugin: DIPlugin | null = null;
let mockCountries: MockCountry[] = [];
let mockRealms: MockRealm[] = [];
let mockWikiResults: MockWikiResult[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      notifications: {
        getUserNotifications: { invalidate: jest.fn() },
        getUnreadCount: { invalidate: jest.fn() },
      },
      messages: {
        getConversationsByFolder: { invalidate: jest.fn() },
        getFolderCounts: { invalidate: mockInvalidateFolderCounts },
      },
    }),
    notifications: {
      markAllAsRead: {
        useMutation: () => ({ mutate: mockMarkAllNotifsMutate }),
      },
    },
    messages: {
      markAllAsRead: {
        useMutation: () => ({ mutate: mockMarkAllMessagesMutate }),
      },
    },
    countries: {
      getSelectList: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => ({
          data: options.enabled ? mockCountries : undefined,
          isLoading: false,
        }),
      },
    },
    realms: {
      getSelectList: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => ({
          data: options.enabled ? mockRealms : undefined,
          isLoading: false,
        }),
      },
    },
    wikios: {
      advancedSearch: {
        useQuery: (input: { limit: number }, options: { enabled?: boolean }) => ({
          data: options.enabled ? { results: mockWikiResults.slice(0, input.limit) } : undefined,
          isFetching: false,
        }),
      },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUser,
  useAuth: () => mockAuth,
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => mockTheme }));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ success: jest.fn() }) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => mockIsAdmin }));
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("~/components/halo/plugin-context", () => ({
  useActiveDIPlugin: () => mockPlugin,
}));

/** Fourteen names containing "st", plus one that does not match "st". */
function buildCountries(): MockCountry[] {
  const matching = Array.from({ length: 14 }, (_, index) => ({
    id: `c${index}`,
    name: `Eastmark ${index}`,
    slug: `eastmark-${index}`,
    economicTier: "Developed",
    flagUrl: `/flags/eastmark-${index}.png`,
  }));
  return [
    ...matching.slice(0, 2),
    { id: "other", name: "Brava", slug: "brava", economicTier: "Emerging", flagUrl: "/b.png" },
    ...matching.slice(2),
  ];
}

function buildWiki(count: number): MockWikiResult[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `Stonebridge ${index}`,
    snippet: `About <b>Stonebridge ${index}</b>`,
  }));
}

function buildRealms(): MockRealm[] {
  return [
    {
      id: "r1",
      slug: "aurora-reach",
      name: "Aurora Reach",
      description: "Maritime trade leagues",
      thumbnail: "/uploads/aurora.png",
      tags: ["maritime", "archipelago"],
      nationCount: 18,
    },
  ];
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockReset();
  mockMarkAllNotifsMutate.mockReset();
  mockMarkAllMessagesMutate.mockReset();
  mockInvalidateFolderCounts.mockReset();
  mockUser = mockSignedOut;
  mockIsAdmin = false;
  mockPathname = "/";
  mockPlugin = null;
  mockCountries = buildCountries();
  mockRealms = buildRealms();
  mockWikiResults = buildWiki(5);
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

function openSearch() {
  const hook = renderHook(() => useDynamicIslandState());
  act(() => {
    hook.result.current.switchMode("search");
  });
  return hook;
}

type Hook = ReturnType<typeof openSearch>;

function search(hook: Hook, query: string, filter: SearchFilter = "all") {
  act(() => {
    hook.result.current.setSearchFilter(filter);
    hook.result.current.setSearchQuery(query);
  });
  act(() => {
    jest.advanceTimersByTime(150);
  });
  return hook.result.current.searchResults;
}

const titles = (results: Array<{ title: string }>) => results.map((r) => r.title);
const types = (results: Array<{ type: string }>) => results.map((r) => r.type);

describe("Halo search results", () => {
  it("immediately surfaces curated zero-query launcher items when opened with an empty query", () => {
    const hook = openSearch();
    const zeroAll = search(hook, "");
    expect(zeroAll.length).toBeGreaterThan(0);
    expect(titles(zeroAll)).toContain("Home");

    const zeroRealms = search(hook, "   ", "realms");
    expect(titles(zeroRealms)).toEqual(["Aurora Reach"]);

    const zeroCountries = search(hook, "", "countries");
    expect(zeroCountries).toHaveLength(12);
    expect(zeroCountries[0]?.title).toBe("Eastmark 0");
  });

  it("waits for the 150 ms debounce before switching from zero-query suggestions to query matches", () => {
    const hook = openSearch();
    act(() => {
      hook.result.current.setSearchQuery("eastmark");
    });
    expect(hook.result.current.isSearchPending).toBe(true);
    expect(titles(hook.result.current.searchResults)).not.toContain("Eastmark 0");
    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(titles(hook.result.current.searchResults)).not.toContain("Eastmark 0");
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(titles(hook.result.current.searchResults)).toContain("Eastmark 0");
    expect(hook.result.current.isSearchPending).toBe(false);
  });

  it("returns nothing when no entry matches and the wiki finds nothing", () => {
    mockWikiResults = [];
    const hook = openSearch();
    expect(search(hook, "zzzzqq")).toEqual([]);
  });

  it("limits each type to 3 under the all filter, ordered countries, commands, wiki (plus realms when matched)", () => {
    const results = search(openSearch(), "st");
    expect(results).toHaveLength(9);
    expect(types(results)).toEqual([
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
      ...Array(3).fill("wiki"),
    ]);
    expect(titles(results.filter((r) => r.type === "country"))).toEqual([
      "Eastmark 0",
      "Eastmark 1",
      "Eastmark 2",
    ]);
    expect(titles(results.filter((r) => r.type === "wiki"))).toEqual([
      "Stonebridge 0",
      "Stonebridge 1",
      "Stonebridge 2",
    ]);
  });

  it("puts wiki results first when the active plugin is the wiki", () => {
    mockPlugin = { id: "wiki" };
    const hook = openSearch();
    const results = search(hook, "st");
    expect(results).toHaveLength(9);
    expect(types(results)).toEqual([
      ...Array(3).fill("wiki"),
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
    ]);
  });

  it("opens search on the wiki filter when the wiki is active, and on all otherwise", () => {
    mockPlugin = { id: "wiki" };
    expect(openSearch().result.current.searchFilter).toBe("wiki");
    mockPlugin = { id: "other" };
    expect(openSearch().result.current.searchFilter).toBe("all");
  });

  it("does not put wiki first for other plugins", () => {
    mockPlugin = { id: "mycountry" };
    const results = search(openSearch(), "st");
    expect(types(results).slice(0, 3)).toEqual(["country", "country", "country"]);
    expect(types(results).slice(-3)).toEqual(["wiki", "wiki", "wiki"]);
  });

  it("lists up to 12 countries and no other type under the countries filter", () => {
    const results = search(openSearch(), "st", "countries");
    expect(results).toHaveLength(12);
    expect(new Set(types(results))).toEqual(new Set(["country"]));
    expect(titles(results)[0]).toBe("Eastmark 0");
    expect(titles(results)).not.toContain("Brava");
  });

  it("lists up to 12 entries of a single type under commands, realms, and wiki filters", () => {
    mockWikiResults = buildWiki(15);
    const hook = openSearch();
    expect(search(hook, "st", "commands")).toHaveLength(12);
    expect(new Set(types(hook.result.current.searchResults))).toEqual(new Set(["command"]));
    expect(search(hook, "aurora", "realms")).toHaveLength(1);
    expect(new Set(types(hook.result.current.searchResults))).toEqual(new Set(["realm"]));
    expect(search(hook, "st", "wiki")).toHaveLength(12);
    expect(new Set(types(hook.result.current.searchResults))).toEqual(new Set(["wiki"]));
  });

  it("matches case-insensitively and by substring", () => {
    const results = search(openSearch(), "EASTM", "countries");
    expect(results).toHaveLength(12);
    expect(titles(search(openSearch(), "rava", "countries"))).toEqual(["Brava"]);
  });

  it("describes a country result with its tier and flag", () => {
    const [first] = search(openSearch(), "st", "countries");
    expect(first).toMatchObject({
      id: "country-c0",
      type: "country",
      description: "Tier: Developed",
      metadata: { flagUrl: "/flags/eastmark-0.png", economicTier: "Developed" },
    });
  });

  it("strips markup from a wiki snippet and falls back when there is none", () => {
    mockWikiResults = [{ title: "Plain" }, { title: "Marked up", snippet: "<i>x</i> y" }];
    const results = search(openSearch(), "st", "wiki");
    expect(results.map((r) => r.description)).toEqual(["Wiki article", "x y"]);
  });

  it("offers no wiki results for a one character query", () => {
    const results = search(openSearch(), "e");
    expect(types(results)).not.toContain("wiki");
  });

  it("offers no countries until the search view has opened", () => {
    const hook = renderHook(() => useDynamicIslandState());
    act(() => {
      hook.result.current.setSearchQuery("eastmark");
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(types(hook.result.current.searchResults)).not.toContain("country");
  });
});

describe("Halo search commands by viewer", () => {
  it("offers Sign in and Sign up, not Sign out, when signed out", () => {
    const found = titles(search(openSearch(), "sign", "commands"));
    expect(found).toContain("Sign in");
    expect(found).toContain("Sign up");
    expect(found).not.toContain("Sign out");
  });

  it("offers Sign out, not Sign in or Sign up, when signed in", () => {
    mockUser = mockSignedIn;
    const found = titles(search(openSearch(), "sign", "commands"));
    expect(found).toContain("Sign out");
    expect(found).not.toContain("Sign in");
    expect(found).not.toContain("Sign up");
  });

  it("syncs mark-all-read to server notifications and messages mutations and invalidates folder counts", () => {
    mockUser = mockSignedIn;
    mockMarkAllMessagesMutate.mockImplementation(
      (_input: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      }
    );

    const hook = openSearch();
    const entry = search(hook, "mark all", "commands").find(
      (r) => r.title === "Mark all notifications read"
    );
    expect(entry).toBeDefined();
    entry!.action();

    expect(mockMarkAllNotifsMutate).toHaveBeenCalledWith(
      { userId: "user-1" },
      expect.objectContaining({ onSettled: expect.any(Function) })
    );
    expect(mockMarkAllMessagesMutate).toHaveBeenCalledTimes(1);
    expect(mockInvalidateFolderCounts).toHaveBeenCalledTimes(1);
  });

  it("hides the Admin panel from non-admins", () => {
    expect(titles(search(openSearch(), "admin"))).not.toContain("Admin panel");
  });

  it("shows the Admin panel to admins", () => {
    mockIsAdmin = true;
    expect(titles(search(openSearch(), "admin"))).toContain("Admin panel");
  });

  it("adds Country profile on a country page", () => {
    mockPathname = "/countries/abc";
    const results = search(openSearch(), "profile", "commands");
    const profile = results.find((r) => r.title === "Country profile");
    expect(profile).toBeDefined();
    expect(profile?.id).toBe("command-/countries/abc");
  });

  it.each(["/", "/countries/new", "/countries/"])("omits Country profile on %s", (pathname) => {
    mockPathname = pathname;
    expect(titles(search(openSearch(), "profile", "commands"))).not.toContain("Country profile");
  });
});

describe("Halo search result ids", () => {
  it("are unique within the all filter results", () => {
    const ids = search(openSearch(), "st").map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are unique within the largest single-type lists", () => {
    mockWikiResults = buildWiki(15);
    const hook = openSearch();
    for (const filter of ["countries", "realms", "commands", "wiki"] as const) {
      const ids = search(hook, filter === "realms" ? "aurora" : "st", filter).map((r) => r.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("Halo search result router navigation", () => {
  it("navigates to a country result with router.push instead of full reload", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const [first] = search(openSearch(), "st", "countries");
      expect(first).toBeDefined();
      first!.action();
      expect(mockPush).toHaveBeenCalledWith("/countries/eastmark-0");
      // jsdom logs "Not implemented: navigation" whenever window.location.href is assigned
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("matches open realms under all and realms filters and routes to /r/<slug>", () => {
    const results = search(openSearch(), "aurora");
    const realm = results.find((r) => r.type === "realm");
    expect(realm).toMatchObject({
      id: "realm-r1",
      type: "realm",
      title: "Aurora Reach",
      description: "18 nations · Maritime trade leagues",
      metadata: { category: "Realm", thumbnail: "/uploads/aurora.png" },
    });
    realm!.action();
    expect(mockPush).toHaveBeenCalledWith("/r/aurora-reach");
  });

  it("ranks active plugin commands first and executes run, path, and pluginView actions", () => {
    const onRun = jest.fn();
    mockPlugin = {
      id: "wiki",
      expandedViews: { narrator: () => null },
      commands: [
        { key: "jump-intro", title: "Jump to Overview", keywords: ["heading"], run: onRun },
        { key: "open-live", title: "Watch live broadcast", pluginView: "narrator" },
        { key: "open-standings", title: "Open league standings", path: "/myleague" },
      ],
    };

    const hook = openSearch();
    // Wiki opens on the "wiki" filter by default, where WikiHalo's heading commands rank first.
    const onWikiFilter = search(hook, "overview", "wiki");
    expect(onWikiFilter[0]).toMatchObject({
      id: "plugin-wiki-jump-intro",
      title: "Jump to Overview",
      metadata: { category: "On this page" },
    });
    onWikiFilter[0]!.action();
    expect(onRun).toHaveBeenCalledTimes(1);

    const viewMatches = search(hook, "broadcast", "all");
    act(() => {
      viewMatches[0]!.action();
    });
    expect(hook.result.current.mode).toBe("plugin:narrator");

    const pathMatches = search(hook, "standings", "commands");
    pathMatches[0]!.action();
    expect(mockPush).toHaveBeenCalledWith("/myleague");
  });
});
