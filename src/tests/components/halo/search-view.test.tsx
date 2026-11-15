/** Halo search palette: unique ids, close-then-run, pending skeleton, combobox keyboard, platform hint. */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useDynamicIslandState } from "~/components/halo/hooks";
import { SearchView } from "~/components/halo/views/SearchView";
import type { SearchResult, SearchViewProps } from "~/components/halo/types";

const mockQuery = { data: undefined, isLoading: false, isFetching: false };
const mockUser = { user: null, isLoaded: true, isSignedIn: false };
const mockAuth = { signOut: jest.fn() };
const mockTheme = { toggleTheme: jest.fn(), toggleCompactMode: jest.fn() };

jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getSelectList: { useQuery: () => mockQuery } },
    realms: { getSelectList: { useQuery: () => mockQuery } },
    wikios: { advancedSearch: { useQuery: () => mockQuery } },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUser,
  useAuth: () => mockAuth,
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => mockTheme }));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => false }));
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("~/components/halo/plugin-context", () => ({ useActiveDIPlugin: () => null }));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

function makeResult(id: string, title: string, action = jest.fn()): SearchResult {
  return { id, type: "command", title, description: `${title} description`, action };
}

function renderView(overrides: Partial<SearchViewProps> = {}) {
  const props: SearchViewProps = {
    searchQuery: "re",
    setSearchQuery: jest.fn(),
    searchFilter: "all",
    setSearchFilter: jest.fn(),
    debouncedSearchQuery: "re",
    searchResults: [],
    closeDropdown: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<SearchView {...props} />) };
}

describe("Halo search results (hook)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function searchFor(query: string) {
    const hook = renderHook(() => useDynamicIslandState());
    act(() => {
      hook.result.current.switchMode("search");
      hook.result.current.setSearchQuery(query);
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    return hook;
  }

  it("gives every search result a distinct id", () => {
    const { result } = searchFor("home");
    const results = result.current.searchResults;
    expect(results.some((r) => r.title === "Home")).toBe(true);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  });

  it("opens notifications after the palette closes", () => {
    const { result } = searchFor("notifications");
    const entry = result.current.searchResults.find((r) => r.title === "Notifications");
    expect(entry).toBeDefined();
    act(() => {
      result.current.switchMode("compact");
      entry?.action();
    });
    expect(result.current.mode).toBe("notifications");
  });

  it("keeps the palette on search when the Search entry runs", () => {
    const { result } = searchFor("lookup");
    const entry = result.current.searchResults.find((r) => r.title === "Search");
    expect(entry).toBeDefined();
    act(() => {
      result.current.switchMode("compact");
      entry?.action();
    });
    expect(result.current.mode).toBe("search");
  });

  it("is pending while the query is still debouncing", () => {
    const hook = renderHook(() => useDynamicIslandState());
    act(() => {
      hook.result.current.setSearchQuery("home");
    });
    expect(hook.result.current.isSearchPending).toBe(true);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(hook.result.current.isSearchPending).toBe(false);
  });
});

describe("SearchView", () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");

  afterEach(() => {
    Reflect.deleteProperty(navigator, "platform");
    if (platformDescriptor)
      Object.defineProperty(Navigator.prototype, "platform", platformDescriptor);
  });

  it("closes the palette before running the chosen action", () => {
    const calls: string[] = [];
    const result = makeResult(
      "command-a",
      "Alpha",
      jest.fn(() => calls.push("action"))
    );
    renderView({
      searchResults: [result],
      closeDropdown: () => calls.push("close"),
    });
    fireEvent.click(screen.getByRole("option", { name: /Alpha/ }));
    expect(calls).toEqual(["close", "action"]);
  });

  it("shows a skeleton, not Nothing found, while results are pending", () => {
    renderView({ isSearchPending: true });
    expect(screen.queryByText(/Nothing found/)).toBeNull();
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it("shows Nothing found once the search settles with no results", () => {
    renderView({ isSearchPending: false });
    expect(screen.getByText(/Nothing found/)).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("keeps showing results while more are pending", () => {
    renderView({ isSearchPending: true, searchResults: [makeResult("command-a", "Alpha")] });
    expect(screen.getByRole("option", { name: /Alpha/ })).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("runs the second result on ArrowDown then Enter", () => {
    const first = makeResult("command-a", "Alpha");
    const second = makeResult("command-b", "Beta");
    const { props } = renderView({ searchResults: [first, second] });
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(second.action).toHaveBeenCalledTimes(1);
    expect(first.action).not.toHaveBeenCalled();
    expect(props.closeDropdown).toHaveBeenCalledTimes(1);
  });

  it("wraps with ArrowUp from the first result", () => {
    const first = makeResult("command-a", "Alpha");
    const second = makeResult("command-b", "Beta");
    renderView({ searchResults: [first, second] });
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(second.action).toHaveBeenCalledTimes(1);
  });

  it("does nothing on Enter with no results", () => {
    const { props } = renderView();
    const input = screen.getByRole("combobox");
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    expect(props.closeDropdown).not.toHaveBeenCalled();
  });

  it("points aria-activedescendant at the active option", () => {
    renderView({
      searchResults: [makeResult("command-a", "Alpha"), makeResult("command-b", "Beta")],
    });
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1]?.id);
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect(options[0]?.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("listbox").id).toBe(input.getAttribute("aria-controls"));
  });

  it("sets aria-controls only while the listbox is rendered", () => {
    const { unmount } = renderView();
    expect(screen.getByRole("combobox").hasAttribute("aria-controls")).toBe(false);
    unmount();
    renderView({ searchResults: [makeResult("command-a", "Alpha")] });
    expect(screen.getByRole("combobox").getAttribute("aria-controls")).toBe(
      screen.getByRole("listbox").id
    );
  });

  it("leaves Home and End to the text caret", () => {
    renderView({
      searchResults: [makeResult("command-a", "Alpha"), makeResult("command-b", "Beta")],
    });
    const input = screen.getByRole("combobox");
    expect(fireEvent.keyDown(input, { key: "Home" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "End" })).toBe(true);
  });

  it("announces the result count", () => {
    renderView({
      searchResults: [makeResult("command-a", "Alpha"), makeResult("command-b", "Beta")],
    });
    expect(screen.getByText("2 results")).toBeTruthy();
  });

  it("shows Ctrl K on Windows", () => {
    Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });
    renderView({ searchQuery: "", debouncedSearchQuery: "" });
    expect(screen.getByText("Ctrl K")).toBeTruthy();
  });

  it("shows the command key on a Mac", () => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
    renderView({ searchQuery: "", debouncedSearchQuery: "" });
    expect(screen.getByText("⌘K")).toBeTruthy();
  });
});
