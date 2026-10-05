import { act, fireEvent, render, screen } from "@testing-library/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";

const mockPush = jest.fn();
let mockPathname = "/wiki/Portal:Eurth";
let mockSignedIn = true;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn }),
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ articleTitle: "Portal:Eurth", setActiveModal: jest.fn() }),
}));
jest.mock("~/hooks/useWikiPrefetch", () => ({ useWikiPrefetch: () => undefined }));
jest.mock("~/components/wiki-os/shared/CreatePageModal", () => ({
  CreatePageModal: ({ open }: { open: boolean }) => (open ? <div>create page dialog</div> : null),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLogomark", () => ({ WikiOSLogomark: () => null }));

function renderLayout(readOnly?: boolean) {
  return render(
    <WikiOSLayout readOnly={readOnly}>
      <p>article</p>
    </WikiOSLayout>
  );
}

const hasTabs = () => screen.queryByRole("tablist", { name: "Article views" }) !== null;
const hasPageTools = () => screen.queryByRole("button", { name: "Page tools" }) !== null;

describe("WikiOSLayout without a rail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/wiki/Portal:Eurth";
    mockSignedIn = true;
  });

  it.each([
    ["/wiki/Aurelia", true],
    ["/wiki/Aurelia/talk", true],
    ["/wiki/Aurelia/edit", true],
    ["/wiki/search", false],
    ["/wiki/recent-changes", false],
    ["/wiki/Special:Random", false],
    ["/wiki/special%3Arandom", false],
    ["/util/search", false],
    ["/stashes", false],
    ["/blurbs/abc", false],
    ["/dashboard", false],
  ])("%s: article tabs and page tools = %s", (pathname, article) => {
    mockPathname = pathname;
    renderLayout();
    expect(hasTabs()).toBe(article);
    expect(hasPageTools()).toBe(article);
  });

  it("keeps the article tabs on its history page, without the page tools", () => {
    mockPathname = "/util/history/Aurelia";
    renderLayout();
    expect(screen.getByRole("tab", { name: "History" }).getAttribute("aria-selected")).toBe("true");
    expect(hasPageTools()).toBe(false);
  });

  it("offers Edit to a signed-in reader only", () => {
    mockPathname = "/wiki/Aurelia";
    const { unmount } = renderLayout();
    expect(screen.getByRole("tab", { name: "Edit" })).toBeTruthy();
    unmount();

    mockSignedIn = false;
    renderLayout();
    expect(screen.queryByRole("tab", { name: "Edit" })).toBeNull();
  });

  it("every page offers New page, which opens the create dialog", () => {
    mockPathname = "/util/search";
    renderLayout();
    expect(screen.queryByText("create page dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    expect(screen.getByText("create page dialog")).toBeTruthy();
  });

  it("shows no tabs or page tools on another wiki's page, but still New page", () => {
    mockPathname = "/wiki/Aurelia";
    renderLayout(true);
    expect(hasTabs()).toBe(false);
    expect(hasPageTools()).toBe(false);
    expect(screen.getByRole("button", { name: "New page" })).toBeTruthy();
  });

  it("the edit shortcut does nothing", () => {
    renderLayout(true);
    act(() => void window.dispatchEvent(new Event("wikios:edit")));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("the edit shortcut still opens the editor for an IxWiki article", () => {
    renderLayout();
    act(() => void window.dispatchEvent(new Event("wikios:edit")));
    expect(mockPush).toHaveBeenCalledWith("/wiki/Portal:Eurth/edit");
  });

  describe("Inspector gutter", () => {
    const marker = (container: HTMLElement) =>
      container.querySelector('[data-shell-gutter="none"]') !== null;

    it("opts out of the gutter by default, so a tool page runs the full content width", () => {
      mockPathname = "/util/recent-changes";
      const { container } = render(
        <WikiOSLayout>
          <p>changes</p>
        </WikiOSLayout>
      );
      expect(marker(container)).toBe(true);
    });

    it("keeps the gutter for an article that puts its contents in the Inspector", () => {
      mockPathname = "/wiki/Aurelia";
      const { container } = render(
        <WikiOSLayout inspector>
          <p>article</p>
        </WikiOSLayout>
      );
      expect(marker(container)).toBe(false);
    });
  });
});
