/**
 * Plan 413 (item 6): the hero's box is fixed before its picture loads and the picture is the
 * priority, sized one; the rail, the companion and the profile slot paint as they will stay; the
 * scroll spy reads no layout while scrolling.
 */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { WikiOSHeader } from "~/components/wiki-os/reader/ArticleHeader";
import { useScrollSpy } from "~/components/wiki-os/reader/useScrollSpy";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { WikiOSProfileWidget } from "~/components/wiki-os/shared/WikiOSProfileWidget";
import { WikiChromePrefsProvider } from "~/components/wiki-os/shared/WikiChromePrefs";
import { ArticleCompanionHUD } from "~/components/wiki-os/reader/ArticleCompanionHUD";
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
  useWikiMediaTheme: () => ({ getImageStyle: () => ({}) }),
}));
let mockAuth = { isLoaded: false, isSignedIn: false, user: null };
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
jest.mock("~/components/dashboard/sidebar/DashboardPlayerWidget", () => ({
  DashboardPlayerWidget: () => null,
}));
jest.mock("~/components/dashboard/sidebar/DashboardQuickLinks", () => ({
  DashboardQuickLinks: () => null,
}));
jest.mock("~/components/mycountry/shell/VaultWidget", () => ({ VaultWidget: () => null }));

const { preload } = jest.requireMock("react-dom") as { preload: jest.Mock };

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

  it("is a 1280 px thumbnail with its size, high priority and never lazy, in a box shaped before it loads", () => {
    const { container } = render(header());

    const hero = container.querySelector("img")!;
    expect(hero.getAttribute("src")).toBe(
      "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png"
    );
    expect(hero).toHaveAttribute("width", "1280");
    expect(hero).toHaveAttribute("height", "853");
    expect(hero).toHaveAttribute("fetchpriority", "high");
    expect(hero.getAttribute("loading")).toBe("eager");
    // 3000 x 2000 is 1.5: kept within the banner range, and set in the very first render
    expect((container.querySelector(".wikios-header") as HTMLElement).style.aspectRatio).toBe(
      "2.2"
    );
    expect(preload).toHaveBeenCalledWith(
      "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png",
      expect.objectContaining({ as: "image", fetchPriority: "high" })
    );
  });

  it("measures nothing after load: no Image() probe, and the box does not change when the picture arrives", () => {
    const probe = jest.spyOn(window, "Image");
    const { container } = render(header());
    const before = (container.querySelector(".wikios-header") as HTMLElement).style.aspectRatio;

    fireEvent.load(container.querySelector("img")!);

    expect(probe).not.toHaveBeenCalled();
    expect((container.querySelector(".wikios-header") as HTMLElement).style.aspectRatio).toBe(
      before
    );
    probe.mockRestore();
  });

  it("keeps a fixed 3.2 box when the file's size is unknown, and still never changes it", () => {
    const { container } = render(header({ featuredImageFile: null }));
    expect((container.querySelector(".wikios-header") as HTMLElement).style.aspectRatio).toBe(
      "3.2"
    );
    // an unknown size means the file itself, as before
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "/api/mediawiki/ixwiki/images/a/ab/Flag.png"
    );
  });

  it("falls back to the file, in the same box, when the thumbnail cannot be had", () => {
    const { container } = render(header());

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "/api/mediawiki/ixwiki/images/a/ab/Flag.png"
    );
  });

  it("a country's flag backdrop gets no thumbnail or size of the lead image", () => {
    const { container } = render(
      header({ countryData: { flagUrl: "/api/mediawiki/ixwiki/images/f/fa/Flag_of_X.svg" } })
    );
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "/api/mediawiki/ixwiki/images/f/fa/Flag_of_X.svg"
    );
    expect((container.querySelector(".wikios-header") as HTMLElement).style.aspectRatio).toBe(
      "3.2"
    );
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

describe("the chrome paints as the reader left it", () => {
  const rail = (defaultCollapsed: boolean) => (
    <DashboardSidebarLayout
      variant="rail"
      defaultCollapsed={defaultCollapsed}
      disableCollapse={false}
      expandedWidthStyle="12rem"
      sidebarContent={<div>menu</div>}
    >
      <div>page</div>
    </DashboardSidebarLayout>
  );

  it("the server's HTML has the rail at the width it will keep (collapsed by default), not 12 rem until the browser says", () => {
    expect(renderToString(rail(true))).toContain("width:3.5rem");
    expect(renderToString(rail(false))).toContain("width:12rem");
  });

  it("tells the page when the reader's saved choice is restored, so a cookie can carry it next time", () => {
    localStorage.setItem("ixstats.sidebar.collapsed", "false");
    const onCollapsedChange = jest.fn();

    render(
      <DashboardSidebarLayout
        variant="rail"
        defaultCollapsed
        disableCollapse={false}
        sidebarContent={<div>menu</div>}
        onCollapsedChange={onCollapsedChange}
      >
        <div>page</div>
      </DashboardSidebarLayout>
    );

    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    localStorage.clear();
  });

  it("the profile's place is held while the auth provider loads for a browser with a session", () => {
    mockAuth = { isLoaded: false, isSignedIn: false, user: null };
    const withSession = render(
      <WikiChromePrefsProvider prefs={{ ...DEFAULT_CHROME_PREFS, mayBeSignedIn: true }}>
        <WikiOSProfileWidget expanded={false} />
      </WikiChromePrefsProvider>
    );
    expect(withSession.container.firstElementChild).toHaveClass("h-11");
    withSession.unmount();

    const anonymous = render(<WikiOSProfileWidget expanded={false} />);
    expect(anonymous.container.firstElementChild).toBeNull();
    anonymous.unmount();

    mockAuth = { isLoaded: true, isSignedIn: false, user: null };
    const signedOut = render(
      <WikiChromePrefsProvider prefs={{ ...DEFAULT_CHROME_PREFS, mayBeSignedIn: true }}>
        <WikiOSProfileWidget expanded={false} />
      </WikiChromePrefsProvider>
    );
    expect(signedOut.container.firstElementChild).toBeNull();
  });

  it("the companion's authorship rows hold their place until the authors arrive", () => {
    const pending = render(
      <ArticleCompanionHUD title="X" contentHtml="<p>text</p>" authorsPending readOnly />
    );
    expect(
      pending.container.querySelector('[aria-hidden="true"].min-h-\\[10\\.5rem\\]')
    ).not.toBeNull();
    pending.unmount();

    const arrived = render(
      <ArticleCompanionHUD
        title="X"
        contentHtml="<p>text</p>"
        authorInfo={{ creator: "Amy" }}
        readOnly
      />
    );
    expect(
      arrived.container.querySelector('[aria-hidden="true"].min-h-\\[10\\.5rem\\]')
    ).toBeNull();
    expect(screen.getByText("Amy")).toBeInTheDocument();
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
