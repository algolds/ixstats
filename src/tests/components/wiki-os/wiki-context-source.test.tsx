import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { WikiContextProvider, useWikiContext } from "~/components/wiki-os/shared/WikiContext";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <WikiContextProvider>{children}</WikiContextProvider>
);

function stored(storage: Storage, key: string) {
  return JSON.parse(storage.getItem(key) ?? "null");
}

describe("WikiContext carries the current page's wiki (ruling E-l′)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("records another wiki's page, and falls back to IxWiki for IxWiki pages and on leaving", () => {
    const { result } = renderHook(() => useWikiContext(), { wrapper });
    expect(result.current.articleSource).toBe("ixwiki");

    act(() => result.current.setWikiPage("Portal:Eurth", [], null, "iiwiki"));
    expect(result.current.articleTitle).toBe("Portal:Eurth");
    expect(result.current.articleSource).toBe("iiwiki");

    act(() => result.current.setWikiPage(null, [], null));
    expect(result.current.articleSource).toBe("ixwiki");

    act(() => result.current.setWikiPage("Aurelia", []));
    expect(result.current.articleSource).toBe("ixwiki");
  });
});

describe("recent and paused pages remember their wiki (ruling E-l″)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("a page read from iiwiki is recorded as iiwiki, kept apart from the IxWiki page of the same title", () => {
    const { result } = renderHook(() => useWikiContext(), { wrapper });
    act(() => result.current.setWikiPage("Gallambria", [], null, "iiwiki"));
    act(() => result.current.setWikiPage("Gallambria", [], null));

    expect(result.current.recentArticles).toEqual([
      { title: "Gallambria", source: "ixwiki" },
      { title: "Gallambria", source: "iiwiki" },
    ]);
    expect(stored(sessionStorage, "wikios:recentArticles")).toEqual([
      { title: "Gallambria", source: "ixwiki" },
      { title: "Gallambria", source: "iiwiki" },
    ]);
  });

  it("reopening a recent iiwiki page goes to its read view on iiwiki", () => {
    const { result } = renderHook(() => useWikiContext(), { wrapper });
    act(() => result.current.setWikiPage("Portal:Eurth", [], null, "iiwiki"));

    act(() => result.current.restoreSession());
    expect(mockPush).toHaveBeenLastCalledWith("/wiki/Portal%3AEurth?source=iiwiki");

    act(() => result.current.restoreSession({ title: "Portal:Eurth", source: "iiwiki" }));
    expect(mockPush).toHaveBeenLastCalledWith("/wiki/Portal%3AEurth?source=iiwiki");
  });

  it("a recent entry saved before sources were recorded (a bare title) reopens on IxWiki as before", () => {
    sessionStorage.setItem("wikios:recentArticles", JSON.stringify(["Aurelia"]));
    const { result } = renderHook(() => useWikiContext(), { wrapper });
    expect(result.current.recentArticles).toEqual([{ title: "Aurelia" }]);

    act(() => result.current.restoreSession());
    expect(mockPush).toHaveBeenCalledWith("/wiki/Aurelia");
  });

  it("reading progress on an iiwiki page is saved with its wiki", () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useWikiContext(), { wrapper });
      act(() => result.current.setWikiPage("Portal:Eurth", [], null, "iiwiki"));
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        jest.advanceTimersByTime(300);
      });
      expect(stored(localStorage, "wikios:pausedSessions")).toEqual([
        expect.objectContaining({ title: "Portal:Eurth", source: "iiwiki" }),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});
