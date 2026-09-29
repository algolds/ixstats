import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WikiView } from "~/components/halo/plugins/wiki/views/WikiView";
import type { WikiSource } from "~/lib/wiki-os/config";

let mockSource: WikiSource = "ixwiki";
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/wiki/Portal:Eurth",
}));
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: true }) }));
jest.mock("~/hooks/usePermissions", () => ({ useHasNarratorAccess: () => false }));
jest.mock("~/lib/wiki-os/editor/draft-store", () => ({ listDrafts: () => [] }));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock("~/components/halo/plugins/wiki/components/WikiNarratorPlayer", () => ({
  WikiNarratorPlayer: () => null,
}));
jest.mock("~/components/halo/plugins/wiki/components/WikiSearchDropdown", () => ({
  WikiSearchDropdown: () => null,
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    articleTitle: "Portal:Eurth",
    articleSource: mockSource,
    tocEntries: [],
    themeColors: null,
    activeSectionId: null,
    narratorState: { isPlaying: false },
    narratorActions: null,
  }),
}));

describe("Halo wiki view: This Page actions follow the page's wiki (ruling E-l′)", () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null);

  beforeEach(() => jest.clearAllMocks());

  it("another wiki's page offers no Edit, History or What links here, and opens on that wiki", () => {
    mockSource = "iiwiki";
    render(<WikiView onClose={jest.fn()} />);

    expect(screen.getByText("This Page")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("What links here")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("View on Original Wiki"));
    expect(open).toHaveBeenCalledWith(
      "https://iiwiki.com/wiki/Portal%3AEurth",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("an IxWiki page keeps Edit, History and What links here, and opens on IxWiki", () => {
    mockSource = "ixwiki";
    render(<WikiView onClose={jest.fn()} />);

    fireEvent.click(screen.getByText("Edit"));
    expect(mockPush).toHaveBeenCalledWith("/wiki/Portal%3AEurth/edit");
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("What links here")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View on Original Wiki"));
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/ixwiki\.com\/wiki\/Portal%3AEurth$/),
      "_blank",
      "noopener,noreferrer"
    );
  });
});
