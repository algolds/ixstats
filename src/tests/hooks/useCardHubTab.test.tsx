/**
 * The cards hub's tab router: instant switches with pushState, back/forward through popstate, and a re-sync when a
 * sidebar <Link> changes the pathname under the mounted hub.
 */
import { act, renderHook } from "@testing-library/react";
import { withBasePath } from "~/lib/base-path";

let mockPathname: string | null = "/vault/cards/mine";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

import { useCardHubTab } from "~/hooks/useCardHubTab";

let pushState: jest.SpyInstance;

beforeEach(() => {
  mockPathname = "/vault/cards/mine";
  window.history.replaceState(null, "", "/vault/cards/mine");
  document.title = "Mine · Cards - IxStates";
  pushState = jest.spyOn(window.history, "pushState");
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useCardHubTab", () => {
  it("starts on the tab its page names", () => {
    mockPathname = "/vault/cards/sets";
    const { result } = renderHook(() => useCardHubTab("sets"));
    expect(result.current.tab).toBe("sets");
  });

  it("switches tabs in place, writing the tab's own address, title and scroll", () => {
    const { result } = renderHook(() => useCardHubTab("mine"));
    act(() => result.current.navigate("market"));
    expect(result.current.tab).toBe("market");
    expect(pushState).toHaveBeenCalledWith(null, "", withBasePath("/vault/cards/market"));
    expect(document.title).toBe("Market · Cards - IxStates");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("does nothing when asked for the tab it already shows", () => {
    const { result } = renderHook(() => useCardHubTab("mine"));
    act(() => result.current.navigate("mine"));
    expect(pushState).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.title).toBe("Mine · Cards - IxStates");
  });

  it("follows the back button", () => {
    const { result } = renderHook(() => useCardHubTab("mine"));
    act(() => result.current.navigate("sets"));
    act(() => {
      window.history.replaceState(null, "", "/vault/cards/mine");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.tab).toBe("mine");
  });

  it("keeps its tab when back leaves the hub's four addresses", () => {
    mockPathname = "/vault/cards/explore";
    const { result } = renderHook(() => useCardHubTab("explore"));
    act(() => {
      window.history.replaceState(null, "", "/vault/store");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.tab).toBe("explore");
  });

  it("re-syncs when a link changes the pathname under the mounted hub", () => {
    const { result, rerender } = renderHook(() => useCardHubTab("mine"));
    mockPathname = "/vault/cards/explore";
    rerender();
    expect(result.current.tab).toBe("explore");
    mockPathname = "/vault/import";
    rerender();
    expect(result.current.tab).toBe("explore");
    mockPathname = null;
    rerender();
    expect(result.current.tab).toBe("explore");
  });

  it("stops listening once unmounted", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useCardHubTab("mine"));
    unmount();
    expect(remove).toHaveBeenCalledWith("popstate", expect.any(Function));
  });
});
