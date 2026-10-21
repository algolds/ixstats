/**
 * Plan 413 (item 6): the hero's box is fixed before its picture loads and the picture is the
 * priority, sized one; the rail, the companion and the profile slot paint as they will stay; the
 * scroll spy reads no layout while scrolling.
 */
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { WikiOSHeader } from "~/components/wiki-os/reader/ArticleHeader";
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
