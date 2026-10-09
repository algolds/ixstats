/**
 * The Dashboard's section router: instant switches with pushState, back/forward through popstate,
 * and a re-sync when a sidebar <Link> changes the pathname under the mounted tree.
 */
import { act, renderHook } from "@testing-library/react";
import { withBasePath } from "~/lib/base-path";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

import { useDashboardSection } from "~/hooks/useDashboardSection";

let pushState: jest.SpyInstance;

beforeEach(() => {
  mockPathname = "/dashboard";
  window.history.replaceState(null, "", "/dashboard");
  document.title = "Dashboard - IxStats";
  pushState = jest.spyOn(window.history, "pushState");
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useDashboardSection", () => {
  it("starts at the initial section", () => {
    const { result } = renderHook(() => useDashboardSection("home"));
    expect(result.current.section).toBe("home");

    mockPathname = "/dashboard/accounts";
    const accounts = renderHook(() => useDashboardSection("accounts"));
    expect(accounts.result.current.section).toBe("accounts");
  });

  it("switches the section in place and updates the URL, title and scroll", () => {
    const { result } = renderHook(() => useDashboardSection("home"));
    act(() => result.current.navigate("accounts"));
    expect(result.current.section).toBe("accounts");
    expect(pushState).toHaveBeenCalledWith(null, "", withBasePath("/dashboard/accounts"));
    expect(document.title).toBe("Accounts - IxStats");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("does nothing when asked for the section it already shows", () => {
    const { result } = renderHook(() => useDashboardSection("home"));
    act(() => result.current.navigate("home"));
    expect(pushState).not.toHaveBeenCalled();
    expect(document.title).toBe("Dashboard - IxStats");
  });

  it("follows the browser back button", () => {
    const { result } = renderHook(() => useDashboardSection("home"));
    act(() => result.current.navigate("accounts"));
    act(() => {
      window.history.replaceState(null, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.section).toBe("home");
  });

  it("re-syncs when the pathname changes under the mounted tree", () => {
    const { result, rerender } = renderHook(() => useDashboardSection("home"));
    mockPathname = "/dashboard/accounts";
    rerender();
    expect(result.current.section).toBe("accounts");
  });
});
