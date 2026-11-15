/**
 * Characterizes Halo search: which results appear, in which order, under which filter, and how the
 * viewer (signed in, admin, current page, active plugin) changes the command list.
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

const mockSignedOut = { user: null, isLoaded: true, isSignedIn: false };
const mockSignedIn = { user: { id: "user-1" }, isLoaded: true, isSignedIn: true };
const mockAuth = { signOut: jest.fn() };
const mockTheme = { toggleTheme: jest.fn(), toggleCompactMode: jest.fn() };
let mockUser: typeof mockSignedOut | typeof mockSignedIn = mockSignedOut;
let mockIsAdmin = false;
let mockPathname = "/";
let mockPlugin: DIPlugin | null = null;
let mockCountries: MockCountry[] = [];
let mockWikiResults: MockWikiResult[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getSelectList: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => ({
          data: options.enabled ? mockCountries : undefined,
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
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => mockIsAdmin }));
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
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

beforeEach(() => {
  jest.useFakeTimers();
  mockUser = mockSignedOut;
  mockIsAdmin = false;
  mockPathname = "/";
  mockPlugin = null;
  mockCountries = buildCountries();
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
  it("returns nothing for an empty or whitespace query", () => {
    const hook = openSearch();
    expect(search(hook, "")).toEqual([]);
    expect(search(hook, "   ")).toEqual([]);
  });

  it("waits for the 150 ms debounce before searching", () => {
    const hook = openSearch();
    act(() => {
      hook.result.current.setSearchQuery("st");
    });
    expect(hook.result.current.searchResults).toEqual([]);
    expect(hook.result.current.isSearchPending).toBe(true);
    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(hook.result.current.searchResults).toEqual([]);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(hook.result.current.searchResults.length).toBeGreaterThan(0);
    expect(hook.result.current.isSearchPending).toBe(false);
  });

  it("returns nothing when no entry matches and the wiki finds nothing", () => {
    mockWikiResults = [];
    const hook = openSearch();
    expect(search(hook, "zzzzqq")).toEqual([]);
  });

  it("limits each type to 3 under the all filter, ordered countries, commands, features, wiki", () => {
    const results = search(openSearch(), "st");
    expect(results).toHaveLength(12);
    expect(types(results)).toEqual([
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
      ...Array(3).fill("feature"),
      ...Array(3).fill("wiki"),
    ]);
    expect(titles(results.filter((r) => r.type === "country"))).toEqual([
      "Eastmark 0",
      "Eastmark 1",
      "Eastmark 2",
    ]);
    expect(titles(results.filter((r) => r.type === "feature"))).toEqual([
      "Refresh data",
      "Notifications",
      "Search",
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
    expect(results).toHaveLength(12);
    expect(types(results)).toEqual([
      ...Array(3).fill("wiki"),
      ...Array(3).fill("country"),
      ...Array(3).fill("command"),
      ...Array(3).fill("feature"),
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

  it("lists up to 12 entries of a single type under the other filters", () => {
    mockWikiResults = buildWiki(15);
    const hook = openSearch();
    expect(search(hook, "st", "commands")).toHaveLength(12);
    expect(new Set(types(hook.result.current.searchResults))).toEqual(new Set(["command"]));
    expect(search(hook, "st", "features")).toHaveLength(3);
    expect(new Set(types(hook.result.current.searchResults))).toEqual(new Set(["feature"]));
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
      subtitle: "Economic Tier: Developed",
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
    for (const filter of ["countries", "commands", "wiki"] as const) {
      const ids = search(hook, "st", filter).map((r) => r.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
