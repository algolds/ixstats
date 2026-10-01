import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";

const mockPush = jest.fn();
const mockSidebar = jest.fn();
let mockPathname = "/wiki/Portal:Eurth";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => ({ isSignedIn: true }) }));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ articleTitle: "Portal:Eurth", setActiveModal: jest.fn() }),
}));
jest.mock("~/hooks/useWikiPrefetch", () => ({ useWikiPrefetch: () => undefined }));
jest.mock("~/components/dashboard/sidebar/DashboardSidebarLayout", () => ({
  DashboardSidebarLayout: ({
    sidebarContent,
    children,
  }: {
    sidebarContent: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {sidebarContent}
      {children}
    </div>
  ),
}));
jest.mock("~/components/wiki-os/shared/WikiOSUnifiedSidebar", () => ({
  WikiOSUnifiedSidebar: (props: { isSpecialPage: boolean }) => {
    mockSidebar(props);
    return null;
  },
}));
jest.mock("~/components/wiki-os/shared/WikiOSContentWrapper", () => ({
  WikiOSContentWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock("~/components/wiki-os/shared/SearchModal", () => ({ SearchModal: () => null }));
jest.mock("~/components/wiki-os/shared/CreatePageModal", () => ({ CreatePageModal: () => null }));
jest.mock("~/components/wiki-os/shared/WikiOSLogomark", () => ({ WikiOSLogomark: () => null }));
jest.mock("~/components/wiki-os/shared/WikiUtilitiesRibbon", () => ({
  WikiUtilitiesRibbon: () => null,
}));

function renderLayout(readOnly?: boolean) {
  return render(
    <WikiOSLayout readOnly={readOnly}>
      <p>article</p>
    </WikiOSLayout>
  );
}

describe("WikiOSLayout for another wiki's page (read-only, ruling E-l)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/wiki/Portal:Eurth";
  });

  it.each([
    ["/wiki/Aurelia", false],
    ["/wiki/Talk:Aurelia", false],
    ["/wiki/A/B", false],
    // Titles that used to be tool routes are articles now (the old slugs redirect before this renders).
    ["/wiki/Search", false],
    ["/wiki/Recent_changes", false],
    ["/wiki/Special:Random", true],
    ["/wiki/special%3Arandom", true],
    ["/util/search", true],
    ["/stashes", true],
    ["/blurbs/abc", true],
    ["/dashboard", true],
  ])("%s: special page = %s (unchanged for IxWiki pages)", (pathname, special) => {
    mockPathname = pathname;
    renderLayout();
    expect(mockSidebar).toHaveBeenLastCalledWith(
      expect.objectContaining({ isSpecialPage: special })
    );
  });

  it("shows no page tools (edit, margin, history, backlinks)", () => {
    renderLayout(true);
    expect(mockSidebar).toHaveBeenLastCalledWith(expect.objectContaining({ isSpecialPage: true }));
  });

  it("an IxWiki article keeps its page tools", () => {
    renderLayout();
    expect(mockSidebar).toHaveBeenLastCalledWith(expect.objectContaining({ isSpecialPage: false }));
  });

  it("the edit shortcut does nothing", () => {
    renderLayout(true);
    act(() => void window.dispatchEvent(new Event("wikios:edit")));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("the edit shortcut still opens the editor for an IxWiki article", () => {
    renderLayout();
    act(() => void window.dispatchEvent(new Event("wikios:edit")));
    expect(mockPush).toHaveBeenCalledWith("/wiki/Portal:Eurth?action=edit");
  });
});
