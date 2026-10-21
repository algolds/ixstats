/**
 * Plan 413 (item 6): the hero's box is fixed before its picture loads and the picture is the
 * priority, sized one; the rail, the companion and the profile slot paint as they will stay; the
 * scroll spy reads no layout while scrolling.
 */
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { WikiOSHeader } from "~/components/wiki-os/reader/ArticleHeader";
import { useScrollSpy } from "~/components/wiki-os/reader/useScrollSpy";
import {
  COMPANION_COLLAPSED_COOKIE,
  DEFAULT_CHROME_PREFS,
  SIDEBAR_COLLAPSED_COOKIE,
  hasClerkSessionCookie,
  parseChromePrefs,
  writeCollapsedCookie,
} from "~/lib/wiki-os/chrome-prefs";

jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), preload: jest.fn() }));
jest.mock("~/components/wiki-os/reader/CategoryBreadcrumb", () => ({
  CategoryBreadcrumb: () => null,
}));
jest.mock("~/components/wiki-os/reader/WatchButton", () => ({ WatchButton: () => null }));
jest.mock("~/components/wiki-os/reader/headers/EditorialMastheadHeader", () => ({
  EditorialMastheadHeader: () => <div data-testid="masthead" />,
}));
jest.mock("~/components/wiki-os/shared/MediaThemeContext", () => ({
  useWikiMediaTheme: () => ({ getImageAttributes: () => ({}) }),
}));
const mockAuth = { isLoaded: false, isSignedIn: false, user: null };
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => mockAuth }));
jest.mock("~/trpc/react", () => ({
  api: { wikios: { getAuthorProfile: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ themeColors: null }),
}));
jest.mock("~/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));
const THUMB = "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/330px-Flag.png";

const header = (props: Partial<React.ComponentProps<typeof WikiOSHeader>> = {}) => (
  <WikiOSHeader
    title="Aurelia"
    lastModified={null}
    featuredImageUrl={THUMB}
    featuredImageFile={{ width: 3000, height: 2000 }}
    tocLength={0}
    onTocClick={() => undefined}
    {...props}
  />
);

describe("hero image", () => {
  beforeEach(() => jest.clearAllMocks());
  it("falls back to the file, in the same box, when the thumbnail cannot be had", () => {
    const { container } = render(header());

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "/api/mediawiki/ixwiki/images/a/ab/Flag.png"
    );
  });

  describe("a thumbnail that failed before hydration (no React onError ever fired)", () => {
    const FILE = "/api/mediawiki/ixwiki/images/a/ab/Flag.png";
    const picture = (state: { complete: boolean; naturalWidth: number }) => {
      const complete = jest
        .spyOn(HTMLImageElement.prototype, "complete", "get")
        .mockReturnValue(state.complete);
      const width = jest
        .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
        .mockReturnValue(state.naturalWidth);
      return () => {
        complete.mockRestore();
        width.mockRestore();
      };
    };

    it("falls back to the file once mounted: the picture is complete with no pixels", () => {
      const restore = picture({ complete: true, naturalWidth: 0 });
      const { container } = render(header());

      expect(container.querySelector("img")!.getAttribute("src")).toBe(FILE);
      restore();
    });

    it("keeps the thumbnail when it loaded, and while it is still loading", () => {
      const loaded = picture({ complete: true, naturalWidth: 1280 });
      const { container, unmount } = render(header());
      expect(container.querySelector("img")!.getAttribute("src")).toContain("1280px-");
      unmount();
      loaded();

      const loading = picture({ complete: false, naturalWidth: 0 });
      const again = render(header());
      expect(again.container.querySelector("img")!.getAttribute("src")).toContain("1280px-");
      loading();
    });

    it("does not loop when the file itself has no pixels either", () => {
      const restore = picture({ complete: true, naturalWidth: 0 });
      const { container } = render(header({ featuredImageFile: null }));

      expect(container.querySelector("img")!.getAttribute("src")).toBe(FILE);
      restore();
    });
  });
});

describe("scroll spy", () => {
  let rafs: FrameRequestCallback[];
  beforeEach(() => {
    rafs = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => rafs.push(cb));
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    document.body.innerHTML = '<h2 id="a">A</h2><h2 id="b">B</h2><h2 id="c">C</h2>';
    const tops: Record<string, number> = { a: 100, b: 900, c: 1800 };
    for (const id of Object.keys(tops)) {
      jest
        .spyOn(document.getElementById(id)!, "getBoundingClientRect")
        .mockImplementation(() => ({ top: tops[id]! - window.scrollY }) as DOMRect);
    }
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    fireEvent.scroll(window);
    act(() => rafs.splice(0).forEach((cb) => cb(0)));
  };

  it("reports the last heading above the 120 px line, only when it changes, a frame at a time", () => {
    const onChange = jest.fn();
    renderHook(() => useScrollSpy(["a", "b", "c"], onChange));
    expect(onChange).toHaveBeenLastCalledWith("a"); // 100 <= 120 at the top

    const reads = jest.spyOn(document.getElementById("b")!, "getBoundingClientRect");
    reads.mockClear();
    onChange.mockClear();

    scrollTo(500);
    scrollTo(600); // still inside "a": no new report
    expect(onChange).not.toHaveBeenCalled();
    scrollTo(800); // b's top (900) is within 120 px of the viewport top
    expect(onChange).toHaveBeenCalledWith("b");
    scrollTo(1700);
    expect(onChange).toHaveBeenLastCalledWith("c");
    // layout was measured once, when the hook started: not once per scroll event
    expect(reads).not.toHaveBeenCalled();
  });

  it("coalesces many scroll events in one frame into one pass", () => {
    const onChange = jest.fn();
    renderHook(() => useScrollSpy(["a", "b", "c"], onChange));
    onChange.mockClear();
    rafs.length = 0;

    Object.defineProperty(window, "scrollY", { value: 1000, configurable: true });
    for (let i = 0; i < 20; i++) fireEvent.scroll(window);

    expect(rafs).toHaveLength(1);
  });

  it("reports nothing and clears on unmount", () => {
    const onChange = jest.fn();
    const { unmount } = renderHook(() => useScrollSpy([], onChange));
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    const second = jest.fn();
    const mounted = renderHook(() => useScrollSpy(["a"], second));
    mounted.unmount();
    expect(second).toHaveBeenLastCalledWith(null);
  });
});
describe("chrome preferences", () => {
  it("reads the collapsed flags and the session hint from the request's cookies", () => {
    expect(
      parseChromePrefs([
        { name: SIDEBAR_COLLAPSED_COOKIE, value: "0" },
        { name: COMPANION_COLLAPSED_COOKIE, value: "1" },
        { name: "__client_uat", value: "1759000000" },
      ])
    ).toEqual({ sidebarCollapsed: false, companionCollapsed: true, mayBeSignedIn: true });
    expect(parseChromePrefs([])).toEqual(DEFAULT_CHROME_PREFS);
    expect(
      parseChromePrefs([{ name: SIDEBAR_COLLAPSED_COOKIE, value: "garbage" }]).sidebarCollapsed
    ).toBeNull();
  });

  it("knows a Clerk session from its cookies, suffixed or not, and a signed-out one", () => {
    expect(hasClerkSessionCookie([{ name: "__session", value: "jwt" }])).toBe(true);
    expect(hasClerkSessionCookie([{ name: "__session_abc123", value: "jwt" }])).toBe(true);
    expect(hasClerkSessionCookie([{ name: "__client_uat_abc123", value: "1759000000" }])).toBe(
      true
    );
    expect(hasClerkSessionCookie([{ name: "__client_uat", value: "0" }])).toBe(false);
    expect(hasClerkSessionCookie([{ name: "__clerk_db_jwt", value: "x" }])).toBe(false);
    expect(hasClerkSessionCookie([])).toBe(false);
  });

  it("writes a long-lived, site-wide cookie for a collapsed state", () => {
    writeCollapsedCookie(SIDEBAR_COLLAPSED_COOKIE, true);
    expect(document.cookie).toContain(`${SIDEBAR_COLLAPSED_COOKIE}=1`);
    writeCollapsedCookie(SIDEBAR_COLLAPSED_COOKIE, false);
    expect(document.cookie).toContain(`${SIDEBAR_COLLAPSED_COOKIE}=0`);
  });
});
