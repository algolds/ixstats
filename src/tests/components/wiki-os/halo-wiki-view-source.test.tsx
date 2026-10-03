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

describe("Halo wiki view: This page actions follow the page's wiki (ruling E-l′)", () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null);

  beforeEach(() => jest.clearAllMocks());

  it("another wiki's page offers no Edit, History or What links here, and opens on that wiki", () => {
    mockSource = "iiwiki";
    render(<WikiView onClose={jest.fn()} />);

    expect(screen.getByText("This page")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("What links here")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("View on original wiki"));
    expect(open).toHaveBeenCalledWith(
      "https://iiwiki.com/wiki/Portal%3AEurth",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("reading-progress rows reopen each page on its own wiki; entries without a wiki open on IxWiki (ruling E-l″)", () => {
    mockSource = "ixwiki";
    localStorage.setItem(
      "wikios:pausedSessions",
      JSON.stringify([
        { title: "Gallambria", source: "iiwiki", scrollPercent: 40, updatedAt: Date.now() },
        { title: "Aurelia", scrollPercent: 10, updatedAt: Date.now() },
      ])
    );
    render(<WikiView onClose={jest.fn()} />);

    fireEvent.click(screen.getByText("Gallambria"));
    expect(mockPush).toHaveBeenLastCalledWith("/wiki/Gallambria?source=iiwiki");
    fireEvent.click(screen.getByText("Aurelia"));
    expect(mockPush).toHaveBeenLastCalledWith("/wiki/Aurelia");
    localStorage.clear();
  });

  it("an IxWiki page keeps Edit, History and What links here, and opens on IxWiki", () => {
    mockSource = "ixwiki";
    render(<WikiView onClose={jest.fn()} />);

    fireEvent.click(screen.getByText("Edit"));
    expect(mockPush).toHaveBeenCalledWith("/wiki/Portal%3AEurth/edit");
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("What links here")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View on original wiki"));
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/ixwiki\.com\/wiki\/Portal%3AEurth$/),
      "_blank",
      "noopener,noreferrer"
    );
  });
});
